import { getTeamForUser, getUser } from '@/lib/db/queries';
import { appendSetEvent, removeSetItem } from '@/lib/db/sets';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ setId: string; itemType: string; itemId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUser();

  const { setId, itemType, itemId } = await params;
  const sid = parseId(setId);
  const iid = parseId(itemId);
  if (!sid || !iid) {
    return Response.json({ error: 'Invalid setId or itemId' }, { status: 400 });
  }

  const deleted = await removeSetItem(team.id, sid, itemType, iid);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });

  await appendSetEvent(team.id, {
    setId: sid,
    actorUserId: user?.id ?? null,
    type: 'item_removed',
    metadata: { itemType, itemId: iid },
  });

  return Response.json({ ok: true });
}


