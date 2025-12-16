import { z } from 'zod';
import type { BaseGenerationInput, GenerationWorkflow, GenerationWorkflowKey } from './types';

export const baseGenerationInputSchema = z.object({
  product_images: z.array(z.string().min(1)).min(1),
  purpose: z.enum(['catalog', 'ads']).default('catalog'),
  number_of_variations: z.number().int().min(1).max(10).default(1),
  model_image: z.string().optional().default(''),
  background_image: z.string().optional().default(''),
  output_format: z.enum(['png', 'jpg', 'webp']).default('png'),
  aspect_ratio: z.enum(['1:1', '4:5', '3:4', '16:9']).default('1:1'),
  custom_instructions: z.string().optional().default(''),
});

function buildCatalogGuidelines() {
  return [
    'Goal: ecommerce catalog image.',
    'Keep product fidelity: do not change product color, shape, branding, or text.',
    'Clean, distraction-free background. Studio lighting. Accurate shadows.',
    'High clarity and sharpness. No extra objects unless explicitly requested.',
  ].join(' ');
}

function buildAdsGuidelines() {
  return [
    'Goal: ecommerce ad creative.',
    'Keep product fidelity: do not change product color, shape, branding, or text.',
    'Allow more creative background/context, stronger lighting, and composition.',
    'No text overlays unless explicitly requested.',
  ].join(' ');
}

function buildApparelGuidelines(purpose: 'catalog' | 'ads') {
  return [
    'Product category: apparel.',
    purpose === 'catalog'
      ? 'Emphasize garment fit, fabric texture, and accurate colors. Prefer neutral backdrop.'
      : 'Emphasize lifestyle styling and mood while keeping the garment accurate.',
  ].join(' ');
}

function buildNonApparelGuidelines(purpose: 'catalog' | 'ads') {
  return [
    'Product category: non-apparel.',
    purpose === 'catalog'
      ? 'Emphasize materials/finish and accurate proportions. Prefer neutral backdrop.'
      : 'Emphasize contextual use/lifestyle while keeping the product accurate.',
  ].join(' ');
}

function buildPromptBase(args: {
  productTitle: string;
  purpose: 'catalog' | 'ads';
  categoryFamily: 'apparel' | 'non_apparel';
  customInstructions: string;
}) {
  const purposeGuidelines = args.purpose === 'catalog' ? buildCatalogGuidelines() : buildAdsGuidelines();
  const categoryGuidelines =
    args.categoryFamily === 'apparel'
      ? buildApparelGuidelines(args.purpose)
      : buildNonApparelGuidelines(args.purpose);
  const extra = args.customInstructions.trim();
  return [
    `Generate an ecommerce product image for "${args.productTitle}".`,
    purposeGuidelines,
    categoryGuidelines,
    extra ? `Additional instructions: ${extra}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function makeWorkflow(
  key: GenerationWorkflowKey,
  categoryFamily: 'apparel' | 'non_apparel',
  purpose: 'catalog' | 'ads'
): GenerationWorkflow<BaseGenerationInput> {
  // For v1 all workflows share the same input schema; divergence can be added later.
  const inputSchema = baseGenerationInputSchema;

  return {
    key,
    inputSchema: inputSchema as any,
    buildPrompt: ({ input, product }) =>
      buildPromptBase({
        productTitle: product.title,
        purpose,
        categoryFamily,
        customInstructions: input.custom_instructions ?? '',
      }),
  };
}

export const generationWorkflows: Record<GenerationWorkflowKey, GenerationWorkflow<BaseGenerationInput>> = {
  'apparel.catalog.v1': makeWorkflow('apparel.catalog.v1', 'apparel', 'catalog'),
  'apparel.ads.v1': makeWorkflow('apparel.ads.v1', 'apparel', 'ads'),
  'non_apparel.catalog.v1': makeWorkflow('non_apparel.catalog.v1', 'non_apparel', 'catalog'),
  'non_apparel.ads.v1': makeWorkflow('non_apparel.ads.v1', 'non_apparel', 'ads'),
};

export function getGenerationWorkflow(key: GenerationWorkflowKey) {
  return generationWorkflows[key];
}


