import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { setDefaultVariant } from '@/lib/db/products';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const schema = z.object({
  variantId: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const pid = parseId(productId);
  if (!pid) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const updated = await setDefaultVariant(team.id, pid, parsed.data.variantId);
  if (!updated) {
    return Response.json({ error: 'Variant not found for product' }, { status: 404 });
  }

  return Response.json({ product: updated });
}


