import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { checkCredits, deductCredits } from '@/lib/payments/credits';
import { createGenerationJob, countActiveGenerationJobsForTeam } from '@/lib/db/generation-jobs';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

const bodySchema = z.object({
  base_image_url: z.string().min(1),
  base_label: z.string().optional().default(''),
  edit_instructions: z.string().optional().default(''),
  reference_image_url: z.string().optional().nullable().default(null),
  target_set_id: z.number().int().positive().optional().nullable().default(null),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  // Check credits before edit (1 credit for image edit)
  const numberOfVariations = 1;
  const creditCheck = await checkCredits(team.id, 'image', numberOfVariations);

  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: 'insufficient_credits',
        reason: creditCheck.reason,
        remaining: creditCheck.remaining,
        required: numberOfVariations,
        upgradeUrl: '/pricing',
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

  // Rate limit: max 3 active generation jobs per team
  const activeJobCount = await countActiveGenerationJobsForTeam(team.id);
  if (activeJobCount >= 3) {
    return Response.json(
      { error: 'Too many active generation jobs. Please wait for existing jobs to complete.' },
      { status: 429 }
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const user = await getUser();

  // Deduct credits immediately (before queuing)
  if (creditCheck.creditsId) {
    await deductCredits(team.id, user?.id ?? null, 'image', numberOfVariations, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType: 'variant_edit',
      referenceId: undefined, // Will be updated when job completes
    });
  }

  const baseLabel = parsed.data.base_label?.trim() ? String(parsed.data.base_label).trim() : 'image';
  const outputLabel = `edited-${baseLabel}`;

  // Create a job instead of processing synchronously
  const job = await createGenerationJob(team.id, {
    productId: pid,
    variantId: vid,
    type: 'image_edit',
    metadata: {
      schemaKey: 'edit.v1',
      targetSetId: parsed.data.target_set_id,
      input: {
        base_image_url: parsed.data.base_image_url,
        reference_image_url: parsed.data.reference_image_url,
        edit_instructions: parsed.data.edit_instructions,
        base_label: baseLabel,
        output_label: outputLabel,
      },
      prompt: parsed.data.edit_instructions,
      requestOrigin,
      authCookie: request.headers.get('cookie'),
      productTitle: product.title,
      productCategory: product.category,
      numberOfVariations: 1,
      // Store credit info for reference
      creditsId: creditCheck.creditsId,
      isOverage: creditCheck.isOverage,
    },
  });

  if (!job) {
    return Response.json({ error: 'Failed to create edit job' }, { status: 500 });
  }

  return Response.json(
    {
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
      },
      message: 'Edit job queued successfully',
    },
    { status: 202 }
  );
}


