import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  addMoodboardAssetsWithKind,
  getMoodboardById,
  listMoodboardAssetsByKind,
  type MoodboardAssetKind,
} from '@/lib/db/moodboards';
import { signDownloadToken } from '@/lib/uploads/signing';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '@/lib/ai/shared/json';
import { buildSameOriginAuthHeaders, fetchAsBytes, resolveUrl } from '@/lib/ai/shared/image-fetch';
import { updateMoodboard } from '@/lib/db/moodboards';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const postSchema = z.object({
  uploaded_file_ids: z.array(z.number().int().positive()).min(1),
  kind: z.enum(['background', 'model', 'reference']).default('reference'),
});

const analysisSchema = z.object({
  backgrounds_analysis_summary: z.string().default(''),
  models_analysis_summary: z.string().default(''),
});

async function recomputeMoodboardAssetSummaries(args: {
  teamId: number;
  moodboardId: number;
  requestOrigin: string;
  authCookie: string | null;
}) {
  const mb = await getMoodboardById(args.teamId, args.moodboardId);
  if (!mb) return;

  const bg = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'background');
  const models = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'model');

  const maxPerKind = 3;
  const bgUrls = bg.slice(0, maxPerKind).map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')));
  const modelUrls = models
    .slice(0, maxPerKind)
    .map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')));

  // If nothing to analyze, clear summaries.
  if (bgUrls.filter(Boolean).length === 0 && modelUrls.filter(Boolean).length === 0) {
    const next = { ...(mb.styleProfile as any), backgrounds_analysis_summary: '', models_analysis_summary: '' };
    await updateMoodboard(args.teamId, args.moodboardId, { styleProfile: next });
    return;
  }

  const prompt =
    'You are analyzing a brand moodboard. Summarize the common visual characteristics.\n' +
    'Return STRICT JSON with keys:\n' +
    '- backgrounds_analysis_summary: string\n' +
    '- models_analysis_summary: string\n' +
    'Guidelines:\n' +
    '- Be concise (1-3 sentences each).\n' +
    '- Describe lighting, color palette, environment, camera/composition.\n' +
    '- For models: demographics only if confidently inferable; otherwise describe pose/style.\n';

  const content: any[] = [{ type: 'text', text: prompt }];

  const allUrls = [
    ...bgUrls.filter(Boolean).map((u) => ({ url: u, label: 'background' })),
    ...modelUrls.filter(Boolean).map((u) => ({ url: u, label: 'model' })),
  ];

  for (const u of allUrls) {
    const headers = buildSameOriginAuthHeaders({
      requestOrigin: args.requestOrigin,
      url: u.url,
      cookie: args.authCookie,
    });
    const img = await fetchAsBytes(u.url, headers ? { headers } : undefined);
    content.push({ type: 'text', text: `Image kind: ${u.label}` });
    content.push({ type: 'image', image: img.bytes, mimeType: img.mimeType });
  }

  const result: any = await generateText({
    model: 'google/gemini-2.0-flash',
    messages: [{ role: 'user', content }],
  } as any);

  const text = String(result?.text ?? '');
  const parsed = parseJsonWithSchema(text, analysisSchema);
  const next = {
    ...(mb.styleProfile as any),
    backgrounds_analysis_summary: parsed.backgrounds_analysis_summary,
    models_analysis_summary: parsed.models_analysis_summary,
  };
  await updateMoodboard(args.teamId, args.moodboardId, { styleProfile: next });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ moodboardId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId } = await params;
  const id = parseId(moodboardId);
  if (!id) return Response.json({ error: 'Invalid moodboardId' }, { status: 400 });

  const board = await getMoodboardById(team.id, id);
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const kindParam = (url.searchParams.get('kind') ?? 'all') as MoodboardAssetKind | 'all';
  const kind: MoodboardAssetKind | 'all' =
    kindParam === 'background' || kindParam === 'model' || kindParam === 'reference' || kindParam === 'all'
      ? kindParam
      : 'all';

  const items = await listMoodboardAssetsByKind(team.id, id, kind);
  const exp = Date.now() + 1000 * 60 * 60;
  const mapped = items.map((a) => {
    const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
    return {
      id: a.id,
      moodboardId: a.moodboardId,
      uploadedFileId: a.uploadedFileId,
      kind: (a as any).kind ?? 'reference',
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
      originalName: a.originalName,
      contentType: a.contentType,
      size: a.size,
      url: `/api/uploads/${a.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
    };
  });

  return Response.json({ items: mapped });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ moodboardId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId } = await params;
  const id = parseId(moodboardId);
  if (!id) return Response.json({ error: 'Invalid moodboardId' }, { status: 400 });

  const board = await getMoodboardById(team.id, id);
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const inserted = await addMoodboardAssetsWithKind(
    team.id,
    id,
    parsed.data.uploaded_file_ids,
    parsed.data.kind
  );

  // Best-effort analysis: update moodboard style_profile summaries after adding assets.
  // Keep failures non-fatal for uploads UX.
  try {
    const requestOrigin = new URL(request.url).origin;
    const authCookie = request.headers.get('cookie');
    await recomputeMoodboardAssetSummaries({
      teamId: team.id,
      moodboardId: id,
      requestOrigin,
      authCookie,
    });
  } catch {
    // ignore
  }

  return Response.json({ items: inserted }, { status: 201 });
}



