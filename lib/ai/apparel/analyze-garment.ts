import { z } from 'zod';
import { generateText } from 'ai';
import { buildSameOriginAuthHeaders, fetchAsBytes, resolveUrl } from '../shared/image-fetch';
import { parseJsonWithSchema } from '../shared/json';
import { getGarmentAnalysisPrompt } from './prompts';

export const garmentAnalysisSchema = z.object({
  gender: z
    .preprocess((v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim().toLowerCase();
      if (!s) return null;
      if (['male', 'man', 'men', 'mens', 'm'].includes(s)) return 'male';
      if (['female', 'woman', 'women', 'womens', 'f'].includes(s)) return 'female';
      // treat unknown/unisex/other as null for v1
      if (['unisex', 'unknown', 'other', 'n/a', 'na', 'none'].includes(s)) return null;
      return null;
    }, z.enum(['male', 'female']).nullable())
    .optional()
    .default(null),
  garment_category: z
    .preprocess((v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim().toLowerCase();
      if (!s) return null;
      if (['top', 'tops', 'upper', 'upperwear', 'shirt', 'tshirt', 'tee'].includes(s)) return 'top';
      if (['bottom', 'bottoms', 'lower', 'lowerwear', 'pants', 'trousers', 'jeans'].includes(s)) return 'bottom';
      if (['fullbody', 'full', 'dress', 'jumpsuit', 'onepiece', 'one-piece'].includes(s)) return 'fullbody';
      return null;
    }, z.enum(['top', 'bottom', 'fullbody']).nullable())
    .optional()
    .default(null),
  garment_type: z.string().min(1).nullable().optional().default(null),
  occasion: z.string().min(1).nullable().optional().default(null),
  styling_suggestions: z
    .object({
      topwear: z.string().optional().default(''),
      bottomwear: z.string().optional().default(''),
      footwear: z.string().optional().default(''),
      notes: z.string().optional().default(''),
    })
    .default({ topwear: '', bottomwear: '', footwear: '', notes: '' }),
  is_bottom_jeans: z.boolean().optional().default(false),
});

export type GarmentAnalysis = z.infer<typeof garmentAnalysisSchema>;

export async function analyzeGarment(args: { requestOrigin: string; frontImageUrl: string; authCookie?: string | null }) {
  const url = resolveUrl(args.requestOrigin, args.frontImageUrl);
  const headers = buildSameOriginAuthHeaders({ requestOrigin: args.requestOrigin, url, cookie: args.authCookie });
  const img = await fetchAsBytes(url, headers ? ({ headers } as any) : undefined);

  const prompt = getGarmentAnalysisPrompt();
  
  const result: any = await generateText({
    model: 'google/gemini-2.5-flash-lite',
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

  return parseJsonWithSchema(String(result?.text ?? ''), garmentAnalysisSchema);
}


