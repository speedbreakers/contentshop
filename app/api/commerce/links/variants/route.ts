/**
 * Variant Links API
 *
 * POST /api/commerce/links/variants - Create a variant link
 * GET /api/commerce/links/variants - List variant links (with filters)
 */

import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  createVariantLink,
  listVariantLinksByVariant,
  listVariantLinksByAccount,
  isExternalVariantLinked,
} from '@/lib/commerce/links';
import { getCommerceAccountById } from '@/lib/commerce/accounts';

const createLinkSchema = z.object({
  canonical_variant_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  external_product_id: z.string().min(1),
  external_variant_id: z.string().min(1),
});

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variant_id');
  const accountId = searchParams.get('account_id');

  if (variantId) {
    const id = parseInt(variantId, 10);
    if (isNaN(id)) {
      return Response.json({ error: 'Invalid variant_id' }, { status: 400 });
    }
    const links = await listVariantLinksByVariant(team.id, id);
    return Response.json({ links });
  }

  if (accountId) {
    const id = parseInt(accountId, 10);
    if (isNaN(id)) {
      return Response.json({ error: 'Invalid account_id' }, { status: 400 });
    }
    const links = await listVariantLinksByAccount(team.id, id);
    return Response.json({ links });
  }

  return Response.json(
    { error: 'Provide variant_id or account_id query parameter' },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const {
    canonical_variant_id,
    account_id,
    external_product_id,
    external_variant_id,
  } = parsed.data;

  // Verify account belongs to team
  const account = await getCommerceAccountById(team.id, account_id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  // Check if external variant is already linked
  const alreadyLinked = await isExternalVariantLinked(account_id, external_variant_id);
  if (alreadyLinked) {
    return Response.json(
      { error: 'This external variant is already linked to a canonical variant' },
      { status: 409 }
    );
  }

  // Create the link
  const link = await createVariantLink(team.id, {
    variantId: canonical_variant_id,
    accountId: account_id,
    provider: account.provider as 'shopify',
    externalProductId: external_product_id,
    externalVariantId: external_variant_id,
  });

  if (!link) {
    return Response.json({ error: 'Failed to create link' }, { status: 500 });
  }

  return Response.json({ link }, { status: 201 });
}

