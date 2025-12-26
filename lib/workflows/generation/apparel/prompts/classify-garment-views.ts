export const getClassifyGarmentViewsPrompt = () => {
  return (
    "You are classifying apparel product photos by view. " +
    "Return ONLY JSON. Identify indices for front/back and optional close-ups. " +
    "Set need_masking=true if backgrounds are cluttered or not studio/flatlay, or if a clean cutout would help catalog consistency. " +
    "JSON schema: {frontIndex:number|null, backIndex:number|null, frontCloseIndex:number|null, backCloseIndex:number|null, need_masking:boolean}."
  );
};
