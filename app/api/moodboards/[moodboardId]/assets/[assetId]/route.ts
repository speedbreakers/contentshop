import { getTeamForUser } from '@/lib/db/queries';
import { getMoodboardById, removeMoodboardAsset } from '@/lib/db/moodboards';
import { recomputeMoodboardAssetSummaries } from '@/lib/moodboards/analysis';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ moodboardId: string; assetId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { moodboardId, assetId } = await params;
  const mid = parseId(moodboardId);
  const aid = parseId(assetId);
  if (!mid || !aid) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const board = await getMoodboardById(team.id, mid);
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 });

  const deleted = await removeMoodboardAsset(team.id, mid, aid);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });

  // Best-effort analysis: update moodboard style_profile summaries after removing assets.
  // Keep failures non-fatal for UX.
  try {
    const requestOrigin = new URL(_request.url).origin;
    const authCookie = _request.headers.get('cookie');
    await recomputeMoodboardAssetSummaries({
      teamId: team.id,
      moodboardId: mid,
      requestOrigin,
      authCookie,
    });
  } catch {
    // ignore
  }

  return Response.json({ ok: true });
}



