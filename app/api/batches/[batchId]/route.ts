import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { batches, generationJobs, variantImages } from '@/lib/db/schema';
import { aggregateBatchJobStatus, getBatchById, getBatchJobsWithVariantInfo, updateBatchStatus } from '@/lib/db/batches';
import { listSetItems } from '@/lib/db/sets';
import { listVariantImagesByIds } from '@/lib/db/generations';
import { signVariantImageToken } from '@/lib/uploads/signing';
import { refundCredits } from '@/lib/payments/credits';

export const runtime = 'nodejs';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const patchSchema = z.object({
  action: z.enum(['pause', 'resume']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;
  const id = parseId(batchId);
  if (!id) return Response.json({ error: 'Invalid batchId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const existing = await getBatchById(team.id, id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.action === 'pause') {
    // Only pause if not completed/canceled
    if (existing.status === 'success' || existing.status === 'failed' || existing.status === 'canceled') {
      return Response.json({ error: `Cannot pause a ${existing.status} batch` }, { status: 400 });
    }
    const updated = await updateBatchStatus(team.id, id, 'paused');
    return Response.json({ batch: updated }, { status: 200 });
  }

  // resume
  if (existing.status !== 'paused') {
    return Response.json({ error: 'Can only resume paused batches' }, { status: 400 });
  }
  const updated = await updateBatchStatus(team.id, id, 'queued');
  return Response.json({ batch: updated }, { status: 200 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;
  const id = parseId(batchId);
  if (!id) return Response.json({ error: 'Invalid batchId' }, { status: 400 });

  const batch = await getBatchById(team.id, id);
  if (!batch) return Response.json({ error: 'Not found' }, { status: 404 });

  const progress = await aggregateBatchJobStatus(team.id, id);
  const jobs = await getBatchJobsWithVariantInfo(team.id, id);

  // Outputs: show images in the shared batch folder (if present).
  const outputs: Array<{ id: number; url: string; createdAt: string }> = [];
  if (batch.folderId) {
    const items = await listSetItems(team.id, batch.folderId);
    const variantImageIds = items.filter((i) => i.itemType === 'variant_image').map((i) => i.itemId);
    const images = await listVariantImagesByIds(team.id, variantImageIds);
    const imageById = new Map(images.map((img) => [img.id, img]));

    const exp = Date.now() + 1000 * 60 * 60;
    for (const it of items) {
      if (it.itemType !== 'variant_image') continue;
      const img = imageById.get(it.itemId);
      if (!img) continue;
      const sig = signVariantImageToken({ imageId: img.id, teamId: team.id, exp });
      outputs.push({
        id: img.id,
        url: `/api/variant-images/${img.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
        createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : String(img.createdAt),
      });
      if (outputs.length >= 80) break;
    }
  }

  return Response.json({ batch, progress, jobs, outputs });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;
  const id = parseId(batchId);
  if (!id) return Response.json({ error: 'Invalid batchId' }, { status: 400 });

  const existing = await db.query.batches.findFirst({
    where: and(eq(batches.teamId, team.id), eq(batches.id, id)),
  });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  // Compute refund BEFORE canceling jobs (so we can read status/progress).
  // Refund = expected images - actually generated images.
  const jobs = await db
    .select({
      id: generationJobs.id,
      status: generationJobs.status,
      generationId: generationJobs.generationId,
      progress: generationJobs.progress,
      metadata: generationJobs.metadata,
      completedAt: generationJobs.completedAt,
    })
    .from(generationJobs)
    .where(and(eq(generationJobs.teamId, team.id), eq(generationJobs.batchId, id)));

  let expectedTotal = 0;
  const generationIds: number[] = [];

  // Credits metadata (same across batch jobs in our implementation)
  let creditsId: number | null = null;
  let isOverage: boolean = false;

  for (const j of jobs) {
    const meta: any = j.metadata ?? {};
    const n = typeof meta?.numberOfVariations === 'number' ? Number(meta.numberOfVariations) : 0;
    expectedTotal += Math.max(0, Math.floor(n || 0));
    if (typeof j.generationId === 'number' && Number.isFinite(j.generationId)) generationIds.push(j.generationId);

    if (!creditsId && typeof meta?.creditsId === 'number') creditsId = Number(meta.creditsId);
    if (typeof meta?.isOverage === 'boolean') isOverage = Boolean(meta.isOverage);
  }

  // Count actual generated images.
  let generatedTotal = 0;
  const uniqueGenIds = Array.from(new Set(generationIds));
  if (uniqueGenIds.length > 0) {
    const counts = await db
      .select({
        generationId: variantImages.generationId,
        count: sql<number>`count(*)`,
      })
      .from(variantImages)
      .where(and(eq(variantImages.teamId, team.id), inArray(variantImages.generationId, uniqueGenIds)))
      .groupBy(variantImages.generationId);
    const byGenId = new Map<number, number>();
    for (const r of counts) {
      if (typeof r.generationId === 'number') byGenId.set(r.generationId, Number(r.count ?? 0));
    }

    // If a job has a generationId, use that count; otherwise fall back to progress.
    for (const j of jobs) {
      if (typeof j.generationId === 'number' && byGenId.has(j.generationId)) {
        generatedTotal += byGenId.get(j.generationId)!;
      } else {
        const prog: any = j.progress ?? null;
        const completedImageIds = Array.isArray(prog?.completedImageIds) ? prog.completedImageIds : [];
        if (completedImageIds.length > 0) generatedTotal += completedImageIds.length;
        else if (typeof prog?.current === 'number') generatedTotal += Math.max(0, Math.floor(prog.current || 0));
      }
    }
  } else {
    for (const j of jobs) {
      const prog: any = j.progress ?? null;
      const completedImageIds = Array.isArray(prog?.completedImageIds) ? prog.completedImageIds : [];
      if (completedImageIds.length > 0) generatedTotal += completedImageIds.length;
      else if (typeof prog?.current === 'number') generatedTotal += Math.max(0, Math.floor(prog.current || 0));
    }
  }

  const notGenerated = Math.max(0, expectedTotal - generatedTotal);

  // Mark batch canceled (delete semantics for now).
  await db
    .update(batches)
    .set({ status: 'canceled', updatedAt: new Date(), completedAt: new Date() })
    .where(and(eq(batches.teamId, team.id), eq(batches.id, id)));

  // Cancel any queued jobs so execution halts for this batch.
  await db
    .update(generationJobs)
    .set({ status: 'canceled', updatedAt: new Date(), completedAt: new Date() })
    .where(and(eq(generationJobs.teamId, team.id), eq(generationJobs.batchId, id), inArray(generationJobs.status, ['queued'])));

  // Refund credits for images that were never generated.
  // We refund against the same credits period used for the upfront deduction (stored on jobs).
  if (creditsId && notGenerated > 0) {
    await refundCredits(team.id, null, 'image', notGenerated, {
      creditsId,
      isOverage,
      referenceType: 'batch_refund',
      referenceId: id,
    });
  }

  return Response.json({ ok: true, refunded: notGenerated }, { status: 200 });
}


