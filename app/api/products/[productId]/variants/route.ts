import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  createVariant,
  getProductById,
  listVariants,
} from '@/lib/db/products';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const pid = parseId(productId);
  if (!pid) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const items = await listVariants(team.id, pid);
  return Response.json({ items });
}

const createVariantSchema = z.object({
  title: z.string().min(1),
  sku: z.string().optional().nullable(),
  shopifyVariantGid: z.string().optional().nullable(),
  optionValues: z
    .array(
      z.object({
        productOptionId: z.number().int().positive(),
        value: z.string().min(1),
      })
    )
    .optional(),
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

  const existingProduct = await getProductById(team.id, pid);
  if (!existingProduct) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createVariantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const variant = await createVariant({
    teamId: team.id,
    productId: pid,
    ...parsed.data,
  });

  return Response.json({ variant }, { status: 201 });
}


