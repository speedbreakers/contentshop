import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { createProductWithDefaultVariant, listProducts } from '@/lib/db/products';

export async function GET() {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await listProducts(team.id);
  const items = rows.map((r: any) => ({
    ...(r.product ?? {}),
    variantsCount: Number(r.variantsCount ?? 0),
  }));
  return Response.json({ items });
}

const createProductSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['apparel', 'electronics', 'jewellery']),
  vendor: z.string().optional().nullable(),
  productType: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  shopifyProductGid: z.string().optional().nullable(),
  options: z
    .array(
      z.object({
        name: z.string().min(1),
        position: z.number().int().min(1).max(3),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { product, defaultVariant } = await createProductWithDefaultVariant({
    teamId: team.id,
    ...parsed.data,
  });

  return Response.json({ product, defaultVariant }, { status: 201 });
}


