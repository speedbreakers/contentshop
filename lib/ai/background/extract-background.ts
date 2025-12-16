import { z } from 'zod';
import { generateText } from 'ai';
import { parseJsonWithSchema } from '../shared/json';

export const backgroundExtractSchema = z.object({
  found: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0),
  background_description: z.string().nullable().optional().default(null),
});

export type BackgroundExtractResult = z.infer<typeof backgroundExtractSchema>;

export async function extractBackgroundFromInstructions(args: { instructions: string }) {
  const instructions = (args.instructions ?? '').trim();
  if (!instructions) {
    return { found: false, confidence: 0, background_description: null } satisfies BackgroundExtractResult;
  }

  const prompt =
    'You are extracting BACKGROUND intent from ecommerce image instructions. ' +
    'Return ONLY JSON. If the user did not mention background/location/setting, return found=false. ' +
    'JSON schema: {found:boolean, confidence:number, background_description:string|null}. ' +
    'background_description should be a concise, concrete background (1 sentence) suitable for a product catalog image.';

  const result: any = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt + '\n\nUser instructions:\n' + instructions }],
      },
    ],
  } as any);

  const parsed = parseJsonWithSchema(String(result?.text ?? ''), backgroundExtractSchema);
  const desc = (parsed.background_description ?? '').trim();

  // Basic sanitation: treat tiny/generic outputs as not found.
  const generic = ['none', 'n/a', 'na', 'default', 'studio', 'plain background'];
  if (!desc || desc.length < 12 || generic.includes(desc.toLowerCase())) {
    return { found: false, confidence: Math.min(parsed.confidence ?? 0, 0.4), background_description: null };
  }

  return { ...parsed, background_description: desc };
}


