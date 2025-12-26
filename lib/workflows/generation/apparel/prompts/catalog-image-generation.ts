export const buildCatalogImageGenerationPrompt = (args: {
  modelEnabled: boolean;
  modelImageUrl?: string | null;
  modelDescription?: string;
  backgroundDescription: string;
  styleAppendix?: string;
  positiveReferenceSummary?: string;
  negativeReferenceSummary?: string;
  analysisBits: string;
  customInstructions?: string;
}) => {
  let modelGuidanceLine = "";
  if (args.modelEnabled && args.modelImageUrl) {
    modelGuidanceLine = "Use Image 1 (Model Image) as the model.";
  } else if (args.modelEnabled && String(args.modelDescription ?? "").trim()) {
    modelGuidanceLine = `Model guidance: ${String(
      args.modelDescription ?? ""
    ).trim()}`;
  }

  return (
    [
      "Generate an ecommerce catalog image of the garment with high product fidelity.",
      "Do not change color, logos, branding, or garment structure. Make sure the garment is fully visible and not cut off by the edges of the image.",
      args.modelEnabled ? "Include a human model wearing the garment." : "",
      modelGuidanceLine,
      `Background: ${args.backgroundDescription}`,
      args.styleAppendix?.trim()
        ? `Brand style: ${args.styleAppendix.trim()}`
        : "",
      args.positiveReferenceSummary?.trim()
        ? `Style references (positive): ${args.positiveReferenceSummary.trim()}`
        : "",
      args.negativeReferenceSummary?.trim()
        ? `Avoid these styles (negative references): ${args.negativeReferenceSummary.trim()}`
        : "",
      args.analysisBits,
      args.customInstructions?.trim()
        ? `Additional instructions: ${args.customInstructions.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join(" ") + ""
  );
};
