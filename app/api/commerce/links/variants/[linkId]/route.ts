/**
 * Single Variant Link API
 *
 * GET /api/commerce/links/variants/[linkId] - Get link details
 * DELETE /api/commerce/links/variants/[linkId] - Unlink (delete)
 */

import { getTeamForUser } from '@/lib/db/queries';
import { getVariantLinkById, deleteVariantLink } from '@/lib/commerce/links';

interface RouteParams {
  params: Promise<{ linkId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { linkId } = await params;
  const id = parseInt(linkId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid link ID' }, { status: 400 });
  }

  const link = await getVariantLinkById(team.id, id);
  if (!link) {
    return Response.json({ error: 'Link not found' }, { status: 404 });
  }

  return Response.json({ link });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { linkId } = await params;
  const id = parseInt(linkId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid link ID' }, { status: 400 });
  }

  const link = await deleteVariantLink(team.id, id);
  if (!link) {
    return Response.json({ error: 'Link not found' }, { status: 404 });
  }

  return Response.json({ success: true });
}

