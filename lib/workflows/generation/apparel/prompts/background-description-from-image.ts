export const getBackgroundDescriptionGenerationPrompt = () => {
  return `
    You are generating a background prompt for an ecommerce catalog image. 
    Look ONLY at the provided background image and write a single concise background description 
    that recreates this exact background: environment/setting, colors, lighting, camera feel, and any notable backdrop details. 
    Do NOT mention the product/garment. Do NOT add props that are not present. 
    Return STRICT JSON: {background_description:string, confidence:number}.
    `;
};
