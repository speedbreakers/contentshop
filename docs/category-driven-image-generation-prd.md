# Category-driven Image Generation (Fidelity) — PRD

### Summary
Improve generated image quality by introducing **product categories** and **category-specific generation input forms**. Category selection happens at **product creation** and drives which generation schema and UI the user sees when generating images for variants.

### Goals
- **Increase output fidelity** by collecting structured, category-appropriate inputs instead of generic prompts.
- **Reduce user confusion** by showing the right fields for the product category.
- **Preserve reproducibility** by storing the exact generation input payload and schema version used.
- **Keep the system extensible** so we can add more categories and schema versions without rewriting the product.

### Non-goals (for initial release)
- Full Vertex AI integration (we will keep generation mocked until model selection/pipeline is finalized).
- Automated category detection from images or text.
- Complex “campaign” or “workflow builder” UI.
- Credits purchasing / balance management / billing ledger (covered in a separate Credits PRD; this doc only references credit usage requirements).

### Users
- **Merchants / operators** who manage product listings and need consistent image outputs across variants.

### Key Concepts
- **Product Category**: A required attribute on Product that determines the generation schema and UI.
- **Generation Schema**: A versioned JSON input contract used to generate a new image.
- **Generation Record**: An auditable record of one generation attempt, including inputs, outputs, and provenance.

### Categories (V1)
- `apparel`
- `electronics`
- `jewellery`

Notes:
- V1 uses **two schemas**: one for apparel, one for “non-apparel”.
- Later versions may split electronics vs jewellery as we learn what yields best results.

---

## User Experience / Flows

### 1) Create Product
**When** creating a product, the user must choose a **Category**:
- Apparel
- Electronics
- Jewellery

**Acceptance criteria**
- Category is **required**.
- Category is **visible** on the product details page.
- Category changes after creation are allowed only with a warning (“Changing category affects generation forms and saved presets”).

### 2) Generate Images (Variant page)
In the Variant “Generate” flow, the UI renders inputs based on product category:

#### Apparel generation inputs (V1)
```json
{
  "garment_front": "",  // required
  "garment_back": "",
  "garment_left": "",
  "garment_right": "",
  "model_image": "",
  "background_image": "",
  "number_of_variations": 1,
  "output_format": "png",
  "aspect_ratio": "1:1",
  "custom_instructions": ""
}
```

#### Non-apparel generation inputs (V1)
```json
{
  "product_images": [], // required
  "number_of_variations": 1,
  "model_image": "",
  "background_image": "",
  "output_format": "png",
  "aspect_ratio": "1:1",
  "custom_instructions": ""
}
```

**UX details**
- Inputs should support uploading/selecting existing images from:
  - current assets
  - generated outputs
  - prebuilt assets provided by contentshop (for model, background)
  - local upload (preferred)
- Show a compact “Output settings” panel (format, aspect ratio).
- Provide inline validation and helpful guidance (image suggestions).

**Acceptance criteria**
- User cannot start generation unless required inputs are present.
- Submitting creates a “generating” item in the active destination (Default folder by default).
- A “View details” view shows the stored input payload and `custom_instructions`.

---

## Functional Requirements

### Product Category
- Add `category` to Product.
- Category must be one of the supported values.
- Category is used to determine the generation schema shown in the UI.

### Generation Inputs
- The generation form must produce a single JSON payload.
- Payload must validate against the category’s schema (see Validation).
- `custom_instructions` is optional free-text and appended to the structured request.

### Generation Destination
- Default behavior: new generations go to the **Default folder** for that variant.
- User can later move results to other folders.

### View Details (Audit)
For each generated image, the UI must show:
- status, timestamps
- prompt / custom instructions
- full structured input JSON used
- schema name/version

### Credits (dependency)
This PRD assumes a **credits system** exists. The generation UX must be compatible with credit usage rules, but the actual purchasing/balance/ledger implementation is specified in a separate Credits PRD.

