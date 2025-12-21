export const getMaskingPrompt = () => {
    return `
    Extract the garment from the image, converting it into a flat lay presentation without any human body parts, maintaining the exact shape, structure, and intricate details of the clothing, with no watermarks
    
    Elements to avoid in the image:
    - Watermarks (CRITICAL: do not avoid text/print on the garment, have to keep it)
    - Price tags or any kind of tags attached to the garment, but not a part of the garment
    - Human body parts
    - Mannequin
    - Background
    - Any other elements that are not part of the main garment    
    `;
}

export const getGarmentAnalysisPrompt = () => {
    return `
    Analyze this apparel item for ecommerce catalog generation. Return ONLY JSON with the following keys: 
    gender (male|female|null), garment_category (top|bottom|fullbody|null), garment_type (string|null), occasion (string|null), 
    styling_suggestions {topwear,bottomwear,footwear,notes}, is_bottom_jeans (boolean).
    `;
}

export const getBackgroundDescriptionGenerationPrompt = () => {
    return `
    You are generating a background prompt for an ecommerce catalog image. 
    Look ONLY at the provided background image and write a single concise background description 
    that recreates this exact background: environment/setting, colors, lighting, camera feel, and any notable backdrop details. 
    Do NOT mention the product/garment. Do NOT add props that are not present. 
    Return STRICT JSON: {background_description:string, confidence:number}.
    `;
}