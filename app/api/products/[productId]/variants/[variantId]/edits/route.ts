import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { createVariantEditWithGeminiOutput } from '@/lib/db/generations';
import { signVariantImageToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

const bodySchema = z.object({
  base_image_url: z.string().min(1),
  base_label: z.string().optional().default(''),
  edit_instructions: z.string().optional().default(''),
  reference_image_url: z.string().optional().nullable().default(null),
  target_set_id: z.number().int().positive().optional().nullable().default(null),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  const requestOrigin = new URL(request.url).origin;
  const baseLabel = parsed.data.base_label?.trim() ? String(parsed.data.base_label).trim() : 'image';
  const outputLabel = `edited-${baseLabel}`;
  const created = await createVariantEditWithGeminiOutput({
    teamId: team.id,
    productId: pid,
    variantId: vid,
    schemaKey: 'edit.v1',
    targetSetId: parsed.data.target_set_id,
    input: {
      base_image_url: parsed.data.base_image_url,
      reference_image_url: parsed.data.reference_image_url,
      edit_instructions: parsed.data.edit_instructions,
      base_label: baseLabel,
      output_label: outputLabel,
    },
    prompt: parsed.data.edit_instructions,
    requestOrigin,
    productTitle: product.title,
    productCategory: product.category,
  });

  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const sig = signVariantImageToken({ imageId: created.image.id, teamId: team.id, exp });
  const image = {
    ...created.image,
    url: `/api/variant-images/${created.image.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
  };

  return Response.json({ generation: created.generation, image, folderId: created.folderId }, { status: 201 });
}


