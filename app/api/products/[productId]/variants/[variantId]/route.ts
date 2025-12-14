import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  getVariantById,
  softDeleteVariant,
  updateVariant,
} from '@/lib/db/products';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const variant = await getVariantById(team.id, pid, vid);
  if (!variant) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ variant });
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
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

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const updated = await updateVariant(team.id, pid, vid, parsed.data);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ variant: updated });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const result = await softDeleteVariant(team.id, pid, vid);
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (result.reason === 'is_default') {
      return Response.json(
        { error: 'Cannot delete default variant. Reassign defaultVariantId first.' },
        { status: 409 }
      );
    }
    if (result.reason === 'last_variant') {
      return Response.json(
        { error: 'Cannot delete the last remaining variant of a product.' },
        { status: 409 }
      );
    }
  }

  return Response.json({ ok: true });
}


