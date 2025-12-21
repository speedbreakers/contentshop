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
  moodboard_strength?: 'strict' | 'inspired';
  number_of_variations: number;
  model_enabled: boolean;
  model_image?: string;
  background_image?: string;
  output_format?: 'png' | 'jpg' | 'webp';
  aspect_ratio?:
    | '21:9'
    | '16:9'
    | '4:3'
    | '3:2'
    | '1:1'
    | '9:16'
    | '3:4'
    | '2:3'
    | '5:4'
    | '4:5';
  custom_instructions: string[];
  /**
   * Enriched by the API/job layer for prompt building & pipeline execution.
   * Not directly provided by the user form.
   */
  style_appendix?: string;
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
      /** All moodboard uploaded_file ids across all sections (for auditing). */
      assetFileIds: number[];
      /** Kind-separated uploaded_file ids (deterministic; used to rehydrate signed URLs at runtime). */
      backgroundAssetFileIds: number[];
      modelAssetFileIds: number[];
      positiveAssetFileIds: number[];
      negativeAssetFileIds: number[];

      /** Backward-compat alias for positive references. Prefer positiveAssetUrls. */
      assetUrls: string[];
      positiveAssetUrls: string[];
      negativeAssetUrls: string[];
      positiveSummary: string;
      negativeSummary: string;
      strength: 'strict' | 'inspired';
      styleAppendix: string;
    } | null;
    input: TInput;
    numberOfVariations: number;
  }) => Promise<{ generation: any; images: any[]; folderId: number }>;
};


