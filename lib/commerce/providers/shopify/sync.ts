/**
 * Shopify Catalog Sync
 *
 * Syncs products and variants from Shopify to the external catalog mirror.
 * Supports cursor-based pagination for chunked processing.
 */

import { getShopifyClient } from './client';
import { getCommerceAccountById } from '../../accounts';
import {
  bulkUpsertExternalProducts,
  bulkUpsertExternalVariants,
} from '../../external-catalog';
import type {
  SyncResult,
  SyncProgress,
  ShopifyProductNode,
  ShopifyPageInfo,
  ExternalProductData,
  ExternalVariantData,
} from '../types';

// GraphQL query for fetching products with variants
const FETCH_PRODUCTS_QUERY = `
  query FetchProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          status
          productType
          vendor
          tags
          featuredMedia {
            preview {
              image {
                url
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface SyncOptions {
  cursor?: string | null;
  limit?: number;
}

export interface SyncPageResult {
  products: ExternalProductData[];
  variants: ExternalVariantData[];
  pageInfo: ShopifyPageInfo;
}

/**
 * Fetch a single page of products from Shopify
 */
export async function fetchProductsPage(
  accountId: number,
  options: SyncOptions = {}
): Promise<SyncPageResult> {
  const { cursor = null, limit = 50 } = options;
  const client = await getShopifyClient(accountId);

  const response = await client.query<{
    products: {
      pageInfo: ShopifyPageInfo;
      edges: Array<{ node: ShopifyProductNode }>;
    };
  }>(FETCH_PRODUCTS_QUERY, {
    first: limit,
    after: cursor,
  });

  if (!response.data?.products) {
    throw new Error('Failed to fetch products from Shopify');
  }

  const { pageInfo, edges } = response.data.products;
  const products: ExternalProductData[] = [];
  const variants: ExternalVariantData[] = [];

  for (const { node: product } of edges) {
    // Map product data
    products.push({
      externalProductId: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status?.toLowerCase(),
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags?.join(', '),
      featuredImageUrl: product.featuredMedia?.preview?.image?.url,
      raw: product as unknown as Record<string, unknown>,
    });

    // Map variant data
    for (const { node: variant } of product.variants.edges) {
      variants.push({
        externalProductId: product.id,
        externalVariantId: variant.id,
        title: variant.title,
        sku: variant.sku || undefined,
        price: variant.price,
        selectedOptions: variant.selectedOptions,
        featuredImageUrl: variant.image?.url || product.featuredMedia?.preview?.image?.url,
        raw: variant as unknown as Record<string, unknown>,
      });
    }
  }

  return { products, variants, pageInfo };
}

/**
 * Sync a single page of products from Shopify and upsert to database
 */
export async function syncCatalogPage(
  teamId: number,
  accountId: number,
  options: SyncOptions = {}
): Promise<{ result: SyncResult; nextCursor: string | null; hasMore: boolean }> {
  const { cursor = null, limit = 50 } = options;

  // Fetch page from Shopify
  const pageResult = await fetchProductsPage(accountId, { cursor, limit });

  const errors: string[] = [];

  // Upsert products
  try {
    await bulkUpsertExternalProducts(
      teamId,
      accountId,
      'shopify',
      pageResult.products
    );
  } catch (err) {
    const msg = `Failed to upsert products: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[Sync]', msg);
    errors.push(msg);
  }

  // Upsert variants
  try {
    await bulkUpsertExternalVariants(
      teamId,
      accountId,
      'shopify',
      pageResult.variants
    );
  } catch (err) {
    const msg = `Failed to upsert variants: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[Sync]', msg);
    errors.push(msg);
  }

  const result: SyncResult = {
    productsProcessed: pageResult.products.length,
    variantsProcessed: pageResult.variants.length,
    errors,
  };

  return {
    result,
    nextCursor: pageResult.pageInfo.endCursor,
    hasMore: pageResult.pageInfo.hasNextPage,
  };
}

/**
 * Process a catalog sync job (called by cron worker)
 *
 * This function processes one page of products at a time.
 * Returns the new progress state and whether the job is complete.
 */
export async function processCatalogSyncJob(
  jobId: number,
  teamId: number,
  accountId: number,
  currentProgress: SyncProgress | null
): Promise<{
  progress: SyncProgress;
  isComplete: boolean;
  error?: string;
}> {
  const progress = currentProgress ?? { cursor: null, processed: 0 };

  try {
    // Verify account is still valid
    const account = await getCommerceAccountById(teamId, accountId);
    if (!account || account.status !== 'connected') {
      return {
        progress,
        isComplete: true,
        error: 'Account is disconnected or not found',
      };
    }

    // Sync one page
    const { result, nextCursor, hasMore } = await syncCatalogPage(
      teamId,
      accountId,
      { cursor: progress.cursor, limit: 50 }
    );

    // Update progress
    const newProgress: SyncProgress = {
      cursor: nextCursor,
      processed: (progress.processed ?? 0) + result.productsProcessed,
    };

    // Log progress
    console.log(
      `[Sync Job ${jobId}] Processed ${result.productsProcessed} products, ` +
      `${result.variantsProcessed} variants. Total: ${newProgress.processed}. ` +
      `Has more: ${hasMore}`
    );

    // Check for errors
    if (result.errors.length > 0) {
      console.warn(`[Sync Job ${jobId}] Errors:`, result.errors);
    }

    return {
      progress: newProgress,
      isComplete: !hasMore,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Sync Job ${jobId}] Error:`, errorMsg);

    return {
      progress,
      isComplete: true,
      error: errorMsg,
    };
  }
}

/**
 * Get product count from Shopify (for progress estimation)
 */
export async function getProductCount(accountId: number): Promise<number> {
  const client = await getShopifyClient(accountId);

  const response = await client.query<{
    productsCount: { count: number };
  }>(`
    query ProductCount {
      productsCount {
        count
      }
    }
  `);

  return response.data?.productsCount?.count ?? 0;
}
