/**
 * Commerce Provider Types
 *
 * Core types and interfaces for the commerce integration layer.
 * Supports multiple providers: Shopify (v1), Amazon, Meesho (future).
 */

// ============================================================================
// Provider Enums
// ============================================================================

export type CommerceProvider = 'shopify' | 'amazon' | 'meesho';

export type AccountStatus = 'connected' | 'disconnected';

export type JobType =
  | 'shopify.catalog_sync'
  | 'shopify.bulk_import'
  | 'shopify.publish_variant_media'
  | 'shopify.ingest_images';

export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';

export type LinkStatus = 'linked' | 'broken' | 'unlinked';

export type PublishStatus = 'pending' | 'success' | 'failed';

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncProgress {
  cursor?: string | null;
  processed?: number;
  total?: number;
  lastProductId?: string;
}

export interface SyncResult {
  productsProcessed: number;
  variantsProcessed: number;
  errors: string[];
}

// ============================================================================
// Publish Types
// ============================================================================

export interface PublishParams {
  accountId: number;
  externalProductId: string;
  externalVariantId: string;
  imageUrl: string;
  filename: string;
}

export interface PublishResult {
  mediaId: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// External Product/Variant Types
// ============================================================================

export interface ExternalProductData {
  externalProductId: string;
  title: string;
  handle?: string;
  status?: string;
  productType?: string;
  vendor?: string;
  tags?: string;
  featuredImageUrl?: string;
  raw?: Record<string, unknown>;
}

export interface ExternalVariantData {
  externalProductId: string;
  externalVariantId: string;
  title?: string;
  sku?: string;
  price?: string;
  selectedOptions?: Array<{ name: string; value: string }>;
  featuredImageUrl?: string;
  raw?: Record<string, unknown>;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Commerce provider interface.
 * Each provider (Shopify, Amazon, Meesho) implements this interface.
 */
export interface CommerceProviderInterface {
  /**
   * Sync catalog from the external store.
   * Populates external_products and external_variants tables.
   */
  syncCatalog(
    accountId: number,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ result: SyncResult; nextCursor?: string | null }>;

  /**
   * Publish a generated image to an external variant.
   * Creates media in the external store and attaches to the variant.
   */
  publishVariantMedia(params: PublishParams): Promise<PublishResult>;

  /**
   * Verify webhook signature.
   * Returns true if the webhook is authentic.
   */
  verifyWebhook(request: Request): Promise<boolean>;
}

// ============================================================================
// OAuth Types (Shopify-specific for now)
// ============================================================================

export interface OAuthTokenResponse {
  accessToken: string;
  scope: string;
}

export interface OAuthInstallParams {
  shop: string;
  state: string;
  redirectUri: string;
}

// ============================================================================
// Shopify-specific Types
// ============================================================================

export interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
  featuredMedia?: {
    preview?: {
      image?: {
        url: string;
      };
    };
  };
  variants: {
    edges: Array<{
      node: ShopifyVariantNode;
    }>;
  };
}

export interface ShopifyVariantNode {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  image?: {
    url: string;
  };
}

export interface ShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyStagedTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShopifyUserError {
  field?: string[];
  message: string;
  code?: string;
}

