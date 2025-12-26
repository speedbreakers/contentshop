export const getCombinedBackgroundDescriptionPrompt = (args: {
  custom: string;
  backgroundSummary: string;
  positiveRefs: string;
  negativeRefs?: string;
  strength: "strict" | "inspired";
}) => {
  let prompt =
    "You are a creative director and fashion photography expert.\n" +
    "You are generating a professional background description for an ecommerce fashion catalog image.\n" +
    "Priority rules:\n" +
    "- Use moodboard_background_summary and moodboard_positive_references for background description.\n" +
    "- Use moodboard_positive_references to understand desired aesthetic, mood, and visual elements to incorporate.\n" +
    "- If custom_instructions contains any relevant background/setting/location/environment details add that to the response WITHOUT FAIL.\n" +
    "- If neither contains usable background detail, choose default.\n";

  if (args.strength === "strict" && args.negativeRefs) {
    prompt +=
      "- Use moodboard_negative_references to understand what styles, elements, and aesthetics to AVOID.\n";
  }

  prompt +=
    "Output must be STRICT JSON:\n" +
    "{background_description: string, confidence:number}\n" +
    "Guidelines for background_description:\n" +
    "- Return ONLY the background_description value as 2–4 sentences of fashion-forward, editorial-quality creative direction.\n" +
    "- Use sophisticated fashion photography terminology (avoid generic phrasing).\n" +
    "- Include environment/setting, architectural elements, materials/textures, backdrop appearance, lighting setup, atmosphere, and overall tone.\n" +
    "- If the inputs imply STUDIO, describe a curated studio setup (e.g. seamless paper, textured backdrop, gradient, fabric drape, high-key/low-key, shadow play, gel lighting).\n" +
    "- If the inputs imply LIFESTYLE, describe an aspirational, curated environment with editorial storytelling (architectural cues, surfaces, ambient light, curated mood).\n" +
    "- Maintain ecommerce realism and product-fidelity intent: background should elevate the garment but not distract.\n" +
    "- Avoid mentioning product/garment or changing it.\n" +
    "- Do NOT invent props that are not implied by the inputs; keep it believable and cohesive.\n" +
    `\ncustom_instructions:\n${args.custom || "(empty)"}\n` +
    `\nmoodboard_background_summary:\n${
      args.backgroundSummary || "(empty)"
    }\n` +
    `\nmoodboard_positive_references:\n${args.positiveRefs || "(empty)"}\n`;

  if (args.strength === "strict" && args.negativeRefs) {
    prompt += `\nmoodboard_negative_references (styles to AVOID):\n${args.negativeRefs}\n`;
  }

  return prompt;
};
