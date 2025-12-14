import { getTeamForUser } from '@/lib/db/queries';
import { getUploadedFileById } from '@/lib/db/uploads';
import { verifyDownloadToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const id = parseId(fileId);
  if (!id) return Response.json({ error: 'Invalid fileId' }, { status: 400 });

  const url = new URL(request.url);
  const teamIdParam = Number(url.searchParams.get('teamId'));
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';

  // Signed URL access (no cookies required).
  const okSig = verifyDownloadToken({ fileId: id, teamId: teamIdParam, exp, sig });

  // If signature missing/invalid, allow authenticated users (still team-scoped).
  const team = await getTeamForUser();
  if (!okSig && !team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = okSig ? teamIdParam : team!.id;

  const file = await getUploadedFileById(teamId, id);
  if (!file) return Response.json({ error: 'Not found' }, { status: 404 });

  // Fetch blob data from the stored blobUrl and stream it through our app.
  const res = await fetch(file.blobUrl);
  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch blob' }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', file.contentType ?? res.headers.get('content-type') ?? 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=0, no-store');
  headers.set('X-Robots-Tag', 'noindex');

  const download = url.searchParams.get('download') === '1';
  if (download) {
    const name = file.originalName ?? 'download';
    headers.set('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`);
  }

  return new Response(res.body, { status: 200, headers });
}


