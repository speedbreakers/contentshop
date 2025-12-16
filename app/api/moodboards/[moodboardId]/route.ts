import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getMoodboardById, softDeleteMoodboard, updateMoodboard } from '@/lib/db/moodboards';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const styleProfileSchema = z.record(z.string(), z.any());

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  style_profile: styleProfileSchema.optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ moodboardId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId } = await params;
  const id = parseId(moodboardId);
  if (!id) return Response.json({ error: 'Invalid moodboardId' }, { status: 400 });

  const moodboard = await getMoodboardById(team.id, id);
  if (!moodboard) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ moodboard });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ moodboardId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId } = await params;
  const id = parseId(moodboardId);
  if (!id) return Response.json({ error: 'Invalid moodboardId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const updated = await updateMoodboard(team.id, id, {
    name: parsed.data.name,
    description: parsed.data.description,
    styleProfile: parsed.data.style_profile,
  });
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ moodboard: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ moodboardId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId } = await params;
  const id = parseId(moodboardId);
  if (!id) return Response.json({ error: 'Invalid moodboardId' }, { status: 400 });

  const deleted = await softDeleteMoodboard(team.id, id);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ ok: true });
}



