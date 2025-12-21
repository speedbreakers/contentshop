---
name: Model-enabled generation
overview: "Add model support to the apparel catalog pipeline: when `model_enabled` is true, include an on-model constraint in the prompt. If `model_image` is provided, attach it as an extra reference image (P0) and generate a concise model-description prompt from that image; otherwise, generate a model description via one combined LLM call that chooses between custom_instructions vs moodboard model summary (P1/P2), mirroring the background logic."
todos:
  - id: model-resolver
    content: Add a model resolver that supports P0 (model image) and a combined P1/P2 call (custom instructions vs moodboard model summary).
    status: completed
  - id: catalog-execute-model
    content: Update `executeApparelCatalogWorkflow` to compute model description and pass model info into image generation when `model_enabled` is true.
    status: completed
    dependencies:
      - model-resolver
  - id: generate-catalog-images-model
    content: Update `generateApparelCatalogImages` to incorporate model prompt text and attach model reference image when provided.
    status: completed
    dependencies:
      - catalog-execute-model
---

# Implement model-enabled generation (apparel pipeline)

## Goal

In `apparel.catalog.v1` pipeline, if `model_enabled` is true, generated images should include a model.

Model selection priority:

- **P0**: `model_image` present → use that exact model (attach image as reference); generate a concise model description prompt from the image.
- **P1/P2**: if no `model_image`, run **one LLM call** that decides whether to use `custom_instructions` (only if it contains model-relevant details) else use moodboard **model** summary.

## Key changes

### 1) Add a model resolver analogous to background resolver

Create a new module (or extend existing) in `lib/ai/model/`:

- `resolveCatalogModel({ modelImageUrl?, custom_instructions?, moodboard_model_summary? }) -> { model_description, source, confidence, modelImageUrlUsed? }`
- **P0 path**: takes `modelImageUrl`, calls Gemini with the image, returns 1-sentence model description (age/pose/framing/style), and source=`uploaded_model`.
- **P1/P2 combined call**: chooses `custom_instructions` only if it contains model details (e.g., gender/age/pose/model styling), otherwise uses `moodboard_model_summary`.

### 2) Wire the resolver into `executeApparelCatalogWorkflow`

File: [`lib/workflows/generation/apparel/catalog-execute.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/workflows/generation/apparel/catalog-execute.ts)

- Read `model_enabled` and `model_image` from `args.input`.
- If enabled:
- Resolve `modelImageUrl` (if IDs-only: `model_image_file_id -> blobUrl`; if URL-based: use `model_image` directly).
- Call `resolveCatalogModel()` using:
  - `custom_instructions` (array joined into a string)
  - moodboard model summary from `args.moodboard.styleProfile.models_analysis_summary`
- Pass **both**:
  - a new `model_description` string to `generateApparelCatalogImages()` (used in prompt)
  - the model image URL (if present) so generation can attach it as reference.

### 3) Update `generateApparelCatalogImages` to include model

File: [`lib/ai/apparel/generate-catalog-images.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/ai/apparel/generate-catalog-images.ts)

- Extend function args to include:
- `model_enabled?: boolean`
- `model_description?: string`
- `modelImageUrl?: string | null`
- Prompt change:
- If `model_enabled` true: add a clause like `"Include a human model wearing the garment."` + `Model: <model_description>`.
- Multimodal change:
- If `modelImageUrl` present: fetch it as bytes and attach as an additional `{type:'image'}` in the Gemini call.

### 4) Validation + failure modes

- If `model_enabled` true and neither model_image nor moodboard model summary nor custom-instructions contain model detail, `resolveCatalogModel` should still return a reasonable default (e.g., studio ecom model, neutral pose) with low confidence.
- Keep model generation scoped to apparel pipeline only (per your selection).

## Files to modify

- [`lib/workflows/generation/apparel/catalog-execute.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/workflows/generation/apparel/catalog-execute.ts)
- [`lib/ai/apparel/generate-catalog-images.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/ai/apparel/generate-catalog-images.ts)
- New: [`lib/ai/model/resolve-catalog-model.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/ai/model/resolve-catalog-model.ts) (or similar)

## Implementation todos

- `model-resolver`: Add `resolveCatalogModel` (P0 image + P1/P2 combined call).
- `catalog-execute-model`: Read `model_enabled`, `model_image`, moodboard model summary, call resolver, pass outputs through.
- `generate-catalog-images-model`: Update prompt and Gemini inputs to include model description and optional model reference image.