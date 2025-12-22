import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getGenerationJobById, createGenerationJob, type GenerationJobMetadata } from '@/lib/db/generation-jobs';
import { checkCredits, deductCredits } from '@/lib/payments/credits';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

/**
 * POST /api/generation-jobs/[jobId]/retry
 * 
 * Retry a failed generation job with the same parameters.
 * Only failed jobs can be retried.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const id = parseId(jobId);
  if (!id) return Response.json({ error: 'Invalid jobId' }, { status: 400 });

  const failedJob = await getGenerationJobById(team.id, id);
  if (!failedJob) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  // Only allow retry for failed jobs
  if (failedJob.status !== 'failed') {
    return Response.json(
      { error: 'Can only retry failed jobs' },
      { status: 400 }
    );
  }

  const meta = failedJob.metadata as GenerationJobMetadata | null;
  const numberOfVariations = meta?.numberOfVariations ?? 1;

  // Prevent retrying a retry attempt.
  // We only allow retrying "original" failed jobs (retryAttempt undefined/0).
  if (meta && typeof (meta as any).retryOfJobId === 'number') {
    return Response.json(
      { error: 'Retry attempts cannot be retried. Please retry the original job instead.' },
      { status: 400 }
    );
  }

  // Verify credits before retrying (fail fast)
  const creditCheck = await checkCredits(team.id, 'image', numberOfVariations);

  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: 'insufficient_credits',
        reason: creditCheck.reason,
        remaining: creditCheck.remaining,
        required: numberOfVariations,
        upgradeUrl: '/dashboard/subscription',
      },
      { status: 402 }
    );
  }

  // If overage required, check if confirmation was provided
  if (creditCheck.isOverage) {
    const confirmOverage = request.headers.get('x-confirm-overage');
    if (confirmOverage !== 'true') {
      return Response.json(
        {
          requiresOverageConfirmation: true,
          overageCount: creditCheck.overageCount,
          overageCost: creditCheck.overageCost,
          remaining: creditCheck.remaining,
        },
        { status: 200 }
      );
    }
  }

  // Deduct credits immediately
  const user = await getUser();
  if (creditCheck.creditsId) {
    const referenceType = failedJob.type === 'image_edit' ? 'variant_edit' : 'variant_generation';
    await deductCredits(team.id, user?.id ?? null, 'image', numberOfVariations, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType,
      referenceId: undefined,
    });
  }

  // Enforce "IDs-only" job metadata for image inputs.
  // If the failed job predates this contract, require the user to recreate it.
  if (failedJob.type === 'image_generation') {
    const inputAny: any = meta?.input ?? {};
    const ids = Array.isArray(inputAny.product_image_file_ids) ? inputAny.product_image_file_ids : [];
    if (!ids.length) {
      return Response.json(
        { error: 'Cannot retry: job metadata is missing product_image_file_ids. Please re-create the job.' },
        { status: 400 }
      );
    }
  } else if (failedJob.type === 'image_edit') {
    const inputAny: any = meta?.input ?? {};
    const baseId = typeof inputAny.base_image_file_id === 'number' || typeof inputAny.base_image_file_id === 'string'
      ? Number(inputAny.base_image_file_id)
      : null;
    if (!baseId || !Number.isFinite(baseId) || baseId <= 0) {
      return Response.json(
        { error: 'Cannot retry: job metadata is missing base_image_file_id. Please re-create the job.' },
        { status: 400 }
      );
    }
  }

  // Create new job with same metadata (but do not carry legacy URL/cookie fields forward)
  const newJob = await createGenerationJob(team.id, {
    productId: failedJob.productId,
    variantId: failedJob.variantId,
    type: failedJob.type as 'image_generation' | 'image_edit',
    batchId: failedJob.batchId ?? null,
    metadata: {
      ...(meta ?? {}),
      retryOfJobId: failedJob.id,
      retryAttempt: ((meta as any)?.retryAttempt ?? 0) + 1,
      // Update credit info for the new job
      creditsId: creditCheck.creditsId,
      isOverage: creditCheck.isOverage,
    },
  });

  if (!newJob) {
    return Response.json({ error: 'Failed to create retry job' }, { status: 500 });
  }

  return Response.json(
    {
      job: {
        id: newJob.id,
        status: newJob.status,
        createdAt: newJob.createdAt,
      },
      message: 'Retry job queued successfully',
      originalJobId: failedJob.id,
    },
    { status: 201 }
  );
}

