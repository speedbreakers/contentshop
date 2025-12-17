/**
 * Commerce Account API (single account)
 *
 * GET /api/commerce/accounts/[accountId] - Get account details
 * PATCH /api/commerce/accounts/[accountId] - Update account (rename, etc.)
 * DELETE /api/commerce/accounts/[accountId] - Disconnect/delete account
 */

import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  getCommerceAccountById,
  updateCommerceAccount,
  disconnectCommerceAccount,
  softDeleteCommerceAccount,
} from '@/lib/commerce/accounts';

const updateSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
});

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const account = await getCommerceAccountById(team.id, id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json({
    account: {
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
    },
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { display_name } = parsed.data;

  const account = await updateCommerceAccount(team.id, id, {
    displayName: display_name,
  });

  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json({
    account: {
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      status: account.status,
      shopDomain: account.shopDomain,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  // Check for action query param
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'disconnect') {
    // Mark as disconnected but don't delete
    const account = await disconnectCommerceAccount(team.id, id);
    if (!account) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }
    return Response.json({ success: true, status: 'disconnected' });
  }

  // Default: soft delete
  const account = await softDeleteCommerceAccount(team.id, id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json({ success: true, status: 'deleted' });
}

