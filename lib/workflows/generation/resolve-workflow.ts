import type { GenerationPurpose, GenerationWorkflowKey, ProductCategory } from './types';

export function resolveGenerationWorkflowKey(args: {
  productCategory: ProductCategory;
  purpose: GenerationPurpose;
}): GenerationWorkflowKey {
  const family = args.productCategory === 'apparel' ? 'apparel' : 'non_apparel';
  const purpose = args.purpose === 'ads' ? 'ads' : args.purpose === 'infographics' ? 'infographics' : 'catalog';
  return `${family}.${purpose}.v1` as GenerationWorkflowKey;
}


