/**
 * Catalog Sync API
 *
 * POST /api/commerce/accounts/[accountId]/sync - Start a catalog sync job
 * GET /api/commerce/accounts/[accountId]/sync - Get latest sync job status
 */

import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getCommerceAccountById } from '@/lib/commerce/accounts';
import {
  createJob,
  getLatestJobByType,
  hasActiveJobOfType,
} from '@/lib/commerce/jobs';

const syncOptionsSchema = z.object({
  create_canonical: z.boolean().default(false),
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

  // Verify account belongs to team
  const account = await getCommerceAccountById(team.id, id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  // Get latest sync job
  const job = await getLatestJobByType(team.id, id, 'shopify.catalog_sync');

  if (!job) {
    return Response.json({ job: null, message: 'No sync job found' });
  }

  return Response.json({
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  // Verify account belongs to team and is connected
  const account = await getCommerceAccountById(team.id, id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  if (account.status !== 'connected') {
    return Response.json(
      { error: 'Account is not connected. Please reconnect first.' },
      { status: 400 }
    );
  }

  // Parse options
  const body = await request.json().catch(() => ({}));
  const parsed = syncOptionsSchema.safeParse(body);
  const options = parsed.success ? parsed.data : { create_canonical: false };

  // Check if there's already an active sync job
  const hasActive = await hasActiveJobOfType(team.id, id, 'shopify.catalog_sync');
  if (hasActive) {
    return Response.json(
      { error: 'A sync is already in progress for this account' },
      { status: 409 }
    );
  }

  // Create a new sync job
  const job = await createJob(team.id, {
    accountId: id,
    provider: 'shopify',
    type: 'shopify.catalog_sync',
    metadata: {
      createCanonical: options.create_canonical,
    },
  });

  if (!job) {
    return Response.json({ error: 'Failed to create sync job' }, { status: 500 });
  }

  return Response.json(
    {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
      },
      message: 'Sync job queued successfully',
    },
    { status: 201 }
  );
}
