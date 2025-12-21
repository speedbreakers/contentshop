import { generateText, experimental_generateImage as generateImage, UserModelMessage, UserContent, ImagePart } from 'ai';
import { put } from '@vercel/blob';
import { buildSameOriginAuthHeaders, coerceResultFileToBytes, fetchAsBytes, resolveUrl } from '../shared/image-fetch';
import type { GarmentAnalysis } from './analyze-garment';
import { writeFileSync } from 'fs';

export type GeneratedOutput = {
  blobUrl: string;
  prompt: string;
};

export async function generateApparelCatalogImages(args: {
  requestOrigin: string;
  authCookie?: string | null;
  teamId: number;
  variantId: number;
  generationId: number;
  numberOfVariations: number;
  garmentImageUrls: string[]; // typically front/back (masked if available)
  positiveMoodboardImageUrls?: string[];
  negativeMoodboardImageUrls?: string[];
  model_enabled?: boolean;
  model_description?: string;
  modelImageUrl?: string | null;
  styleAppendix?: string;
  positiveReferenceSummary?: string;
  negativeReferenceSummary?: string;
  analysis: GarmentAnalysis;
  background_description: string;
  custom_instructions: string;
  aspect_ratio: string;
}) {
  const n = Math.max(1, Math.min(10, Math.floor(args.numberOfVariations || 1)));

  const imgs = await Promise.all(
    args.garmentImageUrls
      .filter(Boolean)
      .map((u) => resolveUrl(args.requestOrigin, String(u)))
      .map(async (u) => {
        const headers = buildSameOriginAuthHeaders({ requestOrigin: args.requestOrigin, url: u, cookie: args.authCookie });
        return await fetchAsBytes(u, headers ? ({ headers } as any) : undefined);
      })
  );
  if (imgs.length === 0) throw new Error('No garment images available for generation');

  const modelEnabled = Boolean(args.model_enabled ?? false);
  const modelImg = modelEnabled && args.modelImageUrl ? await fetchAsBytes(args.modelImageUrl) : null;

  const analysisBits = [
    args.analysis.garment_type ? `Garment type: ${args.analysis.garment_type}.` : '',
    args.analysis.garment_category ? `Category: ${args.analysis.garment_category}.` : '',
    args.analysis.occasion ? `Occasion: ${args.analysis.occasion}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const finalPrompt =
    [
      'Generate an ecommerce catalog image of the garment with high product fidelity.',
      'Do not change color, logos, branding, or garment structure. Make sure the garment is fully visible and not cut off by the edges of the image.',
      modelEnabled ? 'Include a human model wearing the garment.' : '',
      modelEnabled && args.modelImageUrl ? `Use Image 1 (Model Image) as the model.` : modelEnabled && String(args.model_description ?? '').trim()
        ? `Model guidance: ${String(args.model_description ?? '').trim()}`
        : '',
      `Background: ${args.background_description}`,
      'Lighting: soft even studio lighting, realistic soft shadow.',
      args.styleAppendix?.trim() ? `Brand style: ${args.styleAppendix.trim()}` : '',
      args.positiveReferenceSummary?.trim()
        ? `Style references (positive): ${args.positiveReferenceSummary.trim()}`
        : '',
      args.negativeReferenceSummary?.trim()
        ? `Avoid these styles (negative references): ${args.negativeReferenceSummary.trim()}`
        : '',
      analysisBits,
      args.custom_instructions?.trim() ? `Additional instructions: ${args.custom_instructions.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' ') + '';

  const outputs: GeneratedOutput[] = [];

  for (let idx = 0; idx < n; idx++) {
    const messageContent: UserContent = [
      { type: 'text', text: finalPrompt },
    ]
    
    if (modelImg) {
      messageContent.push(
        { type: 'text', text: `Image 1 (Model Image):` }, 
        { type: 'image', image: modelImg.bytes }
      )
    }

    messageContent.push(
      { type: 'text', text: `Garment Images:` },
      ...imgs.map((ri) => ({ type: 'image', image: ri.bytes } as ImagePart))
    )

    const result: any = await generateText({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: args.aspect_ratio ?? '1:1',
          }
        }
      }
    });

    const files: any[] = Array.isArray(result?.files) ? result.files : [];
    const firstImage =
      files.find((f) => String(f?.mediaType ?? f?.mimeType ?? '').startsWith('image/')) ?? files[0];
    if (!firstImage) throw new Error('Gemini returned no files');

    const { bytes, mimeType } = coerceResultFileToBytes(firstImage);
    const ext =
      mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/png'
            ? 'png'
            : 'png';

    const pathname = `team-${args.teamId}/variant-${args.variantId}/apparel-catalog/${args.generationId}/${idx + 1}.${ext}`;
    const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
    const putRes = await put(pathname, blob, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    } as any);

    outputs.push({ blobUrl: putRes.url, prompt: finalPrompt });
  }

  return { outputs, finalPrompt };
}


