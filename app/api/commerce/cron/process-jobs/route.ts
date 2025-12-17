/**
 * Commerce & Generation Jobs Cron Worker
 *
 * GET /api/commerce/cron/process-jobs
 *
 * Processes queued commerce and generation jobs. Called by Vercel cron every minute.
 * Each invocation processes a batch of jobs within the function timeout.
 */

import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { commerceJobs } from '@/lib/db/schema';
import { processCatalogSyncJob } from '@/lib/commerce/providers/shopify/sync';
import type { SyncProgress } from '@/lib/commerce/providers/types';
import { getQueuedGenerationJobs } from '@/lib/db/generation-jobs';
import { processGenerationJob, processEditJob } from '@/lib/db/generations';

// Max duration for Pro plan (can be up to 300s with maxDuration config)
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret; in production, require it
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const startTime = Date.now();
  const results: Array<{
    id: number;
    type: string;
    status: 'success' | 'failed' | 'continued';
    error?: string;
  }> = [];

  try {
    // Fetch queued commerce jobs (batch of 2 to leave room for generation jobs)
    const commerceJobsList = await db.query.commerceJobs.findMany({
      where: eq(commerceJobs.status, 'queued'),
      limit: 2,
      orderBy: asc(commerceJobs.createdAt),
    });

    // Fetch queued generation jobs (batch of 2)
    const generationJobsList = await getQueuedGenerationJobs(2);

    console.log(`[Cron] Found ${commerceJobsList.length} queued commerce jobs, ${generationJobsList.length} queued generation jobs`);

    // Process commerce jobs
    for (const job of commerceJobsList) {
      // Check if we have enough time remaining (leave 10s buffer)
      const elapsed = Date.now() - startTime;
      if (elapsed > (maxDuration - 10) * 1000) {
        console.log('[Cron] Approaching timeout, stopping early');
        break;
      }

      try {
        // Mark job as running
        await db
          .update(commerceJobs)
          .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
          .where(eq(commerceJobs.id, job.id));

        // Process based on job type
        switch (job.type) {
          case 'shopify.catalog_sync':
            await processCatalogSync(job);
            break;

          case 'shopify.publish_variant_media':
            // TODO: Implement in Phase 5
            console.log(`[Cron] Publish job ${job.id} - not implemented yet`);
            await db
              .update(commerceJobs)
              .set({
                status: 'failed',
                error: 'Not implemented yet',
                completedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(commerceJobs.id, job.id));
            results.push({ id: job.id, type: job.type, status: 'failed', error: 'Not implemented' });
            break;

          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Cron] Commerce job ${job.id} error:`, errorMsg);

        await db
          .update(commerceJobs)
          .set({
            status: 'failed',
            error: errorMsg,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(commerceJobs.id, job.id));

        results.push({ id: job.id, type: job.type, status: 'failed', error: errorMsg });
      }
    }

    // Process generation jobs
    for (const job of generationJobsList) {
      // Check if we have enough time remaining (leave 30s buffer for generation jobs as they take longer)
      const elapsed = Date.now() - startTime;
      if (elapsed > (maxDuration - 30) * 1000) {
        console.log('[Cron] Approaching timeout, stopping early before generation jobs');
        break;
      }

      try {
        console.log(`[Cron] Processing generation job ${job.id} (type: ${job.type})`);

        let result;
        if (job.type === 'image_edit') {
          result = await processEditJob(job);
        } else {
          result = await processGenerationJob(job);
        }

        results.push({
          id: job.id,
          type: job.type,
          status: result.success ? 'success' : 'failed',
          error: result.error,
        });

        console.log(`[Cron] Generation job ${job.id} completed with status: ${result.success ? 'success' : 'failed'}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Cron] Generation job ${job.id} error:`, errorMsg);
        results.push({ id: job.id, type: job.type, status: 'failed', error: errorMsg });
      }
    }

    return Response.json({
      processed: results.length,
      results,
      elapsed: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Cron] Fatal error:', errorMsg);
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}

async function processCatalogSync(job: typeof commerceJobs.$inferSelect) {
  const progress = (job.progress as SyncProgress) ?? { cursor: null, processed: 0 };

  const result = await processCatalogSyncJob(
    job.id,
    job.teamId,
    job.accountId,
    progress
  );

  if (result.isComplete) {
    // Job is done
    await db
      .update(commerceJobs)
      .set({
        status: result.error ? 'failed' : 'success',
        progress: result.progress,
        error: result.error ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commerceJobs.id, job.id));

    console.log(
      `[Cron] Job ${job.id} completed. Status: ${result.error ? 'failed' : 'success'}, ` +
      `Processed: ${result.progress.processed} products`
    );
  } else {
    // More pages to process - keep job queued for next invocation
    await db
      .update(commerceJobs)
      .set({
        status: 'queued',
        progress: result.progress,
        updatedAt: new Date(),
      })
      .where(eq(commerceJobs.id, job.id));

    console.log(
      `[Cron] Job ${job.id} continuing. Processed: ${result.progress.processed} products so far`
    );
  }
}
