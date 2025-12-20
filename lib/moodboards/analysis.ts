import { z } from 'zod';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '@/lib/ai/shared/json';
import { buildSameOriginAuthHeaders, fetchAsBytes, resolveUrl } from '@/lib/ai/shared/image-fetch';
import { getMoodboardById, listMoodboardAssetsByKind } from '@/lib/db/moodboards';
import { updateMoodboard } from '@/lib/db/moodboards';

const backgroundAnalysisSchema = z.object({
  backgrounds_analysis_summary: z.string().default(''),
});

const modelAnalysisSchema = z.object({
  models_analysis_summary: z.string().default(''),
});

const positiveRefAnalysisSchema = z.object({
  reference_positive_summary: z.string().default(''),
});

const negativeRefAnalysisSchema = z.object({
  reference_negative_summary: z.string().default(''),
});

async function analyzeBackgrounds(
  urls: string[],
  args: { requestOrigin: string; authCookie: string | null }
) {
  if (urls.length === 0) return '';

  const prompt =
    'You are analyzing background images for a brand moodboard. Look at the provided background images and summarize their common visual characteristics.\n' +
    'Return STRICT JSON with key:\n' +
    '- backgrounds_analysis_summary: string\n' +
    'Guidelines:\n' +
    '- Be concise (1-3 sentences).\n' +
    '- Describe lighting, color palette, environment, camera/composition.\n';

  const content: any[] = [{ type: 'text', text: prompt }];

  for (const url of urls) {
    const headers = buildSameOriginAuthHeaders({
      requestOrigin: args.requestOrigin,
      url,
      cookie: args.authCookie,
    });
    const img = await fetchAsBytes(url, headers ? { headers } : undefined);
    content.push({ type: 'image', image: img.bytes, mimeType: img.mimeType });
  }

  const result: any = await generateText({
    model: 'google/gemini-2.0-flash',
    messages: [{ role: 'user', content }],
  } as any);

  const text = String(result?.text ?? '');
  const parsed = parseJsonWithSchema(text, backgroundAnalysisSchema);
  return parsed.backgrounds_analysis_summary;
}

async function analyzeModels(
  urls: string[],
  args: { requestOrigin: string; authCookie: string | null }
) {
  if (urls.length === 0) return '';

  const prompt =
    'You are analyzing model images for a brand moodboard. Look at the provided model images and focus on human subjects/people.\n' +
    'Return STRICT JSON with key:\n' +
    '- models_analysis_summary: string\n' +
    'Guidelines:\n' +
    '- Be concise (1-3 sentences).\n' +
    '- Describe human subjects appearance, age groups, gender, ethnicity, poses, clothing style, and expressions.\n' +
    '- Include ALL humans present - adults, children, babies.\n' +
    '- If there are no humans in the model images, clearly state this.\n';

  const content: any[] = [{ type: 'text', text: prompt }];

  for (const url of urls) {
    const headers = buildSameOriginAuthHeaders({
      requestOrigin: args.requestOrigin,
      url,
      cookie: args.authCookie,
    });
    const img = await fetchAsBytes(url, headers ? { headers } : undefined);
    content.push({ type: 'image', image: img.bytes, mimeType: img.mimeType });
  }

  const result: any = await generateText({
    model: 'google/gemini-2.0-flash',
    messages: [{ role: 'user', content }],
  } as any);

  const text = String(result?.text ?? '');
  const parsed = parseJsonWithSchema(text, modelAnalysisSchema);
  return parsed.models_analysis_summary;
}

async function analyzePositiveReferences(
  urls: string[],
  args: { requestOrigin: string; authCookie: string | null }
) {
  if (urls.length === 0) return '';

  const prompt =
    'You are analyzing POSITIVE style reference images for a brand moodboard. These images represent the target visual style to emulate during generation.\n' +
    'Return STRICT JSON with key:\n' +
    '- reference_positive_summary: string\n' +
    'Guidelines:\n' +
    '- Be concise (2-4 sentences).\n' +
    '- Describe the desired style: lighting, color palette, composition, camera feel, textures/materials, mood/vibe, environment, and any post-processing/grade.\n' +
    "- Focus on transferable style traits (not exact objects/people).\n";

  const content: any[] = [{ type: 'text', text: prompt }];

  for (const url of urls) {
    const headers = buildSameOriginAuthHeaders({
      requestOrigin: args.requestOrigin,
      url,
      cookie: args.authCookie,
    });
    const img = await fetchAsBytes(url, headers ? { headers } : undefined);
    content.push({ type: 'image', image: img.bytes, mimeType: img.mimeType });
  }

  const result: any = await generateText({
    model: 'google/gemini-2.0-flash',
    messages: [{ role: 'user', content }],
  } as any);

  const text = String(result?.text ?? '');
  const parsed = parseJsonWithSchema(text, positiveRefAnalysisSchema);
  return parsed.reference_positive_summary;
}

