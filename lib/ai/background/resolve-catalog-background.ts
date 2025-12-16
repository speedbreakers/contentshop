import { extractBackgroundFromInstructions } from './extract-background';

export type ResolvedCatalogBackground = {
  background_description: string;
  source: 'extracted' | 'default';
  confidence: number;
};

export const STUDIO_DEFAULT_BACKGROUND =
  'Clean studio backdrop (light neutral), soft even lighting, realistic soft shadow, no props.';

export async function resolveCatalogBackground(args: { instructions: string }) {
  const extracted = await extractBackgroundFromInstructions({ instructions: args.instructions });
  const confidence = Number(extracted.confidence ?? 0);

  if (extracted.found && extracted.background_description && confidence >= 0.55) {
    return {
      background_description: extracted.background_description,
      source: 'extracted',
      confidence,
    } satisfies ResolvedCatalogBackground;
  }

  return {
    background_description: STUDIO_DEFAULT_BACKGROUND,
    source: 'default',
    confidence,
  } satisfies ResolvedCatalogBackground;
}


