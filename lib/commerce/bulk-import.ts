/**
 * Bulk Import & Link
 *
 * Creates canonical products/variants from unlinked external products
 * and automatically creates links.
 */

import { and, eq, sql, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  externalProducts,
  externalVariants,
  productLinks,
  variantLinks,
  products,
  productVariants,
  uploadedFiles,
} from '@/lib/db/schema';
import {
  createProductLink,
  createVariantLink,
  listVariantLinksByAccount,
  listProductLinksByAccount,
  deleteVariantLink,
  deleteProductLink,
  listVariantLinksByVariant,
  listProductLinksByProduct,
} from './links';
import type { CommerceProvider } from './providers/types';
import { ingestShopifyImage, ingestShopifyImageForVariant } from './providers/shopify/ingest-image';
import { getProductById } from '@/lib/db/products';
import { getExternalProductByExternalId } from './external-catalog';

export interface BulkImportResult {
  productsCreated: number;
  variantsLinked: number;
  errors: string[];
}

export interface UnlinkedCounts {
  products: number;
  variants: number;
}

/**
 * Count unlinked external products and variants for an account
 */
export async function countUnlinkedExternals(
  teamId: number,
  accountId: number
): Promise<UnlinkedCounts> {
  // Get all linked external product IDs
  const linkedProductLinks = await listProductLinksByAccount(teamId, accountId);
  const linkedProductExternalIds = new Set(
    linkedProductLinks
      .filter((l) => l.status === 'linked')
      .map((l) => l.externalProductId)
  );

  // Get all linked external variant IDs
  const linkedVariantLinks = await listVariantLinksByAccount(teamId, accountId);
  const linkedVariantExternalIds = new Set(
    linkedVariantLinks
      .filter((l) => l.status === 'linked')
      .map((l) => l.externalVariantId)
  );

  // Count total external products
  const productCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(externalProducts)
    .where(
      and(
        eq(externalProducts.teamId, teamId),
        eq(externalProducts.accountId, accountId)
      )
    );
  const totalProducts = productCountResult[0]?.count ?? 0;

  // Count total external variants
  const variantCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(externalVariants)
    .where(
      and(
        eq(externalVariants.teamId, teamId),
        eq(externalVariants.accountId, accountId)
      )
    );
  const totalVariants = variantCountResult[0]?.count ?? 0;

  return {
    products: Math.max(0, totalProducts - linkedProductExternalIds.size),
    variants: Math.max(0, totalVariants - linkedVariantExternalIds.size),
  };
}

/**
 * Get unlinked external products for an account
 */
export async function getUnlinkedExternalProducts(
  teamId: number,
  accountId: number,
  limit: number = 50
) {
  // Get linked external product IDs
  const linkedProductIds = await db
    .select({ externalProductId: productLinks.externalProductId })
    .from(productLinks)
    .where(
      and(
        eq(productLinks.accountId, accountId),
        eq(productLinks.status, 'linked')
      )
    );

  const linkedIds = linkedProductIds.map((r) => r.externalProductId);

  // Get unlinked products
  if (linkedIds.length > 0) {
    return await db
      .select()
      .from(externalProducts)
      .where(
        and(
          eq(externalProducts.teamId, teamId),
          eq(externalProducts.accountId, accountId),
          notInArray(externalProducts.externalProductId, linkedIds)
        )
      )
      .limit(limit);
  }

  // If no linked products, return all
  return await db
    .select()
    .from(externalProducts)
    .where(
      and(
        eq(externalProducts.teamId, teamId),
        eq(externalProducts.accountId, accountId)
      )
    )
    .limit(limit);
}

/**
 * Get unlinked external variants for an external product
 */
export async function getUnlinkedExternalVariants(
  teamId: number,
  accountId: number,
  externalProductId: string
) {
  // Get linked variant IDs for this account
  const linkedVariantIds = await db
    .select({ externalVariantId: variantLinks.externalVariantId })
    .from(variantLinks)
    .where(
      and(
        eq(variantLinks.accountId, accountId),
        eq(variantLinks.status, 'linked')
      )
    );

  const linkedIds = linkedVariantIds.map((r) => r.externalVariantId);

  // Get unlinked variants
  if (linkedIds.length > 0) {
    return await db
      .select()
      .from(externalVariants)
      .where(
        and(
          eq(externalVariants.teamId, teamId),
          eq(externalVariants.accountId, accountId),
          eq(externalVariants.externalProductId, externalProductId),
          notInArray(externalVariants.externalVariantId, linkedIds)
        )
      );
  }

  return await db
    .select()
    .from(externalVariants)
    .where(
      and(
        eq(externalVariants.teamId, teamId),
        eq(externalVariants.accountId, accountId),
        eq(externalVariants.externalProductId, externalProductId)
      )
    );
}

/**
 * Create a canonical product from an external product
 */
