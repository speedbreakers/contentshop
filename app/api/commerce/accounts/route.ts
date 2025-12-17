/**
 * Commerce Accounts API
 *
 * GET /api/commerce/accounts - List all connected commerce accounts
 * POST /api/commerce/accounts - Create a new commerce account (manual, non-OAuth)
 */

import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  listCommerceAccounts,
  createCommerceAccount,
} from '@/lib/commerce/accounts';

const createSchema = z.object({
  provider: z.enum(['shopify', 'amazon', 'meesho']),
  display_name: z.string().min(1).max(255),
  shop_domain: z.string().optional(),
  access_token: z.string().optional(),
  scopes: z.string().optional(),
});

export async function GET() {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await listCommerceAccounts(team.id);

  // Return accounts without sensitive data
  const sanitizedAccounts = accounts.map((account) => ({
    id: account.id,
    provider: account.provider,
    displayName: account.displayName,
    status: account.status,
    shopDomain: account.shopDomain,
    scopes: account.scopes,
    installedAt: account.installedAt,
    appUninstalledAt: account.appUninstalledAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));

  return Response.json({ accounts: sanitizedAccounts });
}

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { provider, display_name, shop_domain, access_token, scopes } = parsed.data;

  const account = await createCommerceAccount(team.id, {
    provider,
    displayName: display_name,
    shopDomain: shop_domain,
    accessToken: access_token,
    scopes,
  });

  if (!account) {
    return Response.json(
      { error: 'Failed to create commerce account' },
      { status: 500 }
    );
  }

  return Response.json(
    {
      account: {
        id: account.id,
        provider: account.provider,
        displayName: account.displayName,
        status: account.status,
        shopDomain: account.shopDomain,
        scopes: account.scopes,
        installedAt: account.installedAt,
        createdAt: account.createdAt,
      },
    },
    { status: 201 }
  );
}

