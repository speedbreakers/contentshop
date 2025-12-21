import { generateText, UserContent, ImagePart } from 'ai';
import { put } from '@vercel/blob';
import { buildSameOriginAuthHeaders, coerceResultFileToBytes, fetchAsBytes, resolveUrl } from '../shared/image-fetch';

export type GeneratedOutput = {
  blobUrl: string;
  prompt: string;
};

export async function generateNonApparelShootImages(args: {
  requestOrigin: string;
  authCookie?: string | null;
  teamId: number;
  variantId: number;
  generationId: number;
  numberOfVariations: number;
  productImageUrls: string[];
  model_enabled?: boolean;
  model_description?: string;
  modelImageUrl?: string | null;
  styleAppendix?: string;
  positiveReferenceSummary?: string;
  negativeReferenceSummary?: string;
  background_description: string;
  custom_instructions: string[]; // Per-variation instructions
  aspect_ratio: string;
}) {
  const n = Math.max(1, Math.min(10, Math.floor(args.numberOfVariations || 1)));

  // 1. Fetch static inputs (product images, optional model image)
  const productImgs = await Promise.all(
    args.productImageUrls
      .filter(Boolean)
      .map((u) => resolveUrl(args.requestOrigin, String(u)))
      .map(async (u) => {
        const headers = buildSameOriginAuthHeaders({ requestOrigin: args.requestOrigin, url: u, cookie: args.authCookie });
        return await fetchAsBytes(u, headers ? ({ headers } as any) : undefined);
      })
  );
  if (productImgs.length === 0) throw new Error('No product images available for generation');

  const modelEnabled = Boolean(args.model_enabled ?? false);
  const modelImg = modelEnabled && args.modelImageUrl ? await fetchAsBytes(args.modelImageUrl) : null;

  // 2. Build Base Prompt parts
  const basePromptParts = [
    'Generate an ecommerce product image with high product fidelity.\n',
    'CRITICAL: Do not change product color, shape, branding, or text.\n',
    'CRITICAL: Make sure the product is fully visible and not cut off.\n',
    modelEnabled ? 'Include a human model interacting with the product.' : '',
    modelEnabled && args.modelImageUrl
      ? `Use Image 1 (Model Image) as the model reference.`
      : modelEnabled && String(args.model_description ?? '').trim()
        ? `Model guidance: ${String(args.model_description ?? '').trim() ?? 'Use an appropriate model for the product based on Product Images.'}`
        : '',
    `Background: ${args.background_description}`,
    args.positiveReferenceSummary?.trim()
      ? `Style references (positive): ${args.positiveReferenceSummary.trim()}`
      : '',
    args.negativeReferenceSummary?.trim()
      ? `Avoid these styles (negative references): ${args.negativeReferenceSummary.trim()}`
      : '',
  ].filter(Boolean);

  const outputs: GeneratedOutput[] = [];
  let anchorImageUrl: string | null = null;

  // 3. Generation Loop
  for (let idx = 0; idx < n; idx++) {
    const isFirst = idx === 0;
    
    // Per-variation prompt
    const variationInstruction = args.custom_instructions[idx] || '';
    const currentPrompt = [
      ...basePromptParts,
      variationInstruction ? `Additional instructions: ${variationInstruction}` : '',
      !isFirst ? 'Maintain consistency with the previous image (Image 1) in terms of lighting, environment, and model appearance, but change the angle or pose as requested.' : '',
    ].join(' ');

    const messageContent: UserContent = [
      { type: 'text', text: currentPrompt },
    ];

    // Add images to content
    // Order matters for references.
    // Loop 1 (Anchor): [Model Image (opt)], [Product Images]
    // Loop 2+ (Variations): [Anchor Image], [Model Image (opt)], [Product Images]
    
    if (!isFirst && anchorImageUrl) {
      // Fetch the anchor image to use as reference
      // Note: We fetch it freshly to get bytes. 
      // Optimization: we could keep bytes in memory if not too large, but fetching ensures clean state.
      const anchorBytes = await fetchAsBytes(anchorImageUrl);
      messageContent.push(
        { type: 'text', text: 'Image 1 (Reference/Anchor):' },
        { type: 'image', image: anchorBytes.bytes }
      );
    }

    if (modelImg) {
      messageContent.push(
        { type: 'text', text: 'Model Reference:' },
        { type: 'image', image: modelImg.bytes }
      );
    }

    messageContent.push(
      { type: 'text', text: 'Product Images:' },
      ...productImgs.map((ri) => ({ type: 'image', image: ri.bytes } as ImagePart))
    );

    // Call GenAI
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

    // Process Result
    const files: any[] = Array.isArray(result?.files) ? result.files : [];
    const firstImage =
      files.find((f) => String(f?.mediaType ?? f?.mimeType ?? '').startsWith('image/')) ?? files[0];
    if (!firstImage) throw new Error('Gemini returned no files');

    const { bytes, mimeType } = coerceResultFileToBytes(firstImage);
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';

    const pathname = `team-${args.teamId}/variant-${args.variantId}/non-apparel-catalog/${args.generationId}/${idx + 1}.${ext}`;
    const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
    const putRes = await put(pathname, blob, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    } as any);

    const url = putRes.url;
    outputs.push({ blobUrl: url, prompt: currentPrompt });

    // Set anchor for next iterations
    if (isFirst) {
      anchorImageUrl = url;
    }
  }

  return { outputs };
}

