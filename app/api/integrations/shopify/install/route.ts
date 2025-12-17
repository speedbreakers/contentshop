/**
 * Shopify OAuth Install Route
 *
 * Initiates the OAuth authorization flow by redirecting to Shopify's authorize URL.
 *
 * GET /api/integrations/shopify/install?shop=mystore.myshopify.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildInstallUrl,
  generateOAuthState,
  getOAuthRedirectUri,
  validateShopDomain,
  sanitizeShopDomain,
} from '@/lib/commerce/providers/shopify/oauth';
import { getTeamForUser } from '@/lib/db/queries';

// Cookie name for OAuth state (CSRF protection)
const OAUTH_STATE_COOKIE = 'shopify_oauth_state';
const OAUTH_TEAM_COOKIE = 'shopify_oauth_team';

export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get shop domain from query params
  const { searchParams } = new URL(request.url);
  const shopParam = searchParams.get('shop');

  if (!shopParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: shop' },
      { status: 400 }
    );
  }

  const shop = sanitizeShopDomain(shopParam);

  if (!validateShopDomain(shop)) {
    return NextResponse.json(
      { error: 'Invalid shop domain. Must be a valid .myshopify.com domain.' },
      { status: 400 }
    );
  }

  // Check if SHOPIFY_CLIENT_ID is configured
  if (!process.env.SHOPIFY_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Shopify integration is not configured' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = generateOAuthState();
  const redirectUri = getOAuthRedirectUri();

  // Build the Shopify authorize URL
  const installUrl = buildInstallUrl({ shop, state, redirectUri });

  // Set state cookie for verification in callback (30 min expiry)
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30, // 30 minutes
    path: '/',
  });

  // Store team ID for callback
  cookieStore.set(OAUTH_TEAM_COOKIE, String(team.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30,
    path: '/',
  });

  // Redirect to Shopify OAuth
  return NextResponse.redirect(installUrl);
}

