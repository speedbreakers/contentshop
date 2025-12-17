import { z } from 'zod';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { products, productVariants } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = z
    .number()
    .int()
    .min(1)
    .max(2000)
    .catch(500)
    .parse(Number(searchParams.get('limit') || 500));

  const where = q
    ? and(
        eq(productVariants.teamId, team.id),
        isNull(productVariants.deletedAt),
        or(
          ilike(productVariants.title, `%${q}%`),
          ilike(productVariants.sku, `%${q}%`),
          ilike(products.title, `%${q}%`)
        )
      )
    : and(eq(productVariants.teamId, team.id), isNull(productVariants.deletedAt));

  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      title: productVariants.title,
      sku: productVariants.sku,
      imageUrl: productVariants.imageUrl,
      updatedAt: productVariants.updatedAt,
      productTitle: products.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(where, eq(products.teamId, team.id), isNull(products.deletedAt)))
    .orderBy(desc(productVariants.updatedAt))
    .limit(limit);

  return Response.json({ items: rows });
}


