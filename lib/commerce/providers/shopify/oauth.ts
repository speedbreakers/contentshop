/**
 * Shopify OAuth Helpers
 *
 * Handles OAuth authorization code grant flow for Shopify app installation.
 */

import crypto from 'crypto';
import type { OAuthTokenResponse, OAuthInstallParams } from '../types';

// Required scopes for ContentShop integration
const SHOPIFY_SCOPES = ['read_products', 'write_products', 'write_files'].join(',');

/**
 * Validate Shopify shop domain format
 * Must be: alphanumeric + hyphens, ending with .myshopify.com
 */
export function validateShopDomain(shop: string): boolean {
  const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return pattern.test(shop);
}

/**
 * Sanitize shop domain (remove protocol, trailing slashes)
 */
export function sanitizeShopDomain(shop: string): string {
  return shop
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

/**
 * Build the Shopify OAuth install/authorize URL
 */
export function buildInstallUrl(params: OAuthInstallParams): string {
  const { shop, state, redirectUri } = params;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientId) {
    throw new Error('SHOPIFY_CLIENT_ID environment variable is not set');
  }

  const sanitizedShop = sanitizeShopDomain(shop);

  if (!validateShopDomain(sanitizedShop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }

  const url = new URL(`https://${sanitizedShop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', SHOPIFY_SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return url.toString();
}

/**
 * Verify HMAC signature from Shopify OAuth callback
 * Uses HMAC-SHA256 with the client secret
 */
export function verifyHmac(
  params: Record<string, string>,
  hmac: string
): boolean {
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error('SHOPIFY_CLIENT_SECRET environment variable is not set');
  }

  // Build the message from query params (excluding hmac, sorted alphabetically)
  const sortedParams = Object.keys(params)
    .filter((key) => key !== 'hmac')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const computedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(sortedParams, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(computedHmac, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<OAuthTokenResponse> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set');
  }

  const sanitizedShop = sanitizeShopDomain(shop);

  if (!validateShopDomain(sanitizedShop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }

  const response = await fetch(
    `https://${sanitizedShop}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to exchange code for token: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}

/**
 * Generate a cryptographically secure state/nonce for OAuth
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the OAuth redirect URI for the current environment
 */
export function getOAuthRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/integrations/shopify/callback`;
}

