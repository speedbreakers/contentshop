---
name: Non-Apparel "Shoot" Workflow Implementation (Revised)
overview: Implement the non-apparel catalog generation workflow ("Shoot" mode) using an anchor-image strategy for consistency. Revised to exclude `shoot_mode` from the input schema as requested. The implementation will focus on the generation helper, execution pipeline, and wiring.
todos:
  - id: create-image-helper
    content: Create lib/ai/non-apparel/generate-shoot-images.ts with anchor image loop
    status: completed
  - id: create-execute-pipeline
    content: Create lib/workflows/generation/non-apparel/catalog-execute.ts pipeline
    status: completed
    dependencies:
      - create-image-helper
  - id: register-workflow
    content: Register execute handler in lib/workflows/generation/workflows.ts
    status: completed
    dependencies:
      - create-execute-pipeline
---

# Non-Apparel "Shoot" Workflow Implementation (Revised)

## 1. Create Image Generation Helper

- **File**: `lib/ai/non-apparel/generate-shoot-images.ts` (New File)
- **Purpose**: Specific generation loop logic for non-apparel shoots.
- **Key Logic**:
- Accept hydrated inputs (blob URLs).
- **Loop**:
- **Image 1 (Anchor)**: Generate using product images (+ optional model). Upload to Vercel Blob.
- **Images 2..N**: Generate using **Image 1** + product images as reference. Upload to Vercel Blob.
- Return array of `{ blobUrl, prompt }`.

## 2. Create Execute Pipeline

- **File**: `lib/workflows/generation/non-apparel/catalog-execute.ts` (New File)
- **Purpose**: Main orchestrator for `non_apparel.catalog.v1`.
- **Steps**:

1.  **Validation**: Check product/variant existence.
2.  **DB Init**: Create `variantGenerations` record with status 'generating'.
3.  **Resolution**:

- `resolveCatalogBackground` (P0: input image, P1: custom/moodboard).
- `resolveCatalogModel` (if model_enabled).

4.  **Prompting**: Build single "Final Prompt" string (product rules + background + lighting + model + moodboard text).
5.  **Generation**: Call `generateNonApparelShootImages` (from step 1).
6.  **Persistence**: Save outputs using `createVariantGenerationWithProvidedOutputs`.

## 3. Register Workflow

- **File**: [`lib/workflows/generation/workflows.ts`](lib/workflows/generation/workflows.ts)
- **Action**:
- Import `executeNonApparelCatalogWorkflow`.
- Update `generationWorkflows['non_apparel.catalog.v1'] `to include the `execute` property.

## 4. Validation

- Verify compilation and ensure the execute function signature matches the workflow runner expectation.