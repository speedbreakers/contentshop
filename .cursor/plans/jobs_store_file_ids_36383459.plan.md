---
name: Jobs store file IDs
overview: Update generation job enqueue + execution so job metadata stores only uploaded_file IDs for all image inputs (product, moodboard refs, model/background, edit base/reference) and rejects requests that provide non-upload URLs. The worker rehydrates IDs to stable blobUrls at runtime for both single and batch jobs.
todos: []
---

# Store only file IDs in generation_jobs

##  Goal

Make `generation_jobs.metadata` store **file IDs only** for any image inputs, and **reject enqueue requests** unless all referenced images are upload-backed (i.e., `/api/uploads/:id/file`). This applies to:

- Single generation jobs
- Batch generation jobs
- Edit jobs
- All reference images (product images + moodboard background/model/positive/negative)

## New invariants

- **No image URLs are persisted** in `generation_jobs.metadata`.
- Every image used by a job must be represented as an `uploaded_files.id`.
- Job execution (cron worker) **rehydrates IDs → `uploaded_files.blobUrl`** right before calling workflows / Gemini.

## What changes

### 1) Job metadata schema changes (conceptual)

In `GenerationJobMetadata.input` store:

- `product_image_file_ids: number[]`
- `model_image_file_id?: number`
- `background_image_file_id?: number`

For edit jobs:

- `base_image_file_id: number`
- `reference_image_file_id?: number`

Moodboard stays as it is today:

- `moodboard_snapshot` already contains `*_file_ids` arrays.

Deprecate (stop writing) these URL-based fields in job metadata:

- `input.product_images`
- `input.model_image`, `input.background_image`
- `metadata.extraReferenceImageUrls`, `metadata.backgroundReferenceImageUrls`, `metadata.modelReferenceImageUrls`
- `metadata.authCookie`

### 2) Shared helper

Re-add/create [`lib/uploads/job-assets.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/uploads/job-assets.ts):

- `extractUploadFileId(url)` parses `/api/uploads/:id/file` (absolute or relative)
- `extractUploadFileIds(urls)`
- `resolveUploadedFileBlobUrls(teamId, fileIds)` queries `uploaded_files` and returns stable `blobUrl`s in requested order

### 3) Enqueue: reject non-upload images and persist only IDs

#### Single generation enqueue

File: `[app/api/products/[productId]/variants/[variantId]/generations/route.ts](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/products/[productId]/variants/[variantId]/generations/route.ts)`

- Validate request as before.
- Extract IDs:
- From request `product_images[]` → `product_image_file_ids[]`
- From optional `model_image`/`background_image` → `*_file_id`
- **Reject** with 400 if any URL can’t be parsed as an upload proxy URL.
- Store only the ID fields in `metadata.input` (plus non-image fields like `custom_instructions`, `style_appendix`, `moodboard_snapshot`, etc.).
- Do not store `authCookie`.

#### Batch enqueue

File: [`app/api/batches/route.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/batches/route.ts)

- For each variant’s `productImageUrls`:
- Extract `product_image_file_ids`
- Reject the whole request if any URL isn’t an upload proxy URL.
- Store only IDs in each job’s `metadata.input`.
- Do not store `authCookie`.
- Do not store moodboard URL arrays in metadata; keep `moodboard_snapshot` file IDs only.

#### Edit enqueue

File: `[app/api/products/[productId]/variants/[variantId]/edits/route.ts](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/products/[productId]/variants/[variantId]/edits/route.ts)`

- Extract `base_image_file_id` / `reference_image_file_id`.
- Reject if not upload URLs.
- Store only IDs.
- Do not store `authCookie`.

### 4) Execution: rehydrate IDs to blob URLs before schema validation and before fetches

File: [`lib/db/generations.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/db/generations.ts)

- Add a helper in this file (or import from a new module) that:
- Reads file-id fields from `meta.input`
- Resolves to `blobUrl`s via `resolveUploadedFileBlobUrls(teamId, ids)`
- Produces a `validatedInputCandidate` that includes:
- `product_images: string[]` (blobUrls)
- `model_image?: string` (blobUrl)
- `background_image?: string` (blobUrl)
- This reconstructed object is then passed to `workflow.inputSchema.safeParse(...)`.

- Moodboard references:
- When building strict reference lists for prompt-only execution, rehydrate moodboard snapshot file IDs to blobUrls (no signed proxy URLs).

- Set `authCookie: null` for worker calls (or remove passing it where possible).

### 5) Apparel pipeline uses rehydrated URLs

File: [`lib/workflows/generation/apparel/catalog-execute.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/workflows/generation/apparel/catalog-execute.ts)

- Prefer `input.product_image_file_ids` → resolve to blobUrls if present (for safety / direct execution)
- Otherwise fallback to `input.product_images` (legacy)

### 6) Backward compatibility

- Do not implement any backward compatibility. Assume no older data exists

### Files to change

- [`lib/uploads/job-assets.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/uploads/job-assets.ts)
- `[app/api/products/[productId]/variants/[variantId]/generations/route.ts](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/products/[productId]/variants/[variantId]/generations/route.ts)`
- [`app/api/batches/route.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/batches/route.ts)
- `[app/api/products/[productId]/variants/[variantId]/edits/route.ts](/Users/tapanrai/Projects/speedbreakers/contentshop/app/api/products/[productId]/variants/[variantId]/edits/route.ts)`
- [`lib/db/generations.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/db/generations.ts)
- [`lib/workflows/generation/apparel/catalog-execute.ts`](/Users/tapanrai/Projects/speedbreakers/contentshop/lib/workflows/generation/apparel/catalog-execute.ts)

## Notes

- This approach is stricter than before: it forces callers to provide upload-backed images (fits your selected “reject non-upload images” requirement).