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
};
