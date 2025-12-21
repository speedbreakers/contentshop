import { z } from 'zod';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '@/lib/ai/shared/json';
import { fetchAsBytes } from '@/lib/ai/shared/image-fetch';
import { getBackgroundDescriptionGenerationPrompt, getBackgroundPrompt } from '../apparel/prompts';

export type ResolvedCatalogBackground = {
  background_description: string;
  source: 'uploaded_background' | 'custom_instructions' | 'moodboard_summary' | 'default';
  confidence: number;
};

export const STUDIO_DEFAULT_BACKGROUND =
  'Clean studio backdrop (light neutral), soft even lighting, realistic soft shadow, no props.';

const combinedBackgroundSchema = z.object({
  chosen_source: z.enum(['custom_instructions', 'moodboard_summary', 'default']).default('default'),
  background_description: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0),
});

const uploadedBackgroundSchema = z.object({
  background_description: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.9),
});

/**
 * Resolve catalog background description using priority:
 * - P0: uploaded background image (exact background prompt)
 * - P1/P2: combined LLM call that chooses between custom instructions vs moodboard summary
 * - fallback: studio default
 */
export async function resolveCatalogBackground(args: {
  backgroundImageUrl?: string | null;
  custom_instructions?: string | null;
  moodboard_background_summary?: string | null;
}) {
  const bgUrl = String(args.backgroundImageUrl ?? '').trim();
  if (bgUrl) {
    const img = await fetchAsBytes(bgUrl);
    const prompt = getBackgroundDescriptionGenerationPrompt();

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

    const parsed = parseJsonWithSchema(String(result?.text ?? ''), uploadedBackgroundSchema);
    const desc = String(parsed.background_description ?? '').trim();
    if (desc) {
      return {
        background_description: desc,
        source: 'uploaded_background',
        confidence: Math.max(0.75, Math.min(1, Number(parsed.confidence ?? 0.9))),
      } satisfies ResolvedCatalogBackground;
    }
    // If the model fails, continue to combined fallback below.
  }

  const custom = String(args.custom_instructions ?? '').trim();
  const moodboard = String(args.moodboard_background_summary ?? '').trim();

  if (!custom && !moodboard) {
    return {
      background_description: STUDIO_DEFAULT_BACKGROUND,
      source: 'default',
      confidence: 0,
    } satisfies ResolvedCatalogBackground;
  }

  const prompt =
    'You are generating a background prompt for an ecommerce catalog image.\n' +
    'Priority rules:\n' +
    '- Use custom_instructions ONLY if it contains any relevant background/setting/location/environment details.\n' +
    '- If custom_instructions has no relevant background detail, use moodboard_background_summary.\n' +
    '- If neither contains usable background detail, choose default.\n' +
    'Output must be STRICT JSON:\n' +
    '{chosen_source: \"custom_instructions\"|\"moodboard_summary\"|\"default\", background_description: string, confidence:number}\n' +
    'Guidelines for background_description:\n' +
    '- Concrete and visual.\n' +
    '- Include environment/setting, backdrop appearance, lighting, and overall tone.\n' +
    '- Avoid mentioning product/garment or changing it.\n' +
    `\ncustom_instructions:\n${custom || '(empty)'}\n` +
    `\nmoodboard_background_summary:\n${moodboard || '(empty)'}\n`;

  const result: any = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  } as any);

  const parsed = parseJsonWithSchema(String(result?.text ?? ''), combinedBackgroundSchema);
  const desc = String(parsed.background_description ?? '').trim();
  const chosen = parsed.chosen_source;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  if (!desc || chosen === 'default') {
    return {
      background_description: STUDIO_DEFAULT_BACKGROUND,
      source: 'default',
      confidence,
    } satisfies ResolvedCatalogBackground;
  }

  return {
    background_description: desc,
    source: chosen === 'custom_instructions' ? 'custom_instructions' : 'moodboard_summary',
    confidence,
  } satisfies ResolvedCatalogBackground;
}


