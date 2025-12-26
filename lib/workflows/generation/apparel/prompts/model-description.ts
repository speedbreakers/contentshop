export const getModelDescriptionPrompt = (args: {
  custom: string;
  modelSummary: string;
  positiveSummary: string;
  negativeSummary?: string;
  moodboardStrength: "strict" | "inspired";
}) => {
  let prompt =
    "You are generating a model description for an ecommerce catalog image.\n" +
    "Context:\n" +
    "- moodboard_model_summary is a summary of MULTIPLE different models/images the user uploaded.\n" +
    "- The final generation will include ONLY ONE model.\n" +
    "Priority rules:\n" +
    "- Use moodboard_model_summary to generate a detailed description of ONE representative model.\n" +
    "- If custom_instructions contains ANY model/human-subject guidance, use it to generate the model description WITHOUT FAIL.\n" +
    "- If neither contains usable model detail, choose default.\n" +
    "- The description should only contain details of 1 model. DO NOT describe multiple models or people.\n" +
    "Output must be STRICT JSON:\n" +
    "{model_description: string}\n" +
    "Guidelines for model_description:\n" +
    "- Write a detailed visual description of ONE model that is coherent and consistent.\n" +
    "- If moodboard_model_summary mentions multiple people, pick ONE and describe only that one.\n" +
    "- Describe pose/framing/styling/vibe and general appearance cues; do not describe the garment.\n" +
    "- Avoid sensitive inferences: no ethnicity, no exact age (ok: child/teen/adult), no medical attributes.\n" +
    `\ncustom_instructions:\n${args.custom || "(empty)"}\n` +
    `\nmoodboard_model_summary:\n${args.modelSummary || "(empty)"}\n` +
    `\nmoodboard_positive_references:\n${args.positiveSummary || "(empty)"}\n`;

  if (args.moodboardStrength === "strict" && args.negativeSummary) {
    prompt += `\nmoodboard_negative_references (styles to AVOID):\n${args.negativeSummary}\n`;
  }

  return prompt;
};
