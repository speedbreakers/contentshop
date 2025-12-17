import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { createMoodboard, listMoodboardAssetPreviews, listMoodboards } from '@/lib/db/moodboards';
import { signDownloadToken } from '@/lib/uploads/signing';

const styleProfileSchema = z.record(z.string(), z.any());

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  style_profile: styleProfileSchema.default({}),
});

export async function GET() {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await listMoodboards(team.id);

  const ids = items.map((m) => Number(m.id)).filter((n) => Number.isFinite(n));
  const previews = await listMoodboardAssetPreviews(team.id, ids, 4);

  const exp = Date.now() + 1000 * 60 * 60;
  const byMoodboardId = new Map<number, Array<{ uploadedFileId: number; url: string; originalName: string | null }>>();
  for (const p of previews) {
    const sig = signDownloadToken({ fileId: p.uploadedFileId, teamId: team.id, exp } as any);
    const url = `/api/uploads/${p.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`;
    const arr = byMoodboardId.get(p.moodboardId) ?? [];
    arr.push({ uploadedFileId: p.uploadedFileId, url, originalName: p.originalName ?? null });
    byMoodboardId.set(p.moodboardId, arr);
  }

  const withPreviews = items.map((m: any) => ({
    ...m,
    previewAssets: byMoodboardId.get(Number(m.id)) ?? [],
  }));

  return Response.json({ items: withPreviews });
}

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const created = await createMoodboard(team.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    styleProfile: parsed.data.style_profile ?? {},
  });
  if (!created) return Response.json({ error: 'Failed to create moodboard' }, { status: 500 });
  return Response.json({ moodboard: created }, { status: 201 });
}