async function createCanonicalProduct(
  teamId: number,
  title: string | null,
  category: string = 'imported'
) {
  const now = new Date();

  // Ensure we have a valid title - use a fallback if null
  const productTitle = title?.trim() || 'Untitled Product';

  const [product] = await db
    .insert(products)
    .values({
      teamId,
      title: productTitle,
      category,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return product;
}

/**
 * Create a canonical variant from an external variant
 */
async function createCanonicalVariant(
  teamId: number,
  productId: number,
  title: string | null,
  sku: string | null,
  imageUrl?: string | undefined
) {
  const now = new Date();

  // Ensure we have a valid title - use a fallback if null
  const variantTitle = title?.trim() || 'Default';

  const [variant] = await db
    .insert(productVariants)
    .values({
      teamId,
      productId,
      title: variantTitle,
      sku: sku || null,
      createdAt: now,
      updatedAt: now,
      imageUrl
    })
    .returning();

  return variant;
}

/**
 * Bulk import and link all unlinked external products/variants
 */
export async function bulkImportAndLink(
  teamId: number,
  accountId: number,
  provider: CommerceProvider
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    productsCreated: 0,
    variantsLinked: 0,
    errors: [],
  };

  try {
    // First, process completely unlinked products (create new canonical products)
    const batchSize = 20;
    let hasMore = true;

    while (hasMore) {
      const unlinkedProducts = await getUnlinkedExternalProducts(
        teamId,
        accountId,
        batchSize
      );

      if (unlinkedProducts.length === 0) {
        hasMore = false;
        break;
      }

      for (const extProduct of unlinkedProducts) {
        try {
          // 1. Create canonical product
          const product = await createCanonicalProduct(
            teamId,
            extProduct.title,
            extProduct.productType || 'imported'
          );

          // 2. Get unlinked variants for this external product (needed for image fallback)
          const unlinkedVariants = await getUnlinkedExternalVariants(
            teamId,
            accountId,
            extProduct.externalProductId
          );

          // 3. Ingest product image if available (use product featured image or any variant image)
          const productImageUrl =
            extProduct.featuredImageUrl ||
            (unlinkedVariants.find(v => v.featuredImageUrl)?.featuredImageUrl || null);

          if (productImageUrl) {
            const uploadedFileId = await ingestShopifyImage({
              teamId,
              shopifyImageUrl: productImageUrl,
              filename: extProduct.title || 'product',
            });

            if (uploadedFileId) {
              // Get the uploaded file to get the blob URL
              const uploadedFile = await db.query.uploadedFiles.findFirst({
                where: eq(uploadedFiles.id, uploadedFileId),
              });
              if (uploadedFile?.blobUrl) {
                // Update product with image URL
                await db
                  .update(products)
                  .set({ imageUrl: uploadedFile.blobUrl })
                  .where(eq(products.id, product.id));
              }
            }
          }

          // 4. Create product link
          await createProductLink(teamId, {
            productId: product.id,
            accountId,
            provider,
            externalProductId: extProduct.externalProductId,
          });

          result.productsCreated++;

          // 5. Create canonical variants and links
          for (const extVariant of unlinkedVariants) {
            try {
              const variant = await createCanonicalVariant(
                teamId,
                product.id,
                extVariant.title || 'Default',
                extVariant.sku,
                productImageUrl || undefined
              );

              await createVariantLink(teamId, {
                variantId: variant.id,
                accountId,
                provider,
                externalProductId: extProduct.externalProductId,
                externalVariantId: extVariant.externalVariantId,
              });

              // Ingest variant image if available (and not already ingested)
              // If variant has no image, use the product's featured image
              const variantImageUrl = extVariant.featuredImageUrl || productImageUrl;
              if (variantImageUrl && !extVariant.uploadedFileId) {
                await ingestShopifyImageForVariant(
                  teamId,
                  extVariant.id,
                  variantImageUrl,
                  extVariant.title || undefined
                );
              }

              result.variantsLinked++;
            } catch (err) {
              const msg = `Failed to link variant ${extVariant.externalVariantId}: ${err instanceof Error ? err.message : String(err)}`;
              console.error('[BulkImport]', msg);
              result.errors.push(msg);
            }
          }
        } catch (err) {
          const msg = `Failed to import product ${extProduct.externalProductId}: ${err instanceof Error ? err.message : String(err)}`;
          console.error('[BulkImport]', msg);
          result.errors.push(msg);
        }
      }

      // If we got fewer than batchSize, we're done
      if (unlinkedProducts.length < batchSize) {
        hasMore = false;
      }
    }

    // Second, process linked products that have unlinked variants (link variants to existing canonical products)
    const linkedProductLinks = await listProductLinksByAccount(teamId, accountId);
    const linkedProductExternalIds = linkedProductLinks
      .filter((l) => l.status === 'linked')
      .map((l) => l.externalProductId);

    for (const externalProductId of linkedProductExternalIds) {
      const unlinkedVariants = await getUnlinkedExternalVariants(
        teamId,
        accountId,
        externalProductId
      );

      if (unlinkedVariants.length === 0) {
        continue;
      }

      // Get the canonical product from the product link
      const productLink = linkedProductLinks.find(
        (l) => l.externalProductId === externalProductId && l.status === 'linked'
      );
      if (!productLink) {
        continue;
      }

      const canonicalProductId = productLink.productId;

      // Create canonical variants and link them
      for (const extVariant of unlinkedVariants) {
        try {
          const variant = await createCanonicalVariant(
            teamId,
            canonicalProductId,
            extVariant.title || 'Default',
            extVariant.sku
          );

          await createVariantLink(teamId, {
            variantId: variant.id,
            accountId,
            provider,
            externalProductId,
            externalVariantId: extVariant.externalVariantId,
          });

          // Ingest variant image if available (and not already ingested)
          // If variant has no image, use the external product's featured image
          const externalProduct = await getExternalProductByExternalId(accountId, externalProductId);
          const productImageUrl = externalProduct?.featuredImageUrl || null;
          const variantImageUrl = extVariant.featuredImageUrl || productImageUrl;
          if (variantImageUrl && !extVariant.uploadedFileId) {
            await ingestShopifyImageForVariant(
              teamId,
              extVariant.id,
              variantImageUrl,
              extVariant.title || undefined
            );
          }

          result.variantsLinked++;
        } catch (err) {
          const msg = `Failed to link variant ${extVariant.externalVariantId}: ${err instanceof Error ? err.message : String(err)}`;
          console.error('[BulkImport]', msg);
          result.errors.push(msg);
        }
      }
    }
  } catch (err) {
    const msg = `Bulk import failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[BulkImport]', msg);
    result.errors.push(msg);
  }

  return result;
}

/**
 * Process bulk import job (called by cron worker)
 */
export async function processBulkImportJob(
  jobId: number,
  teamId: number,
  accountId: number,
  provider: CommerceProvider
): Promise<{ result: BulkImportResult; isComplete: boolean }> {
  const result = await bulkImportAndLink(teamId, accountId, provider);
  return { result, isComplete: true };
}

/**
 * Delete result interface
 */
export interface DeleteBulkImportResult {
  productsDeleted: number;
  variantsDeleted: number;
  linksDeleted: number;
}

/**
 * Delete all products and variants that were bulk imported from a specific account
 * This deletes:
 * - All product_links and variant_links for the account
 * - All canonical products/variants that are ONLY linked to this account (no other links)
 */
export async function deleteBulkImportedProducts(
  teamId: number,
  accountId: number
): Promise<DeleteBulkImportResult> {
  const result: DeleteBulkImportResult = {
    productsDeleted: 0,
    variantsDeleted: 0,
    linksDeleted: 0,
  };

  // 1. Get all variant_links for this account
  const variantLinksToDelete = await listVariantLinksByAccount(teamId, accountId);
  const variantIdsToCheck = new Set(
    variantLinksToDelete.map((link) => link.variantId)
  );

  // 2. Get all product_links for this account
  const productLinksToDelete = await listProductLinksByAccount(teamId, accountId);
  const productIdsToCheck = new Set(
    productLinksToDelete.map((link) => link.productId)
  );

  // 3. Delete all variant_links for this account
  for (const link of variantLinksToDelete) {
    await deleteVariantLink(teamId, link.id);
    result.linksDeleted++;
  }

  // 4. Delete all product_links for this account
  for (const link of productLinksToDelete) {
    await deleteProductLink(teamId, link.id);
    result.linksDeleted++;
  }

  // 5. Delete variants that have no remaining links
  for (const variantId of variantIdsToCheck) {
    const remainingLinks = await listVariantLinksByVariant(teamId, variantId);
    if (remainingLinks.length === 0) {
      // No remaining links, safe to delete (verify team ownership)
      await db
        .delete(productVariants)
        .where(and(eq(productVariants.id, variantId), eq(productVariants.teamId, teamId)));
      result.variantsDeleted++;
    }
  }

  // 6. Delete products that have no remaining links
  for (const productId of productIdsToCheck) {
    const remainingLinks = await listProductLinksByProduct(teamId, productId);
    if (remainingLinks.length === 0) {
      // No remaining links, safe to delete
      // First check if product has variants that still exist (shouldn't happen after step 5, but just in case)
      const variants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, productId),
            eq(productVariants.teamId, teamId)
          )
        );

      if (variants.length === 0) {
        // Verify team ownership before deleting
        await db
          .delete(products)
          .where(and(eq(products.id, productId), eq(products.teamId, teamId)));
        result.productsDeleted++;
      }
    }
  }

  return result;
}

