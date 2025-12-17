/**
 * Shopify Image Ingestion
 *
 * Downloads images from Shopify CDN and uploads them to Vercel Blob storage.
 */

import { put } from '@vercel/blob';
import { db } from '@/lib/db/drizzle';
import { uploadedFiles, externalVariants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createUploadedFile } from '@/lib/db/uploads';

export interface IngestShopifyImageInput {
  teamId: number;
  shopifyImageUrl: string;
  filename?: string;
}

/**
 * Ingest a Shopify image to Vercel Blob storage
 * Returns the uploaded_file_id
 */
export async function ingestShopifyImage(
  input: IngestShopifyImageInput
): Promise<number | null> {
  const { teamId, shopifyImageUrl, filename } = input;

  // Skip if no image
  if (!shopifyImageUrl) return null;

  try {
    // 1. Download from Shopify CDN
    const response = await fetch(shopifyImageUrl);
    if (!response.ok) {
      console.warn(`[IngestImage] Failed to fetch Shopify image: ${shopifyImageUrl} (${response.status})`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 2. Determine filename and extension
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg';

    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 50)
      : `shopify-${Date.now()}`;
    const finalFilename = `${safeName}.${ext}`;

    // 3. Upload to Vercel Blob
    const id = crypto.randomUUID();
    const pathname = `team-${teamId}/shopify-import/${Date.now()}-${id}-${finalFilename}`;
    const blob = new Blob([buffer], { type: contentType });

    const result = await put(pathname, blob, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 4. Create uploaded_files record
    const uploadedFile = await createUploadedFile(teamId, {
      kind: 'shopify_import',
      pathname: result.pathname,
      blobUrl: result.url,
      originalName: finalFilename,
      contentType,
      size: buffer.byteLength,
    });

    if (!uploadedFile) {
      console.error('[IngestImage] Failed to create uploaded_files record');
      return null;
    }

    return uploadedFile.id;
  } catch (error) {
    console.error('[IngestImage] Error ingesting image:', error);
    return null;
  }
}

/**
 * Ingest image and link to external variant
 */
export async function ingestShopifyImageForVariant(
  teamId: number,
  externalVariantId: number,
  shopifyImageUrl: string,
  variantTitle?: string
): Promise<number | null> {
  const filename = variantTitle
    ? variantTitle.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 50)
    : undefined;

  const uploadedFileId = await ingestShopifyImage({
    teamId,
    shopifyImageUrl,
    filename,
  });

  if (!uploadedFileId) return null;

  // Link to external variant
  await db
    .update(externalVariants)
    .set({ uploadedFileId })
    .where(eq(externalVariants.id, externalVariantId));

  return uploadedFileId;
}

