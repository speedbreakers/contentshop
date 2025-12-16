/**
 * Shopify Catalog Sync
 *
 * Syncs products and variants from Shopify to the external catalog mirror.
 * Supports cursor-based pagination for chunked processing.
 */

import { getShopifyClient } from './client';
import type {
  SyncResult,
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
 * Sync catalog from Shopify (skeleton - full implementation in Phase 2)
 *
 * This is a skeleton that demonstrates the sync flow.
 * Full implementation will include:
 * - Upsert to external_products/external_variants tables
 * - Image ingestion
 * - Progress tracking via commerce_jobs
 */
export async function syncCatalog(
  accountId: number,
  options: SyncOptions = {}
): Promise<{ result: SyncResult; nextCursor: string | null }> {
  const { cursor = null, limit = 50 } = options;

  const pageResult = await fetchProductsPage(accountId, { cursor, limit });

  // TODO (Phase 2): Implement actual upsert logic
  // - upsertExternalProducts(teamId, accountId, pageResult.products)
  // - upsertExternalVariants(teamId, accountId, pageResult.variants)
  // - optionally ingest images

  const result: SyncResult = {
    productsProcessed: pageResult.products.length,
    variantsProcessed: pageResult.variants.length,
    errors: [],
  };

  return {
    result,
    nextCursor: pageResult.pageInfo.hasNextPage
      ? pageResult.pageInfo.endCursor
      : null,
  };
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

