import { getTeamForUser } from '@/lib/db/queries';
import { getVariantById } from '@/lib/db/products';
import { listActiveGenerationJobsForVariant } from '@/lib/db/generation-jobs';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

/**
 * GET /api/products/[productId]/variants/[variantId]/generation-jobs
 *
 * Returns queued/running generation jobs for the variant (newest first).
 * Used by the variant assets page to restore in-progress jobs after reload.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const variant = await getVariantById(team.id, pid, vid);
  if (!variant) return Response.json({ error: 'Not found' }, { status: 404 });

  const items = await listActiveGenerationJobsForVariant(team.id, vid, { limit: 10 });
  return Response.json({
    items: items.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      error: job.error,
      metadata: job.metadata,
      generationId: job.generationId,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
  });
}


