import { parseJsonWithSchema } from "@/lib/ai/shared/json";
import { getModelDescriptionPrompt } from "@/lib/workflows/generation/apparel/prompts/model-description";
import { generateText } from "ai";
import { z } from "zod";

export type ResolvedCatalogModel = {
  model_description: string;
  confidence: number;
};

const combinedModelSchema = z.object({
  model_description: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});

const DEFAULT_MODEL_DESC =
  "A neutral ecommerce model in a natural pose, centered framing, unobtrusive styling.";

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
  moodboardStrength?: "strict" | "inspired";
  moodboard?: {
    styleProfile?: Record<string, unknown>;
    positiveSummary?: string;
    negativeSummary?: string;
  } | null;
}): Promise<ResolvedCatalogModel> {
  const custom = String(args.custom_instructions ?? "").trim();
  const styleProfile = args.moodboard?.styleProfile ?? {};
  const modelSummary = String(styleProfile.models_analysis_summary).trim();
  const positiveSummary = String(
    styleProfile.reference_positive_summary
  ).trim();
  const negativeSummary = String(
    styleProfile.reference_negative_summary
  ).trim();

  if (!custom && !modelSummary && !positiveSummary) {
    return { model_description: DEFAULT_MODEL_DESC, confidence: 0 };
  }

  const prompt = getModelDescriptionPrompt({
    custom,
    modelSummary,
    positiveSummary,
    negativeSummary,
    moodboardStrength: args.moodboardStrength ?? "inspired",
  });

  const result: any = await generateText({
    model: "google/gemini-2.5-flash-lite",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  } as any);

  const parsed = parseJsonWithSchema(
    String(result?.text ?? ""),
    combinedModelSchema
  );
  const desc = String(parsed.model_description ?? "").trim();
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  if (!desc) {
    return { model_description: DEFAULT_MODEL_DESC, confidence };
  }

  return {
    model_description: desc,
    confidence,
  };
}
