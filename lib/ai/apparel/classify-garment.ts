import { getClassifyGarmentViewsPrompt } from "@/lib/workflows/generation/apparel/prompts/classify-garment-views";
import { generateText } from "ai";
import { z } from "zod";
import {
  buildSameOriginAuthHeaders,
  fetchAsBytes,
  resolveUrl,
} from "../shared/image-fetch";
import { parseJsonWithSchema } from "../shared/json";

export const garmentClassificationSchema = z.object({
  frontIndex: z.number().int().min(0).nullable(),
  backIndex: z.number().int().min(0).nullable(),
  frontCloseIndex: z.number().int().min(0).nullable().optional().default(null),
  backCloseIndex: z.number().int().min(0).nullable().optional().default(null),
  need_masking: z.boolean().default(false),
});

export type GarmentClassification = z.infer<
  typeof garmentClassificationSchema
> & {
  frontUrl: string | null;
  backUrl: string | null;
  frontCloseUrl: string | null;
  backCloseUrl: string | null;
};

export async function classifyGarmentViews(args: {
  requestOrigin: string;
  productImageUrls: string[];
  authCookie?: string | null;
}): Promise<GarmentClassification> {
  const urls = args.productImageUrls.map((u) =>
    resolveUrl(args.requestOrigin, String(u))
  );
  if (urls.length === 0) {
    return {
      frontIndex: null,
      backIndex: null,
      frontCloseIndex: null,
      backCloseIndex: null,
      need_masking: false,
      frontUrl: null,
      backUrl: null,
      frontCloseUrl: null,
      backCloseUrl: null,
    };
  }

  const imgs = await Promise.all(
    urls.map(async (u) => {
      const headers = buildSameOriginAuthHeaders({
        requestOrigin: args.requestOrigin,
        url: u,
        cookie: args.authCookie,
      });
      return await fetchAsBytes(u, headers ? ({ headers } as any) : undefined);
    })
  );
  const prompt = getClassifyGarmentViewsPrompt();

  const result: any = await generateText({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...imgs.map((ri) => ({
            type: "image",
            image: ri.bytes,
            mimeType: ri.mimeType,
          })),
          {
            type: "text",
            text:
              "These images correspond to indices 0.." +
              String(urls.length - 1) +
              " in the same order provided.",
          },
        ],
      },
    ],
  } as any);

  const parsed = parseJsonWithSchema(
    String(result?.text ?? ""),
    garmentClassificationSchema
  );
  const getUrl = (idx: number | null | undefined) =>
    typeof idx === "number" && idx >= 0 && idx < urls.length ? urls[idx] : null;

  return {
    ...parsed,
    frontUrl: getUrl(parsed.frontIndex),
    backUrl: getUrl(parsed.backIndex),
    frontCloseUrl: getUrl(parsed.frontCloseIndex),
    backCloseUrl: getUrl(parsed.backCloseIndex),
  };
}
