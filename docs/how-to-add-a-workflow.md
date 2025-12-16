## How to add a new generation workflow

This project routes each generation request to a **workflow** based on:
- **Product category family**: `apparel` vs `non_apparel` (currently “non_apparel” means any category other than `apparel`)
- **Purpose**: `catalog` | `ads` | `infographics`

Each workflow has a **workflow key** (persisted to DB as `variant_generations.schema_key` and `variant_images.schema_key`) so we can audit which workflow produced an image.

### Where things live
- **Workflow types**: `lib/workflows/generation/types.ts`
- **Workflow router** (category/purpose → workflowKey): `lib/workflows/generation/resolve-workflow.ts`
- **Workflow registry** (workflowKey → schema + prompt builder): `lib/workflows/generation/workflows.ts`
- **API entrypoint** (uses router + registry): `app/api/products/[productId]/variants/[variantId]/generations/route.ts`
- **Executors / persistence** (Gemini + Blob + DB persistence): `lib/db/generations.ts`
- **UI purpose selector**: `app/(dashboard)/dashboard/products/[productId]/variants/[variantId]/page.tsx`

--- 

## Step-by-step: adding a new workflow

### Two supported workflow styles

#### A) Prompt-only workflow (default)
Most workflows simply provide:
- `inputSchema`
- `buildPrompt()`

The API will call the generic executor which:
- generates images with Gemini
- uploads to Blob
- persists `variant_generations` + `variant_images`
- adds images to the Default folder

#### B) Pipeline workflow via `execute()` (advanced)
Some workflows need multiple model calls / steps (e.g. garment pipelines). For these, a workflow can provide:
- `execute({ teamId, productId, variantId, requestOrigin, authCookie?, moodboard?, input, numberOfVariations })`

When `execute()` is present, the API will call it instead of the prompt-only executor.

Notes:
- `authCookie` is passed by the API so pipeline steps can fetch **same-origin private URLs** (e.g. `/api/uploads/.../file`) without 401s.
- Pipelines should still persist outputs via the shared DB helper so folder behavior stays consistent.
- Moodboards are resolved by the API and passed into `execute()` as a pre-built object containing style + reference images (see below).

--- 

## Moodboards: adding brand style during execution

Moodboards let the user select a reusable **style profile** (typography + do-not rules) and **reference images** to influence generation.

### How moodboards flow through the system

1) **UI** sends `moodboard_id` inside the `input` for `POST /generations`.
2) The API route (`app/api/products/[productId]/variants/[variantId]/generations/route.ts`) resolves the moodboard for the current team:
   - fetches the moodboard row
   - fetches attached assets
   - produces signed, time-limited **same-origin** asset URLs (so executors can fetch them server-side)
   - builds a text `styleAppendix` derived from the style profile (tone/font/case/rules/do-not)
3) The API then:
   - passes `moodboard` into `workflow.execute(...)` (pipeline path), OR
   - passes `moodboardId`, `extraReferenceImageUrls`, and `style_appendix` into the generic executor (prompt-only path).

### The `moodboard` object passed into `execute()`

Executors receive a normalized object shaped like:
- `id`, `name`
- `styleProfile`: the raw JSON style profile
- `assetFileIds`: ids of attached `uploaded_files`
- `assetUrls`: signed URLs for each asset (same-origin)
- `styleAppendix`: a compact prompt appendix (tone/font/case/rules/do-not)

### Persisting moodboard data (recommended)

For auditability, persist a snapshot in `variant_generations.input`:
- `moodboard_snapshot`: `{ id, name, style_profile, asset_file_ids }`
- optionally also persist `style_appendix` and any pipeline metadata

If you’re using the shared persistence helpers:
- Pass `moodboardId` to `createVariantGenerationWithProvidedOutputs(...)` (pipeline) or `createVariantGenerationWithGeminiOutputs(...)` (prompt-only)
- Include `moodboard_snapshot` inside the `input` you persist

This ensures:
- the selected moodboard is queryable via `variant_generations.moodboard_id`
- the exact style/asset selection is retained even if the moodboard changes later

### Step 1) Decide the routing dimension(s)
Every workflow is selected by **(category family × purpose)**.

Examples of additions you might make:
- Add a new **purpose** (e.g. `lifestyle`)
- Add a new **category family** (e.g. `jewellery` as its own family instead of being part of non_apparel)
- Add a new workflow version (e.g. `.v2`)

If you’re adding a new purpose, you typically add **two keys**:
- `apparel.<purpose>.v1`
- `non_apparel.<purpose>.v1`

If you’re adding a new family, you may add **N keys**, one per purpose you want to support.

--- 

## Step 2) Update the purpose enum (only if you’re adding a new purpose)

1) Update the purpose schema/type:
- `generationPurposeSchema` in `lib/workflows/generation/types.ts`

2) Update the shared base input schema:
- `baseGenerationInputSchema` in `lib/workflows/generation/workflows.ts`

