import { getTeamForUser } from '@/lib/db/queries';
import { getGenerationJobById, type GenerationJobMetadata } from '@/lib/db/generation-jobs';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

/**
 * GET /api/generation-jobs/[jobId]/download
 * 
 * Download the zip file for a completed generation batch.
 * Only available for successful jobs with a zip file.
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
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  // Only allow download for successful jobs
  if (job.status !== 'success') {
    return Response.json(
      { error: 'Batch not completed yet' },
      { status: 400 }
    );
  }

  const meta = job.metadata as GenerationJobMetadata | null;
  const zipUrl = meta?.zipUrl;
  
  if (!zipUrl) {
    return Response.json(
      { error: 'Zip file not available' },
      { status: 404 }
    );
  }

  // Fetch zip from blob storage
  const res = await fetch(zipUrl);
  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch zip file' }, { status: 502 });
  }

  // Stream zip file to user
  const timestamp = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="generation-${job.id}-${timestamp}.zip"`);
  headers.set('Cache-Control', 'private, max-age=0, no-store');

  return new Response(res.body, { status: 200, headers });
}

