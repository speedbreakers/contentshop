/**
 * External Variants API
 *
 * GET /api/commerce/accounts/[accountId]/variants - List external variants for an account
 */

import { getTeamForUser } from '@/lib/db/queries';
import { getCommerceAccountById } from '@/lib/commerce/accounts';
import {
  listExternalVariants,
  countExternalVariants,
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
  const externalProductId = searchParams.get('product_id') || undefined;
  const search = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Get variants
  const variants = await listExternalVariants(team.id, {
    accountId: id,
    externalProductId,
    search,
    limit: Math.min(limit, 200),
    offset,
  });

  // Get total count
  const total = await countExternalVariants(team.id, id);

  return Response.json({
    variants,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + variants.length < total,
    },
  });
}
