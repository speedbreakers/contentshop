/**
 * Variant Links API
 *
 * POST /api/commerce/links/variants - Create a variant link
 * GET /api/commerce/links/variants - List variant links (with filters)
 */

import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import {
  createProductLink,
  createVariantLink,
  getProductLinkByExternalId,
  listVariantLinksByVariant,
  listVariantLinksByAccount,
  isExternalVariantLinked,
} from '@/lib/commerce/links';
import { getCommerceAccountById } from '@/lib/commerce/accounts';
import { getExternalProductByExternalId, getExternalVariantByExternalId } from '@/lib/commerce/external-catalog';
import { ingestShopifyImage, ingestShopifyImageForVariant } from '@/lib/commerce/providers/shopify/ingest-image';
import { db } from '@/lib/db/drizzle';
import { products, productVariants, uploadedFiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const linkExistingSchema = z.object({
  canonical_variant_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  external_product_id: z.string().min(1),
  external_variant_id: z.string().min(1),
});

const linkCreateCanonicalSchema = z.object({
  create_canonical_product: z.literal(true),
  account_id: z.number().int().positive(),
  external_product_id: z.string().min(1),
  external_variant_id: z.string().min(1),
});

const createLinkSchema = z.union([linkExistingSchema, linkCreateCanonicalSchema]);

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

  const { account_id, external_product_id, external_variant_id } = parsed.data;

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

  // Mode A: Link to an existing canonical variant
  if (!('create_canonical_product' in parsed.data)) {
    const { canonical_variant_id } = parsed.data;

    // Verify canonical variant belongs to team and load productId
    const canonicalVariant = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.teamId, team.id),
        eq(productVariants.id, canonical_variant_id)
      ),
    });
    if (!canonicalVariant) {
      return Response.json({ error: 'Canonical variant not found' }, { status: 404 });
    }

    // Ensure product_link exists for the canonical product ↔ external product
    const existingProductLink = await getProductLinkByExternalId(account_id, external_product_id);
    if (existingProductLink && existingProductLink.productId !== canonicalVariant.productId) {
      return Response.json(
        {
          error:
            'This external product is already linked to a different canonical product. Unlink it first.',
        },
        { status: 409 }
      );
    }
    if (!existingProductLink) {
      await createProductLink(team.id, {
        productId: canonicalVariant.productId,
        accountId: account_id,
        provider: account.provider as 'shopify',
        externalProductId: external_product_id,
      });
    }

    // Create the variant link
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

  // Mode B: Create canonical product (if needed) + canonical variant + links
  const extProduct = await getExternalProductByExternalId(account_id, external_product_id);
  if (!extProduct || extProduct.teamId !== team.id) {
    return Response.json({ error: 'External product not found' }, { status: 404 });
  }

  const extVariant = await getExternalVariantByExternalId(account_id, external_variant_id);
  if (
    !extVariant ||
    extVariant.teamId !== team.id ||
    extVariant.externalProductId !== external_product_id
  ) {
    return Response.json({ error: 'External variant not found' }, { status: 404 });
  }

  // If the external product is already linked, reuse the existing canonical product.
  // Otherwise, create a new canonical product and link it.
  const existingProductLink = await getProductLinkByExternalId(account_id, external_product_id);

  let canonicalProductId = existingProductLink?.productId ?? null;
  if (!canonicalProductId) {
    const now = new Date();
    const productTitle = extProduct.title?.trim() || 'Untitled Product';
    const category = extProduct.productType || 'imported';

    const [product] = await db
      .insert(products)
      .values({
        teamId: team.id,
        title: productTitle,
        category,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!product) {
      return Response.json({ error: 'Failed to create canonical product' }, { status: 500 });
    }

    canonicalProductId = product.id;

    // Ingest product image (prefer product featured image, else variant image)
    const productImageUrl = extProduct.featuredImageUrl || extVariant.featuredImageUrl || null;
    if (productImageUrl) {
      const uploadedFileId = await ingestShopifyImage({
        teamId: team.id,
        shopifyImageUrl: productImageUrl,
        filename: extProduct.title || 'product',
      });

      if (uploadedFileId) {
        const uploadedFile = await db.query.uploadedFiles.findFirst({
          where: eq(uploadedFiles.id, uploadedFileId),
        });
        if (uploadedFile?.blobUrl) {
          await db
            .update(products)
            .set({ imageUrl: uploadedFile.blobUrl, updatedAt: new Date() })
            .where(and(eq(products.teamId, team.id), eq(products.id, canonicalProductId)));
        }
      }
    }

    await createProductLink(team.id, {
      productId: canonicalProductId,
      accountId: account_id,
      provider: account.provider as 'shopify',
      externalProductId: external_product_id,
    });
  }

  // Create canonical variant
  {
    const now = new Date();
    const variantTitle = extVariant.title?.trim() || 'Default';
    const [canonicalVariant] = await db
      .insert(productVariants)
      .values({
        teamId: team.id,
        productId: canonicalProductId,
        title: variantTitle,
        sku: extVariant.sku || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!canonicalVariant) {
      return Response.json({ error: 'Failed to create canonical variant' }, { status: 500 });
    }

    const link = await createVariantLink(team.id, {
      variantId: canonicalVariant.id,
      accountId: account_id,
      provider: account.provider as 'shopify',
      externalProductId: external_product_id,
      externalVariantId: external_variant_id,
    });

    if (!link) {
      return Response.json({ error: 'Failed to create link' }, { status: 500 });
    }

    // Ingest variant image if present and not already ingested on external variant
    if (extVariant.featuredImageUrl && !extVariant.uploadedFileId) {
      await ingestShopifyImageForVariant(
        team.id,
        extVariant.id,
        extVariant.featuredImageUrl,
        extVariant.title || undefined
      );
    }

    return Response.json(
      {
        link,
        created: {
          canonicalProductId,
          canonicalVariantId: canonicalVariant.id,
        },
      },
      { status: 201 }
    );
  }

  // (unreachable)
}

