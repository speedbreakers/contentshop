/**
 * Shopify Webhook Verification and Handlers
 *
 * Verifies webhook authenticity via HMAC and provides handler skeletons.
 */

import crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC signature
 *
 * Shopify sends webhooks with X-Shopify-Hmac-Sha256 header.
 * The signature is a base64-encoded HMAC-SHA256 of the raw request body.
 */
export function verifyWebhookHmac(body: string, hmacHeader: string): boolean {
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientSecret) {
    console.error('[Shopify Webhook] SHOPIFY_CLIENT_SECRET not configured');
    return false;
  }

  const computedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(body, 'utf8')
    .digest('base64');

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(computedHmac)
    );
  } catch {
    return false;
  }
}

/**
 * Extract webhook metadata from request headers
 */
export interface WebhookMetadata {
  topic: string;
  shopDomain: string;
  apiVersion: string;
  webhookId: string;
}

export function extractWebhookMetadata(headers: Headers): WebhookMetadata {
  return {
    topic: headers.get('X-Shopify-Topic') || '',
    shopDomain: headers.get('X-Shopify-Shop-Domain') || '',
    apiVersion: headers.get('X-Shopify-API-Version') || '',
    webhookId: headers.get('X-Shopify-Webhook-Id') || '',
  };
}

/**
 * Webhook topic handlers (skeletons for Phase 2)
 */

export type WebhookTopic =
  | 'app/uninstalled'
  | 'products/create'
  | 'products/update'
  | 'products/delete';

export interface WebhookHandlerContext {
  teamId: number;
  accountId: number;
  shopDomain: string;
}

/**
 * Handle app/uninstalled webhook
 * Mark the commerce account as disconnected and revoke access.
 */
export async function handleAppUninstalled(
  _context: WebhookHandlerContext,
  _payload: unknown
): Promise<void> {
  // TODO (Phase 2): Implement
  // - Update commerce_accounts.status = 'disconnected'
  // - Set commerce_accounts.app_uninstalled_at = now()
  // - Clear access_token
  console.log('[Webhook] app/uninstalled received - implementation pending');
}

/**
 * Handle products/create webhook
 * Optionally add new products to the external catalog.
 */
export async function handleProductsCreate(
  _context: WebhookHandlerContext,
  _payload: unknown
): Promise<void> {
  // TODO (Phase 2): Implement
  // - Parse product data from payload
  // - Upsert to external_products
  // - Upsert variants to external_variants
  console.log('[Webhook] products/create received - implementation pending');
}

/**
 * Handle products/update webhook
 * Sync product changes to the external catalog.
 */
export async function handleProductsUpdate(
  _context: WebhookHandlerContext,
  _payload: unknown
): Promise<void> {
  // TODO (Phase 2): Implement
  // - Parse product data from payload
  // - Update external_products
  // - Update external_variants
  // - Check if any linked canonical products need attention
  console.log('[Webhook] products/update received - implementation pending');
}

/**
 * Handle products/delete webhook
 * Mark external products as deleted and break links.
 */
export async function handleProductsDelete(
  _context: WebhookHandlerContext,
  _payload: unknown
): Promise<void> {
  // TODO (Phase 2): Implement
  // - Mark external_products as deleted (soft delete or remove)
  // - Set variant_links.status = 'broken' for affected links
  // - Set product_links.status = 'broken' for affected links
  console.log('[Webhook] products/delete received - implementation pending');
}

/**
 * Route webhook to appropriate handler
 */
export async function routeWebhook(
  topic: WebhookTopic,
  context: WebhookHandlerContext,
  payload: unknown
): Promise<void> {
  switch (topic) {
    case 'app/uninstalled':
      return handleAppUninstalled(context, payload);
    case 'products/create':
      return handleProductsCreate(context, payload);
    case 'products/update':
      return handleProductsUpdate(context, payload);
    case 'products/delete':
      return handleProductsDelete(context, payload);
    default:
      console.warn(`[Webhook] Unhandled topic: ${topic}`);
  }
}

