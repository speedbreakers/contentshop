import { generateText } from 'ai';
import { put } from '@vercel/blob';
import { buildSameOriginAuthHeaders, coerceResultFileToBytes, fetchAsBytes, resolveUrl } from '../shared/image-fetch';

export type MaskedGarmentOutputs = {
  frontMaskedUrl?: string | null;
  backMaskedUrl?: string | null;
};

/**
 * Optional masking (background removal / clean flatlay).
 * Returns blob URLs for masked images (stored as metadata, not as variant_images outputs).
 */
export async function maskGarmentsIfNeeded(args: {
  requestOrigin: string;
  teamId: number;
  variantId: number;
  generationId: number;
  needMasking: boolean;
  frontUrl?: string | null;
  backUrl?: string | null;
  authCookie?: string | null;
}): Promise<MaskedGarmentOutputs> {
  if (!args.needMasking) return { frontMaskedUrl: null, backMaskedUrl: null };

  async function maskOne(url: string, view: 'front' | 'back') {
    const resolved = resolveUrl(args.requestOrigin, url);
    const headers = buildSameOriginAuthHeaders({ requestOrigin: args.requestOrigin, url: resolved, cookie: args.authCookie });
    const img = await fetchAsBytes(resolved, headers ? ({ headers } as any) : undefined);
    const prompt =
      'Remove the background and return a clean apparel cutout suitable for ecommerce catalog. ' +
      'Keep garment shape and colors unchanged. Use transparent background if possible.';

    const result: any = await generateText({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: img.bytes, mimeType: img.mimeType },
          ],
        },
      ],
    } as any);

    const files: any[] = Array.isArray(result?.files) ? result.files : [];
    const firstImage =
      files.find((f) => String(f?.mediaType ?? f?.mimeType ?? '').startsWith('image/')) ?? files[0];
    if (!firstImage) throw new Error('Gemini returned no files for masking');

    const { bytes, mimeType } = coerceResultFileToBytes(firstImage);
    const ext =
      mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/png'
            ? 'png'
            : 'png';

    const pathname = `team-${args.teamId}/variant-${args.variantId}/apparel-mask/${args.generationId}/${view}.${ext}`;
    const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
    const putRes = await put(pathname, blob, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    } as any);

    return putRes.url;
  }

  const out: MaskedGarmentOutputs = { frontMaskedUrl: null, backMaskedUrl: null };
  if (args.frontUrl) out.frontMaskedUrl = await maskOne(args.frontUrl, 'front');
  if (args.backUrl) out.backMaskedUrl = await maskOne(args.backUrl, 'back');
  return out;
}


