import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  getProductById,
  getProductDescriptionById,
  selectProductDescription,
  updateProductDescriptionContent,
  deleteProductDescription,
} from '@/lib/db/products';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; descriptionId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, descriptionId } = await params;
  const pid = parseId(productId);
  const did = parseId(descriptionId);
  if (!pid || !did) return Response.json({ error: 'Invalid params' }, { status: 400 });

  const description = await getProductDescriptionById(team.id, pid, did);
  if (!description) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ description });
}

const patchSchema = z.object({
  select: z.boolean().optional(),
  content: z.string().min(1).max(10000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string; descriptionId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, descriptionId } = await params;
  const pid = parseId(productId);
  const did = parseId(descriptionId);
  if (!pid || !did) return Response.json({ error: 'Invalid params' }, { status: 400 });

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  // Handle content update (manual editing)
  if (parsed.data.content !== undefined) {
    const updated = await updateProductDescriptionContent(team.id, pid, did, parsed.data.content);
    if (!updated) {
      return Response.json({ error: 'Description not found' }, { status: 404 });
    }
    return Response.json({ description: updated });
  }

  // Handle select
  if (parsed.data.select) {
    const updated = await selectProductDescription(team.id, pid, did);
    if (!updated) {
      return Response.json({ error: 'Description not found' }, { status: 404 });
    }
    return Response.json({ product: updated, selectedDescriptionId: did });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ productId: string; descriptionId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, descriptionId } = await params;
  const pid = parseId(productId);
  const did = parseId(descriptionId);
  if (!pid || !did) return Response.json({ error: 'Invalid params' }, { status: 400 });

  const result = await deleteProductDescription(team.id, pid, did);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 400 });
  }

  return Response.json({ ok: true });
}

