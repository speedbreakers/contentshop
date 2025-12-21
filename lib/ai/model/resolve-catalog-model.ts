import { z } from 'zod';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '@/lib/ai/shared/json';
import { fetchAsBytes } from '@/lib/ai/shared/image-fetch';

export type ResolvedCatalogModel = {
  model_description: string;
  source: 'uploaded_model' | 'custom_instructions' | 'moodboard_summary' | 'default';
  confidence: number;
};

const combinedModelSchema = z.object({
  chosen_source: z.enum(['custom_instructions', 'moodboard_summary', 'default']).default('default'),
  model_description: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0),
});

const DEFAULT_MODEL_DESC =
  'A neutral ecommerce model in a clean studio setting, natural pose, centered framing, unobtrusive styling.';

/**
 * Resolve model guidance for catalog generation.
 *
 * Priority:
 * - P0: modelImageUrl provided => describe THIS exact model (image-based).
 * - P1/P2: single LLM call chooses between custom instructions (only if model detail present)
 *          vs moodboard model summary.
 * - fallback: default model description.
 */
export async function resolveCatalogModel(args: {
  custom_instructions?: string | null;
  moodboard_model_summary?: string | null;
}): Promise<ResolvedCatalogModel> {
  const custom = String(args.custom_instructions ?? '').trim();
  const moodboard = String(args.moodboard_model_summary ?? '').trim();

  if (!custom && !moodboard) {
    return { model_description: DEFAULT_MODEL_DESC, source: 'default', confidence: 0 };
  }

  const prompt =
    'You are generating a model description for an ecommerce catalog image.\n' +
    'Context:\n' +
    '- moodboard_model_summary is a summary of MULTIPLE different models/images the user uploaded.\n' +
    '- The final generation will include ONLY ONE model.\n' +
    'Priority rules:\n' +
    '- If custom_instructions contains ANY model/human-subject guidance, use it to generate the model description.\n' +
    '- If custom_instructions contains NO model guidance, use moodboard_model_summary to generate a detailed description of ONE representative model.\n' +
    '- If neither contains usable model detail, choose default.\n' +
    '- The description should only contain details of 1 model. DO NOT describe multiple models or people.\n' +
    'Output must be STRICT JSON:\n' +
    '{chosen_source: \"custom_instructions\"|\"moodboard_summary\"|\"default\", model_description: string, confidence:number}\n' +
    'Guidelines for model_description:\n' +
    '- Write a detailed visual description of ONE model that is coherent and consistent.\n' +
    '- If moodboard_model_summary mentions multiple people, pick ONE and describe only that one.\n' +
    '- Describe pose/framing/styling/vibe and general appearance cues; do not describe the garment.\n' +
    '- Avoid sensitive inferences: no ethnicity, no exact age (ok: child/teen/adult), no medical attributes.\n' +
    `\ncustom_instructions:\n${custom || '(empty)'}\n` +
    `\nmoodboard_model_summary:\n${moodboard || '(empty)'}\n`;

  const result: any = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  } as any);

  const parsed = parseJsonWithSchema(String(result?.text ?? ''), combinedModelSchema);
  const desc = String(parsed.model_description ?? '').trim();
  const chosen = parsed.chosen_source;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  if (!desc || chosen === 'default') {
    return { model_description: DEFAULT_MODEL_DESC, source: 'default', confidence };
  }

  return {
    model_description: desc,
    source: chosen === 'custom_instructions' ? 'custom_instructions' : 'moodboard_summary',
    confidence,
  };
}


