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
- **Executor** (Gemini + Blob + DB persistence): `lib/db/generations.ts`
- **UI purpose selector**: `app/(dashboard)/dashboard/products/[productId]/variants/[variantId]/page.tsx`

--- 

## Step-by-step: adding a new workflow

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

Notes:
- For v1, many workflows can share `baseGenerationInputSchema`.
- If a workflow requires extra inputs later, define a stricter `inputSchema` (extending base) and update UI to supply those fields.

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


