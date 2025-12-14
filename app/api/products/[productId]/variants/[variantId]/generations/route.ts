import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { createVariantGenerationWithGeminiOutputs, listVariantGenerations } from '@/lib/db/generations';
import { signVariantImageToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const vid = parseId(variantId);
  if (!vid) return Response.json({ error: 'Invalid variantId' }, { status: 400 });

  const items = await listVariantGenerations(team.id, vid);
  return Response.json({ items });
}

const unifiedInputSchema = z.object({
  product_images: z.array(z.string().min(1)).min(1),
  number_of_variations: z.number().int().min(1).max(10).default(1),
  model_image: z.string().optional().default(''),
  background_image: z.string().optional().default(''),
  output_format: z.enum(['png', 'jpg', 'webp']).default('png'),
  aspect_ratio: z.enum(['1:1', '4:5', '3:4', '16:9']).default('1:1'),
  custom_instructions: z.string().optional().default(''),
});

const createSchema = z.object({
  schemaKey: z.string().min(1).max(50),
  input: z.any(),
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

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  // Validate unified input (product_images for all categories).
  const ok = unifiedInputSchema.safeParse(parsed.data.input);
  if (!ok.success) {
    return Response.json(
      { error: ok.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const validatedInput = ok.data;
  const schemaKey = 'hero_product.v1';

  const prompt = validatedInput.custom_instructions || null;
  const numberOfVariations = validatedInput.number_of_variations ?? 1;

  const requestOrigin = new URL(request.url).origin;
  const created = await createVariantGenerationWithGeminiOutputs({
    teamId: team.id,
    productId: pid,
    variantId: vid,
    schemaKey,
    input: validatedInput,
    numberOfVariations,
    prompt,
    requestOrigin,
    productTitle: product.title,
    productCategory: product.category,
  });

  // Return signed proxy URLs for created images.
  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const images = (created.images ?? []).map((img) => {
    const sig = signVariantImageToken({ imageId: img.id, teamId: team.id, exp });
    return {
      ...img,
      url: `/api/variant-images/${img.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
    };
  });

  return Response.json({ ...created, images }, { status: 201 });
}


