import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  getProductById,
  softDeleteProduct,
  updateProduct,
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
  const id = parseId(productId);
  if (!id) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const product = await getProductById(team.id, id);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ product });
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(['apparel', 'electronics', 'jewellery']).optional(),
  vendor: z.string().optional().nullable(),
  productType: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  status: z.string().optional(),
  shopifyProductGid: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const id = parseId(productId);
  if (!id) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const updated = await updateProduct(team.id, id, parsed.data);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ product: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const id = parseId(productId);
  if (!id) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  await softDeleteProduct(team.id, id);
  return Response.json({ ok: true });
}


