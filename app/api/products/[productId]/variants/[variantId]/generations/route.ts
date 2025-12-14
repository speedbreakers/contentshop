import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { createVariantGenerationWithMockOutputs, listVariantGenerations } from '@/lib/db/generations';

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

  const items = await listVariantGenerations(team.id, vid);
  return Response.json({ items });
}

const apparelInputSchema = z.object({
  garment_front: z.string().min(1),
  garment_back: z.string().optional().default(''),
  garment_left: z.string().optional().default(''),
  garment_right: z.string().optional().default(''),
  model_image: z.string().optional().default(''),
  background_image: z.string().optional().default(''),
  number_of_variations: z.number().int().min(1).max(10).default(1),
  output_format: z.enum(['png', 'jpg', 'webp']).default('png'),
  aspect_ratio: z.enum(['1:1', '4:5', '3:4', '16:9']).default('1:1'),
  custom_instructions: z.string().optional().default(''),
});

const nonApparelInputSchema = z.object({
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

  // Validate input based on product category.
  let validatedInput: any = null;
  let schemaKey: string = parsed.data.schemaKey;

  if (product.category === 'apparel') {
    const ok = apparelInputSchema.safeParse(parsed.data.input);
    if (!ok.success) {
      return Response.json(
        { error: ok.error.errors[0]?.message ?? 'Invalid apparel input' },
        { status: 400 }
      );
    }
    validatedInput = ok.data;
    schemaKey = 'apparel.v1';
  } else {
    const ok = nonApparelInputSchema.safeParse(parsed.data.input);
    if (!ok.success) {
      return Response.json(
        { error: ok.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    validatedInput = ok.data;
    schemaKey = 'non_apparel.v1';
  }

  const prompt = validatedInput.custom_instructions || null;
  const numberOfVariations = validatedInput.number_of_variations ?? 1;

  const created = await createVariantGenerationWithMockOutputs({
    teamId: team.id,
    productId: pid,
    variantId: vid,
    schemaKey,
    input: validatedInput,
    numberOfVariations,
    prompt,
  });

  return Response.json(created, { status: 201 });
}


