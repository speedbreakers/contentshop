import { fetchAsBytes } from "@/lib/ai/shared/image-fetch";
import { parseJsonWithSchema } from "@/lib/ai/shared/json";
import { getCombinedBackgroundDescriptionPrompt } from "@/lib/workflows/generation/apparel/prompts/background-description-combined";
import { getBackgroundDescriptionGenerationPrompt } from "@/lib/workflows/generation/apparel/prompts/background-description-from-image";
import { generateText } from "ai";
import { z } from "zod";

export type ResolvedCatalogBackground = {
  background_description: string;
  confidence: number;
};

export const STUDIO_DEFAULT_BACKGROUND =
  "Clean studio backdrop (light neutral), soft even lighting, realistic soft shadow, no props.";

const combinedBackgroundSchema = z.object({
  background_description: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
});

const uploadedBackgroundSchema = z.object({
  background_description: z.string().default(""),
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
  moodboardStrength?: "strict" | "inspired";
  moodboard?: {
    styleProfile?: Record<string, unknown>;
  } | null;
}) {
  const bgUrl = String(args.backgroundImageUrl ?? "").trim();
  if (bgUrl) {
    const img = await fetchAsBytes(bgUrl);
    const prompt = getBackgroundDescriptionGenerationPrompt();

    const result: any = await generateText({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: img.bytes, mimeType: img.mimeType },
          ],
        },
      ],
    } as any);

    const parsed = parseJsonWithSchema(
      String(result?.text ?? ""),
      uploadedBackgroundSchema
    );
    const desc = String(parsed.background_description ?? "").trim();
    if (desc) {
      return {
        background_description: desc,
        confidence: Math.max(
          0.75,
          Math.min(1, Number(parsed.confidence ?? 0.9))
        ),
      } satisfies ResolvedCatalogBackground;
    }
    // If the model fails, continue to combined fallback below.
  }

  const custom = String(args.custom_instructions ?? "").trim();

  // Extract moodboard data handling multiple formats
  const mb = args.moodboard;
  const styleProfile = (mb?.styleProfile ?? {}) as Record<string, unknown>;

  const backgroundSummary = styleProfile.backgrounds_analysis_summary ?? "";
  const positiveRefs = styleProfile.reference_positive_summary ?? "";
  const negativeRefs = styleProfile.reference_negative_summary ?? "";

  const strength = args.moodboardStrength ?? "inspired";

  if (!custom && !backgroundSummary && !positiveRefs) {
    return {
      background_description: STUDIO_DEFAULT_BACKGROUND,
      confidence: 0,
    } satisfies ResolvedCatalogBackground;
  }

  const prompt = getCombinedBackgroundDescriptionPrompt({
    custom,
    backgroundSummary,
    positiveRefs,
    negativeRefs,
    strength,
  });

  const result: any = await generateText({
    model: "google/gemini-2.5-flash-lite",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  } as any);

  const parsed = parseJsonWithSchema(
    String(result?.text ?? ""),
    combinedBackgroundSchema
  );
  const desc = String(parsed.background_description ?? "").trim();
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  if (!desc) {
    return {
      background_description: STUDIO_DEFAULT_BACKGROUND,
      confidence,
    } satisfies ResolvedCatalogBackground;
  }

  return {
    background_description: desc,
    confidence,
  } satisfies ResolvedCatalogBackground;
}
