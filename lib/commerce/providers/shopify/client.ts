/**
 * Shopify GraphQL Client
 *
 * Factory to create authenticated GraphQL clients for Shopify Admin API.
 */

import { db } from '@/lib/db/drizzle';
import { commerceAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Use latest stable Shopify API version
const SHOPIFY_API_VERSION = '2025-01';

export interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface ShopifyClient {
  shopDomain: string;
  apiVersion: string;

  /**
   * Execute a GraphQL query
   */
  query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<ShopifyGraphQLResponse<T>>;

  /**
   * Execute a GraphQL mutation
   */
  mutation<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<ShopifyGraphQLResponse<T>>;
}

/**
 * Create a Shopify GraphQL client from account credentials
 */
export function createShopifyClient(
  shopDomain: string,
  accessToken: string
): ShopifyClient {
  const endpoint = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  async function executeGraphQL<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<ShopifyGraphQLResponse<T>> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as ShopifyGraphQLResponse<T>;

    // Log GraphQL errors but don't throw - let caller handle
    if (result.errors && result.errors.length > 0) {
      console.error('[Shopify GraphQL Errors]', JSON.stringify(result.errors, null, 2));
    }

    return result;
  }

  return {
    shopDomain,
    apiVersion: SHOPIFY_API_VERSION,
    query: executeGraphQL,
    mutation: executeGraphQL,
  };
}

/**
 * Get a Shopify client for a commerce account
 */
export async function getShopifyClient(accountId: number): Promise<ShopifyClient> {
  const account = await db.query.commerceAccounts.findFirst({
    where: and(
      eq(commerceAccounts.id, accountId),
      eq(commerceAccounts.provider, 'shopify')
    ),
  });

  if (!account) {
    throw new Error(`Commerce account not found: ${accountId}`);
  }

  if (account.status !== 'connected') {
    throw new Error(`Commerce account is disconnected: ${accountId}`);
  }

  if (!account.shopDomain || !account.accessToken) {
    throw new Error(`Commerce account missing credentials: ${accountId}`);
  }

  return createShopifyClient(account.shopDomain, account.accessToken);
}

/**
 * Get a Shopify client by team and shop domain
 */
export async function getShopifyClientByDomain(
  teamId: number,
  shopDomain: string
): Promise<ShopifyClient> {
  const account = await db.query.commerceAccounts.findFirst({
    where: and(
      eq(commerceAccounts.teamId, teamId),
      eq(commerceAccounts.shopDomain, shopDomain),
      eq(commerceAccounts.provider, 'shopify')
    ),
  });

  if (!account) {
    throw new Error(`Commerce account not found for shop: ${shopDomain}`);
  }

  if (account.status !== 'connected') {
    throw new Error(`Commerce account is disconnected: ${shopDomain}`);
  }

  if (!account.accessToken) {
    throw new Error(`Commerce account missing access token: ${shopDomain}`);
  }

  return createShopifyClient(shopDomain, account.accessToken);
}

