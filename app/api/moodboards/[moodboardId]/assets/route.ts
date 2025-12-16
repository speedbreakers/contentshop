import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { addMoodboardAssets, getMoodboardById, listMoodboardAssets } from '@/lib/db/moodboards';
import { signDownloadToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const postSchema = z.object({
  uploaded_file_ids: z.array(z.number().int().positive()).min(1),
});

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

  const items = await listMoodboardAssets(team.id, id);
  const exp = Date.now() + 1000 * 60 * 60;
  const mapped = items.map((a) => {
    const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
    return {
      id: a.id,
      moodboardId: a.moodboardId,
      uploadedFileId: a.uploadedFileId,
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

  const inserted = await addMoodboardAssets(team.id, id, parsed.data.uploaded_file_ids);
  return Response.json({ items: inserted }, { status: 201 });
}



