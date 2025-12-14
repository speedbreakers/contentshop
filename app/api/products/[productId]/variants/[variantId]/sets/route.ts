import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { createSet, listSets, appendSetEvent } from '@/lib/db/sets';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const vid = parseId(variantId);
  if (!vid) return Response.json({ error: 'Invalid variantId' }, { status: 400 });

  const { productId } = await params;
  const pid = parseId(productId);
  const items = await listSets(team.id, vid, { productId: pid ?? null });
  return Response.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUser();

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const created = await createSet(team.id, {
    scopeType: 'variant',
    productId: pid,
    variantId: vid,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    createdByUserId: user?.id ?? null,
  });

  if (!created) return Response.json({ error: 'Failed to create set' }, { status: 500 });

  await appendSetEvent(team.id, {
    setId: created.id,
    actorUserId: user?.id ?? null,
    type: 'created',
    metadata: { name: created.name },
  });

  return Response.json({ set: created }, { status: 201 });
}


