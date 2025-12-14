import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { deleteSet, renameSet, appendSetEvent } from '@/lib/db/sets';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const renameSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUser();

  const { setId } = await params;
  const id = parseId(setId);
  if (!id) return Response.json({ error: 'Invalid setId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const updated = await renameSet(team.id, id, parsed.data.name);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  await appendSetEvent(team.id, {
    setId: id,
    actorUserId: user?.id ?? null,
    type: 'renamed',
    metadata: { name: parsed.data.name },
  });

  return Response.json({ set: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUser();

  const { setId } = await params;
  const id = parseId(setId);
  if (!id) return Response.json({ error: 'Invalid setId' }, { status: 400 });

  const result = await deleteSet(team.id, id);
  if (!result.ok) {
    if (result.reason === 'is_default') {
      return Response.json({ error: 'Cannot delete the default set' }, { status: 400 });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await appendSetEvent(team.id, {
    setId: id,
    actorUserId: user?.id ?? null,
    type: 'deleted',
  });

  return Response.json({ ok: true });
}