This ensures the API accepts the new purpose inside `input.purpose` and persists it in `variant_generations.input`.

--- 

## Step 3) Add new workflow keys

1) Add the workflow key(s) to:
- `GenerationWorkflowKey` union in `lib/workflows/generation/types.ts`

Workflow keys are strings like:
- `apparel.catalog.v1`
- `non_apparel.ads.v1`

--- 

## Step 4) Register the workflow(s)

Add registry entries in `generationWorkflows` in `lib/workflows/generation/workflows.ts`.

Each workflow provides:
- `key`: workflow key string
- `inputSchema`: a zod schema for validation/normalization
- `buildPrompt(...)`: builds a workflow-specific prompt (this is where behavior diverges)
- optional `execute(...)`: pipeline implementation (when a single prompt is not enough)

Notes:
- For v1, many workflows can share `baseGenerationInputSchema`.
- If a workflow requires extra inputs later, define a stricter `inputSchema` (extending base) and update UI to supply those fields.

--- 

## Reusable utilities (already implemented)

These utilities were created for the Apparel Catalog pipeline and are intended to be reused by future workflows (apparel ads/infographics, etc.).

### Shared helpers
- `lib/ai/shared/image-fetch.ts`
  - `resolveUrl(origin, url)`
  - `fetchAsBytes(url, init?)`
  - `buildSameOriginAuthHeaders({ requestOrigin, url, cookie })` (cookie-safe same-origin fetch)
  - `coerceResultFileToBytes(file)`
- `lib/ai/shared/json.ts`
  - `extractJsonFromText(text)`
  - `parseJsonWithSchema(text, schema)` (robust JSON extraction + zod parse)

### Apparel pipeline step utilities (Apparel Catalog)
- Step 1: classify views
  - `lib/ai/apparel/classify-garment.ts`
  - `classifyGarmentViews({ requestOrigin, productImageUrls, authCookie? })`
- Step 2: optional masking
  - `lib/ai/apparel/mask-garment.ts`
  - `maskGarmentsIfNeeded({ requestOrigin, authCookie?, needMasking, frontUrl?, backUrl?, teamId, variantId, generationId })`
- Step 3: garment analysis
  - `lib/ai/apparel/analyze-garment.ts`
  - `analyzeGarment({ requestOrigin, frontImageUrl, authCookie? })`
  - Includes normalization so minor model output variations don’t crash the pipeline (e.g. gender/category synonyms).
- Step 4: background resolution
  - `lib/ai/background/extract-background.ts` (`extractBackgroundFromInstructions`)
  - `lib/ai/background/resolve-catalog-background.ts` (`resolveCatalogBackground`, `STUDIO_DEFAULT_BACKGROUND`)
- Step 5: final image generation
  - `lib/ai/apparel/generate-catalog-images.ts`
  - `generateApparelCatalogImages({ requestOrigin, authCookie?, teamId, variantId, generationId, numberOfVariations, garmentImageUrls, analysis, background_description, custom_instructions })`

### Pipeline orchestrator (Apparel Catalog)
- `lib/workflows/generation/apparel/catalog-execute.ts`
  - `executeApparelCatalogWorkflow(...)` orchestrates steps 1–5 and persists outputs.

### Persistence helpers (reusable)
- `lib/db/generations.ts`
  - `createVariantGenerationWithGeminiOutputs(...)` (prompt-only path)
  - `createVariantGenerationWithProvidedOutputs(...)` (pipeline path; persists already-generated outputs and adds them to Default folder)

--- 

## Step 5) Update the router

Update `resolveGenerationWorkflowKey()` in `lib/workflows/generation/resolve-workflow.ts` to map:
- `(productCategory, purpose)` → `GenerationWorkflowKey`

Rules should be:
- deterministic
- easily extensible (prefer explicit branching)

--- 

## Step 6) Update the UI (only if needed)

If the new workflow is activated by a new purpose:
- Add the purpose option to the **Purpose** select in:
  - `app/(dashboard)/dashboard/products/[productId]/variants/[variantId]/page.tsx`

If the workflow introduces new required inputs:
- Add new fields to the generate modal
- Include them in the `input` object sent to `POST /generations`

--- 

## Step 7) Verification checklist

1) Create or use an **apparel** product and run generation with the new purpose.
   - Confirm DB record `variant_generations.schema_key` matches expected workflow key.
2) Create or use a **non-apparel** product and run generation with the new purpose.
   - Confirm schema key matches expected key.
3) Confirm images still land in the same folder behavior (Default folder unless moved).
4) Confirm the variant page loads and renders schema keys/prompts without errors.

--- 

## Practical example: how `infographics` was added

We added:
- New purpose: `infographics`
- New workflow keys:
  - `apparel.infographics.v1`
  - `non_apparel.infographics.v1`
- Router updated to route to `*.infographics.v1`
- Registry entries updated with infographic prompt guidelines (text overlays allowed)

Use this pattern for future purposes like `lifestyle`, `ugc`, `seasonal`, etc.


