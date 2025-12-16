import { z } from 'zod';
import type { BaseGenerationInput, GenerationWorkflow, GenerationWorkflowKey } from './types';
import { executeApparelCatalogWorkflow } from './apparel/catalog-execute';

export const baseGenerationInputSchema = z.object({
  product_images: z.array(z.string().min(1)).min(1),
  purpose: z.enum(['catalog', 'ads', 'infographics']).default('catalog'),
  moodboard_id: z.number().int().positive().optional().nullable().default(null),
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

function buildInfographicsGuidelines() {
  return [
    'Goal: ecommerce infographic image with text overlays.',
    'Text overlays are allowed and encouraged: short headline, feature callouts, labels, and minimal stats.',
    'Keep product fidelity: do not change product color, shape, branding, or text on the product itself.',
    'Use a clean, readable layout with high contrast and generous spacing.',
    'Do not include pricing or claims unless explicitly requested.',
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
  purpose: 'catalog' | 'ads' | 'infographics';
  categoryFamily: 'apparel' | 'non_apparel';
  customInstructions: string;
  styleAppendix: string;
}) {
  const purposeGuidelines =
    args.purpose === 'catalog'
      ? buildCatalogGuidelines()
      : args.purpose === 'ads'
        ? buildAdsGuidelines()
        : buildInfographicsGuidelines();

  const categoryGuidelines =
    args.categoryFamily === 'apparel'
      ? buildApparelGuidelines(args.purpose === 'infographics' ? 'catalog' : args.purpose)
      : buildNonApparelGuidelines(args.purpose === 'infographics' ? 'catalog' : args.purpose);
  const extra = args.customInstructions.trim();
  return [
    `Generate an ecommerce product image for "${args.productTitle}".`,
    purposeGuidelines,
    categoryGuidelines,
    args.styleAppendix.trim() ? `Brand style: ${args.styleAppendix.trim()}` : '',
    extra ? `Additional instructions: ${extra}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function makeWorkflow(
  key: GenerationWorkflowKey,
  categoryFamily: 'apparel' | 'non_apparel',
  purpose: 'catalog' | 'ads' | 'infographics'
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
        styleAppendix: String((input as any)?.style_appendix ?? ''),
      }),
  };
}

export const generationWorkflows: Record<GenerationWorkflowKey, GenerationWorkflow<BaseGenerationInput>> = {
  'apparel.catalog.v1': {
    ...makeWorkflow('apparel.catalog.v1', 'apparel', 'catalog'),
    execute: async ({ teamId, productId, variantId, requestOrigin, authCookie, input, numberOfVariations }) =>
      executeApparelCatalogWorkflow({
        teamId,
        productId,
        variantId,
        requestOrigin,
        authCookie,
        schemaKey: 'apparel.catalog.v1',
        input,
        numberOfVariations,
      }),
  },
  'apparel.ads.v1': makeWorkflow('apparel.ads.v1', 'apparel', 'ads'),
  'apparel.infographics.v1': makeWorkflow('apparel.infographics.v1', 'apparel', 'infographics'),
  'non_apparel.catalog.v1': makeWorkflow('non_apparel.catalog.v1', 'non_apparel', 'catalog'),
  'non_apparel.ads.v1': makeWorkflow('non_apparel.ads.v1', 'non_apparel', 'ads'),
  'non_apparel.infographics.v1': makeWorkflow('non_apparel.infographics.v1', 'non_apparel', 'infographics'),
};

export function getGenerationWorkflow(key: GenerationWorkflowKey) {
  return generationWorkflows[key];
}


