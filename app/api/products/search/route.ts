/**
 * Products Search API
 *
 * GET /api/products/search?q=term - Search canonical products with variants
 *
 * Used by the link dialog to find canonical variants to link to.
 */

import { and, eq, ilike, sql, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { products, productVariants } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Build search condition
  const searchCondition = query
    ? or(
        ilike(products.name, `%${query}%`),
        sql`EXISTS (
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = ${products.id}
          AND (pv.name ILIKE ${`%${query}%`} OR pv.sku ILIKE ${`%${query}%`})
        )`
      )
    : undefined;

  // Get products with matching name or variants
  const matchingProducts = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
    })
    .from(products)
    .where(
      and(
        eq(products.teamId, team.id),
        searchCondition
      )
    )
    .limit(Math.min(limit, 50));

  // Get variants for each product
  const results = await Promise.all(
    matchingProducts.map(async (product) => {
      const variantCondition = query
        ? or(
            ilike(productVariants.name, `%${query}%`),
            ilike(productVariants.sku, `%${query}%`)
          )
        : undefined;

      const variants = await db
        .select({
          id: productVariants.id,
          name: productVariants.name,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.teamId, team.id),
            eq(productVariants.productId, product.id),
            variantCondition
          )
        )
        .limit(20);

      return {
        ...product,
        variants,
      };
    })
  );

  // Filter out products with no variants if we have a search query
  const filtered = query
    ? results.filter((p) => p.variants.length > 0)
    : results;

  return Response.json({ products: filtered });
}

