import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { addSetItem, listSetItems, appendSetEvent } from '@/lib/db/sets';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { setId } = await params;
  const id = parseId(setId);
  if (!id) return Response.json({ error: 'Invalid setId' }, { status: 400 });

  const items = await listSetItems(team.id, id);
  return Response.json({ items });
}

const addSchema = z.object({
  itemType: z.string().min(1).max(30),
  itemId: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export async function POST(
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
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const created = await addSetItem(team.id, {
    setId: id,
    itemType: parsed.data.itemType,
    itemId: parsed.data.itemId,
    sortOrder: parsed.data.sortOrder ?? 0,
    addedByUserId: user?.id ?? null,
  });

  if (!created) return Response.json({ error: 'Failed to add item' }, { status: 500 });

  await appendSetEvent(team.id, {
    setId: id,
    actorUserId: user?.id ?? null,
    type: 'item_added',
    metadata: { itemType: created.itemType, itemId: created.itemId },
  });

  return Response.json({ item: created }, { status: 201 });
}