**Credit costs**
- **Image generation**: **2 credits per output image**
- **Text generation**: **1 credit per output text variation**
- **Video generation (future)**: **15 credits per output video**

**Multi-output behavior**
- `number_of_variations` controls the number of outputs requested.
- For images, expected credits for one request is 2

**Charging semantics (V1 assumption)**
- Charge per **successfully produced output** (not per request start).
- Failures should not consume credits; retry/idempotency rules are defined in the Credits PRD.

---

## Validation Rules (V1)

### Shared
- `output_format`: enum (`png`, `jpg`, `webp`) — default `png`
- `aspect_ratio`: enum (`1:1`, `4:5`, `3:4`, `16:9`) — default `1:1`
- `number_of_variations`: integer (min 1, max 10) — default `1`
- `custom_instructions`: optional string (max length recommended, e.g. 2k chars)

### Apparel
- `garment_front`: required (file reference / URL)
- At least **one** garment image required (front), recommended >= 2 angles for better results.
- `poses`: list of strings (preset tags or custom values) — optional
- `model_image` / `background_image`: optional

### Non-apparel
- `product_images`: required array (min length 1; recommended >= 2)
- `model_image` / `background_image`: optional

### File/Asset constraints (recommended)
- Enforce max file size (e.g. 10MB) and minimum resolution (e.g. 512px).
- Accept common formats (png/jpg/webp).

---

## Data Model (Proposed)

### Product
Add:
- `category`: enum (`apparel | electronics | jewellery`)

### Generation record (new table)
We should store inputs separate from the final asset to preserve lineage and retries.

Table: `variant_generations`
- `id`
- `teamId`
- `variantId`
- `status` (generating/ready/failed)
- `schemaKey` (e.g. `apparel.v1`)
- `input` (jsonb) — the structured payload above
- `provider` (e.g. `vertex`)
- `providerRequestId` (optional)
- `outputAssetId` (optional ref to `variant_images`)
- `createdAt`, `updatedAt`

**Acceptance criteria**
- The system can display the exact inputs used for any generated image.
- Inputs are versioned via `schemaKey`.

---

## API

### Product
- `POST /api/products`: require `category`
- `PATCH /api/products/:id`: allow changing `category` with warnings + audit

### Generation
- `POST /api/variants/:variantId/generations`
  - Body: `{ schemaKey, input }`
  - Validates schemaKey and input shape
  - Enqueues generation job (mock in MVP)
  - Returns generation record

### Read
- `GET /api/variants/:variantId/generations`
- `GET /api/generations/:id`

---

## UI

### Product Create Dialog
- Add required **Category** select.
- If category is not set, block submit with inline error.

### Variant Generate Dialog
Render fields based on category:
- Apparel: 4 garment image slots + model + background + number of variations + output settings + instructions
- Non-apparel: product_images multi-upload + model + background + number of variations + output settings + instructions

### Folder Download / Image Download
If we keep current mock download behavior:
- “Download folder” downloads all ready images within the folder
- “Download image” downloads single image

---

## Observability / Audit
- Record schemaKey + input JSON for every generation attempt.
- Store error messages for failed attempts.

---

## Rollout Plan (Phased)

### Phase 1 — Schema + UI + Storage (mock generation)
- Add Product category to create product flow and DB.
- Implement dynamic generation form based on category.
- Persist generation input payload to DB (or mock store for now if backend not wired).
- View details shows prompt + input JSON.

### Phase 2 — Provider integration
- Implement Vertex AI pipeline and map schema inputs to provider calls.
- Add retries, rate limiting, and idempotency.

### Phase 3 — Category-specific tuning
- Add jewellery/electronics-specific knobs (lighting, macro, reflections).
- Presets per category (save/load templates).

---

## Decisions (Answered)
- **Category ownership**: Category is set on **Product only** (variants do not override).
- **`model_image` / `background_image`**: These are **file URLs**.
- **Multi-output**: Yes — supported in V1 via `number_of_variations`.

## Open Questions
- None (V1 max variations = 10).


