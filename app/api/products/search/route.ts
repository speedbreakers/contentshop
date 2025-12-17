/**
 * Products Search API
 *
 * GET /api/products/search?q=term - Search canonical products with variants
 *
 * Used by the link dialog to find canonical variants to link to.
 */

import { and, eq, ilike, or, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { products, productVariants } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Avoid returning the entire catalog when the user hasn't typed anything yet.
  // The link modal expects "type to search" behavior.
  if (query.length < 2) {
    return Response.json({ products: [] });
  }

  // Build search condition (product title OR any variant title/SKU)
  const searchCondition = or(
    ilike(products.title, `%${query}%`),
    ilike(productVariants.title, `%${query}%`),
    ilike(productVariants.sku, `%${query}%`)
  );

  // Get products with matching title or variants (join to variants for searching)
  const matchingProducts = await db
    .select({
      id: products.id,
      title: products.title,
      category: products.category,
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.teamId, team.id),
        eq(productVariants.productId, products.id),
        isNull(productVariants.deletedAt)
      )
    )
    .where(
      and(
        eq(products.teamId, team.id),
        isNull(products.deletedAt),
        searchCondition
      )
    )
    .groupBy(products.id)
    .limit(Math.min(limit, 50));

  // Get variants for each product.
  // Important: if the query matched the PRODUCT title, we still want to return its variants so the
  // user can choose what to link. So we do not filter variants by the query here.
  const results = await Promise.all(
    matchingProducts.map(async (product) => {
      const variants = await db
        .select({
          id: productVariants.id,
          title: productVariants.title,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.teamId, team.id),
            eq(productVariants.productId, product.id),
            isNull(productVariants.deletedAt)
          )
        )
        .limit(20);

      return {
        id: product.id,
        title: product.title,
        category: product.category,
        variants,
      };
    })
  );

  // Filter out products with no variants (since we're linking variants)
  return Response.json({ products: results.filter((p) => p.variants.length > 0) });
}

