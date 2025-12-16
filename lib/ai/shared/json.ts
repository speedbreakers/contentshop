import { z } from 'zod';

export function extractJsonFromText(text: string) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Empty model output');
  // Try direct parse first.
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to extract first JSON object substring.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error('Model output did not contain JSON');
  }
}

export function parseJsonWithSchema<T>(text: string, schema: z.ZodType<T>): T {
  const obj = extractJsonFromText(text);
  return schema.parse(obj);
}