async function analyzeNegativeReferences(
  urls: string[],
  args: { requestOrigin: string; authCookie: string | null }
) {
  if (urls.length === 0) return '';

  const prompt =
    'You are analyzing NEGATIVE style reference images for a brand moodboard. These images represent visual styles to AVOID during generation.\n' +
    'Return STRICT JSON with key:\n' +
    '- reference_negative_summary: string\n' +
    'Guidelines:\n' +
    '- Be concise (2-4 sentences).\n' +
    '- Describe what to avoid: lighting, color palette, composition, camera feel, textures/materials, mood/vibe, environment, and post-processing/grade.\n' +
    '- Phrase as avoid/never/do-not guidance.\n';

  const content: any[] = [{ type: 'text', text: prompt }];

  for (const url of urls) {
    const headers = buildSameOriginAuthHeaders({
      requestOrigin: args.requestOrigin,
      url,
      cookie: args.authCookie,
    });
    const img = await fetchAsBytes(url, headers ? { headers } : undefined);
    content.push({ type: 'image', image: img.bytes, mimeType: img.mimeType });
  }

  const result: any = await generateText({
    model: 'google/gemini-2.0-flash',
    messages: [{ role: 'user', content }],
  } as any);

  const text = String(result?.text ?? '');
  const parsed = parseJsonWithSchema(text, negativeRefAnalysisSchema);
  return parsed.reference_negative_summary;
}

export async function recomputeMoodboardAssetSummaries(args: {
  teamId: number;
  moodboardId: number;
  requestOrigin: string;
  authCookie: string | null;
}) {
  const mb = await getMoodboardById(args.teamId, args.moodboardId);
  if (!mb) return;

  const bg = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'background');
  const models = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'model');
  const posRefs = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'reference_positive');
  const negRefs = await listMoodboardAssetsByKind(args.teamId, args.moodboardId, 'reference_negative');

  const maxPerKind = 3;
  const bgUrls = bg
    .slice(0, maxPerKind)
    .map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')))
    .filter(Boolean);
  const modelUrls = models
    .slice(0, maxPerKind)
    .map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')))
    .filter(Boolean);
  const posRefUrls = posRefs
    .slice(0, maxPerKind)
    .map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')))
    .filter(Boolean);
  const negRefUrls = negRefs
    .slice(0, maxPerKind)
    .map((a) => resolveUrl(args.requestOrigin, String((a as any).blobUrl ?? '')))
    .filter(Boolean);

  // If nothing to analyze, clear summaries.
  if (
    bgUrls.length === 0 &&
    modelUrls.length === 0 &&
    posRefUrls.length === 0 &&
    negRefUrls.length === 0
  ) {
    const next = {
      ...(mb.styleProfile as any),
      backgrounds_analysis_summary: '',
      models_analysis_summary: '',
      reference_positive_summary: '',
      reference_negative_summary: '',
    };
    await updateMoodboard(args.teamId, args.moodboardId, { styleProfile: next });
    return;
  }

  const [backgroundsSummary, modelsSummary, posSummary, negSummary] = await Promise.all([
    analyzeBackgrounds(bgUrls, args),
    analyzeModels(modelUrls, args),
    analyzePositiveReferences(posRefUrls, args),
    analyzeNegativeReferences(negRefUrls, args),
  ]);

  const next = {
    ...(mb.styleProfile as any),
    backgrounds_analysis_summary: backgroundsSummary,
    models_analysis_summary: modelsSummary,
    reference_positive_summary: posSummary,
    reference_negative_summary: negSummary,
  };
  await updateMoodboard(args.teamId, args.moodboardId, { styleProfile: next });
}


