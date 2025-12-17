---
name: Batch image selection step
overview: Batch wizard adds a dedicated per-variant image-selection step (up to 4 images per variant) sourcing from variant.imageUrl, variant generations, uploads, and new uploads; these chosen images become per-job input.product_images.
todos:
  - id: api-image-candidates
    content: Add POST /api/batches/image-candidates to return per-variant generated image candidates (signed) + global uploads, with limits for payload size.
    status: pending
  - id: frontend-image-selection-step
    content: "Add Step 2 to the batch wizard: per-variant image selection (1..4) with sources: variant.imageUrl, generated images, uploads, and upload-new (POST /api/uploads kind=product)."
    status: pending
    dependencies:
      - api-image-candidates
  - id: api-batches-payload-images
    content: Update POST /api/batches to accept productImageUrls[] per variant and merge into workflowInput.product_images per job; validate 1..4.
    status: pending
    dependencies:
      - frontend-image-selection-step
  - id: settings-form-step3-reuse
    content: Move existing generation settings UI (excluding product images) into reusable component for Step 3.
    status: pending
    dependencies:
      - api-batches-payload-images
  - id: worker-batch-folders
    content: Ensure worker writes each output into both per-variant batch folder and shared batch folder for batch jobs.
    status: pending
    dependencies:
      - api-batches-payload-images
---

# Batch Generation: Variant-First + ImageSelectionStep + Per-Variant Batch Folders

## Goal

- Batch generation where the user selects **variants** (up to 100).
- Add an explicit **Image Selection** step after variant selection:
  - For each selected variant, show the image(s) that will be used for generation.
  - User can choose **up to 4 images per variant**.
  - Candidate sources include:
    - `variant.imageUrl`
    - **all generated images for that variant** (variant generations)
    - **user uploads** (global uploads library)
    - **new uploads** created during this step
- Collect remaining generation settings using the existing variant Generate form (but not `product_images`, since those are per-variant).
- Write outputs into both:
  - **Per-variant batch folder** (visible in the variant page folder list)
  - **Shared batch folder** (batch-level browsing)

## Wizard flow

### Step_1_SelectVariants

- Select up to 100 variants (grouped by product).
- No image choice here beyond default preview.

### Step_2_SelectImages_perVariant (new)

- Display a list of selected variants.
- For each variant:
  - Show the currently selected images (initial default = `[variant.imageUrl]` if present).
  - Allow selecting up to 4 images.
  - Provide candidate pickers:
    - **Variant image**: `variant.imageUrl`
    - **Generated**: images from variant generations (variantImages)
    - **Uploads**: from `/api/uploads` (no kind filter)
    - **Upload new**: upload an image and immediately make it selectable
- Validation:
  - Each selected variant must end this step with `1..4` selected images.

### Step_3_GenerationSettings

- Reuse the current Variant “Generate” settings UI:
  - Keep: `numberOfVariations`, aspect ratio, purpose, moodboard, custom instructions, model/background, etc.
  - Omit: product images input grid

### Step_4_ReviewAndStart

- Show summary of variants + their selected image thumbnails.
- Show credits estimate: `variantCount × numberOfVariations`.
- Start: POST `/api/batches`.

## API/Data contracts

### New helper API: image candidates for selected variants

Add a batch-friendly endpoint to avoid N+1 requests:

- **`POST /api/batches/image-candidates`**

Request:

```ts
{ variantIds: number[] }
```

Response:

```ts
{
  variants: Array<{
    variantId: number;
    productId: number;
    variantTitle: string;
    variantImageUrl: string | null;
    generatedImages: Array<{ id: number; url: string; createdAt: string }>;
  }>;
  uploads: Array<{ id: number; url: string; originalName?: string | null; createdAt: string }>;
}
```

Notes:

- `generatedImages` should be signed/proxied URLs (same approach used elsewhere for variant images).
- Apply sane limits (e.g., latest 50 generated images per variant) to keep payload bounded.
- `uploads` can be bounded to latest N (e.g. 200) with search client-side.

### Upload within the step

Reuse existing uploads API:

- `POST /api/uploads` requires a `kind`. For this flow default uploads should use **`kind=product`**.
- The UI uses the returned signed `file.url` to immediately add it to the candidate list.

### Batch creation

- **`POST /api/batches`**

Request:

```ts
{
  name: string,
  variants: Array<{ variantId: number; productImageUrls: string[] }>, // 1..4 each
  settings: {
    schemaKey: string,
    numberOfVariations: number,
    input: {
      // All workflow inputs except product_images
      aspect_ratio?: string,
      purpose?: string,
      moodboard_id?: number | null,
      model_image_url?: string,
      background_image_url?: string,
      custom_instructions?: string[],
      // ...
    }
  }
}
```

Server behavior per job:

- `metadata.input = { ...settings.input, product_images: productImageUrls }`
- `metadata.targetSetId = <perVariantBatchFolderId>`

### Batch retry

- **`POST /api/batches/[batchId]/retry`**
  - Retry failed jobs only.
  - Reuse `metadata.input.product_images` so the same per-variant selected images are used.

## Worker behavior (batch jobs)

In [`/Users/tapanrai/Projects/speedbreakers/contentshop/lib/db/generations.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/db/generations.ts):

- For a job with `batchId`:
  - per-variant folder = `metadata.targetSetId`
  - shared batch folder = `batches.folderId`
  - On each created image, insert two `set_items`:
    - one into per-variant folder
    - one into shared batch folder

## Data model (unchanged from previous plan)

- `batches` table
- `generation_jobs.batchId`
- `sets.batchId` (recommended) to tag folders

## Key frontend building blocks

- Image selection step uses:
  - A per-variant multi-select grid (max 4)
  - Candidate tabs: Variant, Generated, Uploads, UploadNew
  - Existing `AssetPickerField` patterns can be reused for “UploadNew” UX, but Step 2 needs a **multi-select** component (not single URL).

## Key files

- API:
  - `app/api/batches/image-candidates/route.ts` (new)
  - `app/api/batches/route.ts`
  - `app/api/batches/[batchId]/route.ts`
  - `app/api/batches/[batchId]/retry/route.ts`
- DB:
  - `lib/db/batches.ts` (new)
  - `lib/db/generation-jobs.ts` (batch helpers)
  - `lib/db/generations.ts` (batch folder writes)
  - `lib/db/schema.ts` + migration for `batches`, `generation_jobs.batchId`, `sets.batchId`
- Frontend:
  - `app/(dashboard)/dashboard/batches/new/page.tsx` (4-step wizard)
  - Shared components: `BatchVariantSelector`, `BatchVariantImagePicker`, `BatchGenerationSettingsForm`