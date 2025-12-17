/**
 * External Products API
 *
 * GET /api/commerce/accounts/[accountId]/products - List external products for an account
 */

import { getTeamForUser } from '@/lib/db/queries';
import { getCommerceAccountById } from '@/lib/commerce/accounts';
import {
  listExternalProducts,
  countExternalProducts,
} from '@/lib/commerce/external-catalog';

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  // Verify account belongs to team
  const account = await getCommerceAccountById(team.id, id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Get products
  const products = await listExternalProducts(team.id, {
    accountId: id,
    search,
    limit: Math.min(limit, 100),
    offset,
  });

  // Get total count
  const total = await countExternalProducts(team.id, id);

  return Response.json({
    products,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + products.length < total,
    },
  });
}
