import { getTeamForUser } from '@/lib/db/queries';
import { getVariantImageById } from '@/lib/db/generations';
import { verifyVariantImageToken } from '@/lib/uploads/signing';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const id = parseId(imageId);
  if (!id) return Response.json({ error: 'Invalid imageId' }, { status: 400 });

  const url = new URL(request.url);
  const teamIdParam = Number(url.searchParams.get('teamId'));
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';

  const okSig = verifyVariantImageToken({ imageId: id, teamId: teamIdParam, exp, sig });

  // If signature missing/invalid, allow authenticated users (still team-scoped).
  const team = await getTeamForUser();
  if (!okSig && !team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = okSig ? teamIdParam : team!.id;

  const image = await getVariantImageById(teamId, id);
  if (!image) return Response.json({ error: 'Not found' }, { status: 404 });

  // Fetch blob data from stored URL and stream it through our app.
  const res = await fetch(image.url);
  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch blob' }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', res.headers.get('content-type') ?? 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=0, no-store');
  headers.set('X-Robots-Tag', 'noindex');

  const download = url.searchParams.get('download') === '1';
  if (download) {
    headers.set('Content-Disposition', `attachment; filename="image-${image.id}.png"`);
  }

  return new Response(res.body, { status: 200, headers });
}


