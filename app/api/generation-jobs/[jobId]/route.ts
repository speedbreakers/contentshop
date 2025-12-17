import { getTeamForUser } from '@/lib/db/queries';
import { getGenerationJobById } from '@/lib/db/generation-jobs';
import { getImagesForGenerationJob, getVariantGenerationById } from '@/lib/db/generations';
import { signVariantImageToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

/**
 * GET /api/generation-jobs/[jobId]
 * 
 * Get the status of a generation job and its images (for polling).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const id = parseId(jobId);
  if (!id) return Response.json({ error: 'Invalid jobId' }, { status: 400 });

  const job = await getGenerationJobById(team.id, id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

  // Get generation details if job is complete
  let generation = null;
  if (job.generationId) {
    generation = await getVariantGenerationById(team.id, job.generationId);
  }

  // Get images (either from generation or from progress)
  const rawImages = await getImagesForGenerationJob(team.id, id);
  
  // Sign image URLs
  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const images = rawImages.map((img) => {
    const sig = signVariantImageToken({ imageId: img.id, teamId: team.id, exp });
    return {
      ...img,
      url: `/api/variant-images/${img.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
    };
  });

  return Response.json({
    job: {
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
    },
    generation,
    images,
  });
}

