import { z } from 'zod';

export const generationPurposeSchema = z.enum(['catalog', 'ads', 'infographics']);
export type GenerationPurpose = z.infer<typeof generationPurposeSchema>;

export type WorkflowCategory = 'apparel' | 'non_apparel';

export type GenerationWorkflowKey =
  | 'apparel.catalog.v1'
  | 'apparel.ads.v1'
  | 'apparel.infographics.v1'
  | 'non_apparel.catalog.v1'
  | 'non_apparel.ads.v1'
  | 'non_apparel.infographics.v1';

export type ProductCategory = 'apparel' | 'electronics' | 'jewellery' | (string & {});

export type BaseGenerationInput = {
  product_images: string[];
  purpose: GenerationPurpose;
  moodboard_id?: number | null;
  number_of_variations: number;
  model_image?: string;
  background_image?: string;
  output_format?: 'png' | 'jpg' | 'webp';
  aspect_ratio?: '1:1' | '4:5' | '3:4' | '16:9';
  custom_instructions: string[];
};

export type WorkflowProductContext = {
  title: string;
  category: ProductCategory;
};

export type GenerationWorkflow<TInput extends BaseGenerationInput = BaseGenerationInput> = {
  key: GenerationWorkflowKey;
  inputSchema: z.ZodType<TInput>;
  buildPrompt: (args: { input: TInput; product: WorkflowProductContext }) => string;
  execute?: (args: {
    teamId: number;
    productId: number;
    variantId: number;
    requestOrigin: string;
    authCookie?: string | null;
    moodboard?: {
      id: number;
      name: string;
      styleProfile: Record<string, unknown>;
      assetFileIds: number[];
      assetUrls: string[];
      styleAppendix: string;
    } | null;
    input: TInput;
    numberOfVariations: number;
  }) => Promise<{ generation: any; images: any[]; folderId: number }>;
};


