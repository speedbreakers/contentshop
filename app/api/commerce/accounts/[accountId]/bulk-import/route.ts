/**
 * Bulk Import & Link API
 *
 * POST /api/commerce/accounts/[accountId]/bulk-import - Start bulk import job
 * GET /api/commerce/accounts/[accountId]/bulk-import - Get unlinked counts / status
 * DELETE /api/commerce/accounts/[accountId]/bulk-import - Delete all imported products/variants for this account
 */

import { getTeamForUser } from '@/lib/db/queries';
import { getCommerceAccountById } from '@/lib/commerce/accounts';
import {
  countUnlinkedExternals,
  bulkImportAndLink,
  deleteBulkImportedProducts,
} from '@/lib/commerce/bulk-import';
import { createJob, getLatestJobByType, hasActiveJobOfType } from '@/lib/commerce/jobs';

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

  // Get unlinked counts
  const counts = await countUnlinkedExternals(team.id, id);

  // Get latest bulk import job status
  const job = await getLatestJobByType(team.id, id, 'shopify.bulk_import');

  return Response.json({
    unlinked: counts,
    job: job
      ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          error: job.error,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        }
      : null,
  });
}

export async function POST(_request: Request, { params }: RouteParams) {
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
      { error: 'Account is not connected' },
      { status: 400 }
    );
  }

  // Check for existing active job
  const hasActive = await hasActiveJobOfType(team.id, id, 'shopify.bulk_import');
  if (hasActive) {
    return Response.json(
      { error: 'A bulk import is already in progress' },
      { status: 409 }
    );
  }

  // Get unlinked counts first
  const counts = await countUnlinkedExternals(team.id, id);

  if (counts.products === 0) {
    return Response.json(
      { error: 'No unlinked products to import' },
      { status: 400 }
    );
  }

  // For smaller imports, run synchronously
  // For larger imports (50+ products), we'd use a background job
  if (counts.products <= 50) {
    try {
      const result = await bulkImportAndLink(
        team.id,
        id,
        account.provider as 'shopify'
      );

      return Response.json({
        status: 'success',
        result: {
          productsCreated: result.productsCreated,
          variantsLinked: result.variantsLinked,
          errors: result.errors,
        },
      });
    } catch (err) {
      console.error('[BulkImport] Error:', err);
      return Response.json(
        { error: err instanceof Error ? err.message : 'Import failed' },
        { status: 500 }
      );
    }
  }

  // For larger imports, create a background job
  const job = await createJob(team.id, {
    accountId: id,
    provider: 'shopify',
    type: 'shopify.bulk_import',
    metadata: { unlinkedProducts: counts.products, unlinkedVariants: counts.variants },
  });

  if (!job) {
    return Response.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  return Response.json(
    {
      status: 'queued',
      job: {
        id: job.id,
        status: job.status,
      },
      message: `Import job queued for ${counts.products} products`,
    },
    { status: 202 }
  );
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  try {
    const result = await deleteBulkImportedProducts(team.id, id);
    return Response.json({
      success: true,
      deleted: {
        products: result.productsDeleted,
        variants: result.variantsDeleted,
        links: result.linksDeleted,
      },
    });
  } catch (err) {
    console.error('[BulkImport] Delete error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
