/**
 * Shopify OAuth Callback Route
 *
 * Handles the OAuth callback from Shopify after user authorization.
 * Exchanges the authorization code for an access token and creates/updates the commerce account.
 *
 * GET /api/integrations/shopify/callback?code=xxx&hmac=xxx&shop=xxx&state=xxx&timestamp=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForToken,
  verifyHmac,
  validateShopDomain,
  sanitizeShopDomain,
} from '@/lib/commerce/providers/shopify/oauth';
import {
  createCommerceAccount,
  findCommerceAccountByShopDomain,
  updateAccessToken,
} from '@/lib/commerce/accounts';

// Cookie names (must match install route)
const OAUTH_STATE_COOKIE = 'shopify_oauth_state';
const OAUTH_TEAM_COOKIE = 'shopify_oauth_team';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();

  // Extract query parameters
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  // Validate required parameters
  if (!code || !shop || !state || !hmac) {
    return redirectWithError('Missing required OAuth parameters');
  }

  // Verify state matches (CSRF protection)
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    return redirectWithError('Invalid OAuth state - please try again');
  }

  // Get team ID from cookie
  const teamIdStr = cookieStore.get(OAUTH_TEAM_COOKIE)?.value;
  if (!teamIdStr) {
    return redirectWithError('Session expired - please try again');
  }
  const teamId = parseInt(teamIdStr, 10);
  if (isNaN(teamId)) {
    return redirectWithError('Invalid session - please try again');
  }

  // Clear OAuth cookies
  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_TEAM_COOKIE);

  // Validate shop domain
  const sanitizedShop = sanitizeShopDomain(shop);
  if (!validateShopDomain(sanitizedShop)) {
    return redirectWithError('Invalid shop domain');
  }

  // Verify HMAC signature
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'hmac') {
      params[key] = value;
    }
  });

  const isValidHmac = verifyHmac(params, hmac);
  if (!isValidHmac) {
    return redirectWithError('Invalid HMAC signature - authentication failed');
  }

  try {
    // Exchange code for access token
    const { accessToken, scope } = await exchangeCodeForToken(sanitizedShop, code);

    // Check if this shop is already connected to this team
    const existingAccount = await findCommerceAccountByShopDomain(teamId, sanitizedShop);

    if (existingAccount) {
      // Update existing account (reconnection)
      await updateAccessToken(teamId, existingAccount.id, accessToken, scope);
    } else {
      // Create new commerce account
      await createCommerceAccount(teamId, {
        provider: 'shopify',
        displayName: sanitizedShop.replace('.myshopify.com', ''),
        shopDomain: sanitizedShop,
        accessToken,
        scopes: scope,
      });
    }

    // Redirect to storefronts page with success
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${baseUrl}/dashboard/storefronts?connected=${encodeURIComponent(sanitizedShop)}`
    );
  } catch (error) {
    console.error('[Shopify OAuth Error]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return redirectWithError(`Failed to connect: ${message}`);
  }
}

function redirectWithError(error: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.redirect(
    `${baseUrl}/dashboard/storefronts?error=${encodeURIComponent(error)}`
  );
}

