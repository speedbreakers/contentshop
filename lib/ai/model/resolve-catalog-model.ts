import { z } from 'zod';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '@/lib/ai/shared/json';
import { fetchAsBytes } from '@/lib/ai/shared/image-fetch';

export type ResolvedCatalogModel = {
  model_description: string;
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
  moodboardStrength?: 'strict' | 'inspired';
  moodboard?: {
    styleProfile?: Record<string, unknown>;
    positiveSummary?: string;
    negativeSummary?: string;
  } | null;
}): Promise<ResolvedCatalogModel> {
  const custom = String(args.custom_instructions ?? '').trim();
  const styleProfile = (args.moodboard?.styleProfile ?? {}) as Record<string, unknown>;
  const modelSummary = String(styleProfile.models_analysis_summary ?? '').trim();
  const positiveSummary = String(styleProfile.reference_positive_summary ?? '').trim();
  const negativeSummary = String(styleProfile.reference_negative_summary ?? '').trim();

  if (!custom && !modelSummary && !positiveSummary) {
    return { model_description: DEFAULT_MODEL_DESC, source: 'default', confidence: 0 };
  }

  let prompt =
    'You are generating a model description for an ecommerce catalog image.\n' +
    'Context:\n' +
    '- moodboard_model_summary is a summary of MULTIPLE different models/images the user uploaded.\n' +
    '- The final generation will include ONLY ONE model.\n' +
    'Priority rules:\n' +
    '- Use moodboard_model_summary to generate a detailed description of ONE representative model.\n' +
    '- If custom_instructions contains ANY model/human-subject guidance, use it to generate the model description WITHOUT FAIL.\n' +
    '- If neither contains usable model detail, choose default.\n' +
    '- The description should only contain details of 1 model. DO NOT describe multiple models or people.\n' +
    'Output must be STRICT JSON:\n' +
    '{model_description: string}\n' +
    'Guidelines for model_description:\n' +
    '- Write a detailed visual description of ONE model that is coherent and consistent.\n' +
    '- If moodboard_model_summary mentions multiple people, pick ONE and describe only that one.\n' +
    '- Describe pose/framing/styling/vibe and general appearance cues; do not describe the garment.\n' +
    '- Avoid sensitive inferences: no ethnicity, no exact age (ok: child/teen/adult), no medical attributes.\n' +
    `\ncustom_instructions:\n${custom || '(empty)'}\n` +
    `\nmoodboard_model_summary:\n${modelSummary || '(empty)'}\n` +
    `\nmoodboard_positive_references:\n${positiveSummary || '(empty)'}\n`;


  if (args.moodboardStrength === 'strict' && negativeSummary) {
    prompt += `\nmoodboard_negative_references (styles to AVOID):\n${negativeSummary}\n`;
  }

  const result: any = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  } as any);

  const parsed = parseJsonWithSchema(String(result?.text ?? ''), combinedModelSchema);
  const desc = String(parsed.model_description ?? '').trim();
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  if (!desc) {
    return { model_description: DEFAULT_MODEL_DESC, confidence };
  }

  return {
    model_description: desc,
    confidence,
  };
}


