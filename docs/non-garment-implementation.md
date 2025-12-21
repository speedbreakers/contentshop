# Non-Apparel “Shoot” Workflow: `non_apparel.catalog.v1` execute() spec (this repo)

This document is the blueprint for the **execute pipeline** we will wire up in:

- `lib/workflows/generation/workflows.ts` under `generationWorkflows['non_apparel.catalog.v1']`

Reference implementation (same style, different domain): `lib/workflows/generation/apparel/catalog-execute.ts`.

---

## 1) Execute function contract (what we must implement)

### Function to add

- `lib/workflows/generation/non-apparel/catalog-execute.ts`
- Export: `executeNonApparelCatalogWorkflow(...)`

### Signature (match the workflow runner)

Implement the same `execute` arg contract used by `executeApparelCatalogWorkflow`:

- Inputs are already **hydrated** by the job worker:
  - `input.product_images` are stable `uploaded_files.blobUrl` strings
  - `input.model_image` / `input.background_image` are stable blob URLs or empty string
- `moodboard` is already resolved to a runtime snapshot (may be `null`)
- Return shape is used by the worker to mark the job complete and to show images in the UI.

The execute function should follow this conceptual signature:

- `executeNonApparelCatalogWorkflow(args: { teamId, productId, variantId, requestOrigin, authCookie?, moodboard?, schemaKey: 'non_apparel.catalog.v1', input, numberOfVariations })`
- Returns: `Promise<{ generation: any; images: any[]; folderId: number }>`

### Assumptions (inputs you can rely on)

- `args.input` matches `baseGenerationInputSchema` (plus passthrough fields if we add any).
- `args.input.custom_instructions` should be treated defensively:
  - it may be `string[]` (preferred)
  - if it is a single `string`, treat it as one instruction
- `args.numberOfVariations` is already clamped to `1..10` by the caller.

### Moodboard usage rules (execute pipeline)

Use moodboard primarily as **text guidance**:
- `args.moodboard.styleAppendix` is already computed (typography + do-not + summaries)
- `args.moodboard.styleProfile` contains:
  - `backgrounds_analysis_summary`
  - `models_analysis_summary`
  - `reference_positive_summary`
  - `reference_negative_summary`

Strength rules:
- `inspired`: ignore negative summary guidance
- `strict`: include negative summary guidance (but still keep the pipeline deterministic)

### Pipeline steps inside execute (recommended order)

This should mirror the apparel execute pipeline structure, but without garment-specific steps.

#### Step 1: validate product exists (defense in depth)

Same as apparel:
- Validate the variant/product belongs to `teamId` and is not deleted.

#### Step 2: create generation record early

Create `variantGenerations` row with:
- `schemaKey: 'non_apparel.catalog.v1'`
- `status: 'generating'`
- `input: args.input`
- `numberOfVariations`
- `provider: 'gemini'` (match apparel for now)

#### Step 3: resolve background description (re-use existing helper)

Call `resolveCatalogBackground` with priority:
- `input.background_image` (if provided): describe exact background image
- else: choose between:
  - relevant background details found in `custom_instructions`
  - `moodboard.styleProfile.backgrounds_analysis_summary`
- else: default studio background

#### Step 4: resolve model guidance (re-use existing helper)

If `input.model_enabled`:
- If `input.model_image` exists: treat as strict model reference image
- Else: call `resolveCatalogModel` choosing between:
  - `custom_instructions` if it contains model/person cues
  - `moodboard.styleProfile.models_analysis_summary`
  - default model description

If `input.model_enabled` is false:
- no model guidance

#### Step 5: build a single final prompt string (repo style)

Build one “final prompt” string containing:
- Non-apparel product fidelity rules (shape/proportions/materials/finish/branding)
- `Background: <background_description>` (must be stable across all variations)
- Lighting rules (studio soft even light, realistic soft shadow) unless overridden
- If model enabled:
  - either “Use Image 1 (Model Image)” or `Model guidance: <model_description>`
- Moodboard text guidance:
  - `Brand style: ${moodboard.styleAppendix}` (if non-empty)
  - Positive summary: `reference_positive_summary` (if present)
  - Negative summary: only if `moodboard.strength === 'strict'`
- “Additional instructions”: merged `custom_instructions`

#### Step 6: generate N images with an anchor reference (must-have for this workflow)

Unlike the current apparel generator, the shoot workflow must ensure continuity:

- **Image 1 (anchor)**:
  - reference images: `product_images[]` (+ optional `model_image`)
  - prompt: final prompt (plus “hero shot” bias if desired)
  - upload output to Vercel Blob
- **Images 2..N (variations)**:
  - reference images: `anchor_image_url` + `product_images[]` (+ optional `model_image`)
  - prompt: same base prompt, plus the per-variation instruction (if provided)

#### Step 7: persist outputs (same pattern as apparel)

Use `createVariantGenerationWithProvidedOutputs(...)` with:
- `generationId` (the one you created early)
- `moodboardId: args.moodboard?.id ?? null`
- `outputs: [{ blobUrl, prompt }]` (prompt should be the final prompt used)
- Save debug metadata into `input.pipeline` (recommended):
  - background resolution result
  - model resolution result
  - finalPrompt
  - anchor url

Return `{ generation, images, folderId }` from the helper (same as apparel execute).

---

## 2) Wiring it into `workflows.ts`

In `lib/workflows/generation/workflows.ts`:
- add `execute` under `non_apparel.catalog.v1` that calls `executeNonApparelCatalogWorkflow({ ..., schemaKey: 'non_apparel.catalog.v1' })`

---

## 3) (Context) How execute is invoked at runtime

The cron worker (`lib/db/generations.ts` → `processGenerationJob`) will:
- hydrate file IDs → blob URLs
- resolve the runtime moodboard snapshot
- call `workflow.execute(...)`

So the execute function should **not** try to parse upload URLs or resolve file IDs.