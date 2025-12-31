# Moodboard v2: Upload-only UX + High-Fidelity Analysis

## Overview

Simplify moodboard creation to a **single upload-and-save flow** while **expanding extracted style data** for richer downstream prompt injection.

**User flow:**
1. Click "New Moodboard"
2. Upload reference images (drag-drop / file picker)
3. Click "Save" → enter name → blocking analysis runs → "Moodboard ready"

**Key principles:**
- All uploaded images are **positive references** (no background/model/negative pooling)
- Analysis runs **immediately on save (blocking)** — user waits for completion
- **No backward-compat constraints** — product not released; prefer breaking changes over legacy support
- **Moodboards belong to Brands** — each brand can have multiple moodboards

---

## Relationship with Brands

Moodboards exist within a Brand hierarchy. See [Brand Implementation](./brand_implementation.md) for full brand details.

```
Team
└── Brand: "Acme Co"          ← provides identity (voice, tone, colors, logo)
    ├── Moodboard: "Summer"   ← provides visual style
    └── Moodboard: "Holiday"
```

**Separation of concerns:**

| Aspect | Source |
|--------|--------|
| Visual style | Moodboard |
| Brand identity | Brand |
| Product details | Product entity |
| Generation params | Request |

---

## Product Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Image categorization | None — all images are positive refs |
| Analysis timing | Immediate blocking on save |
| Backward compatibility | Not required; delete legacy concepts |

---

## UX Specification

### Creation Flow (New Moodboard)

Moodboards are created within a brand context:

```
┌────────────────────────────────────────────────────────────┐
│  New Moodboard for "Acme Co"                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │          │ │          │ │          │ │   +      │      │
│  │  img 1   │ │  img 2   │ │  img 3   │ │  upload  │      │
│  │          │ │          │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│  [Remove]                                   [ Save ]       │
└────────────────────────────────────────────────────────────┘
```

1. **Entry**: `/dashboard/brands/[brandId]/moodboards/new` — user navigates from brand detail page
2. **Upload**: Direct file upload to blob storage; show thumbnails
3. **Actions**: Remove individual images
4. **Save button**: Disabled until >= 1 image uploaded
5. **On Save**:
   - Open modal: "Name your moodboard" (text input)
   - On confirm → transition to **Analyzing...** overlay (full-screen blocker with progress)
   - Disallow navigation without explicit cancel confirmation
6. **Completion**:
   - Success toast: "Moodboard created!"
   - Redirect to `/dashboard/moodboards/[id]` (detail page)
7. **Failure**:
   - Show error with **Retry Analysis** CTA
   - Keep uploaded images; allow retry without re-upload

### Detail Page (Post-Creation)

- **Remove entirely**: Legacy sections for backgrounds, models, negative refs
- **Display**: Uploaded images grid + read-only analysis results (expandable JSON or formatted cards)
- **Edit name**: Inline edit
- **Add images**: Upload additional images → triggers incremental analysis (only new images)
- **Remove images**: Delete images → triggers re-combine (Pass 2 only, no new extraction)

### Moodboard List Page

- Show status badge: `analyzing` | `ready` | `failed`
- Disable "Use for generation" action unless `status=ready`

---

## Data Model

### Schema Changes

**`moodboards` table** — add `status` and `brand_id` columns:

```sql
ALTER TABLE moodboards ADD COLUMN brand_id integer REFERENCES brands(id);
ALTER TABLE moodboards ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ready';
-- Values: 'analyzing' | 'ready' | 'failed'

CREATE INDEX moodboards_brand_id_idx ON moodboards(brand_id);
```

**`moodboard_assets` table** — keep `kind` as `reference_positive`, add `analysis_text`:

All uploaded images use `kind = 'reference_positive'` (existing default). We stop using `background`, `model`, and `reference_negative` kinds.

Add column to store per-image analysis:

```sql
ALTER TABLE moodboard_assets ADD COLUMN analysis_text text;
ALTER TABLE moodboard_assets ADD COLUMN analyzed_at timestamp;
```

This enables **incremental analysis** — only new images need Pass 1; Pass 2 combines all stored analyses.

### `style_profile` JSONB Structure (v2) — Simplified

Flat structure with **text blocks** instead of nested objects. Easier for LLM to produce, flexible for prompt injection.

```typescript
type StyleProfileV2 = {
  version: 2;

  // Core visual (text blocks — free-form descriptions)
  summary: string;         // 2-4 sentence overall visual description
  lighting: string;        // "Soft natural light, warm temperature, dappled shadows"
  palette: string;         // "Dominant cream and sage, muted saturation, terracotta accents"
  camera: string;          // "Shallow DOF, mid-range framing, eye-level, slight telephoto"
  composition: string;     // "Centered subjects, moderate negative space, organic not grid"
  environment: string;     // "Interior home settings, wood, linen, ceramics, natural materials"
  model_styling: string;   // "Models in relaxed athleisure, confident poses, diverse casting"
  props: string;           // "Moderate density — dried botanicals, woven baskets, matte vessels"
  motifs: string;          // "Organic curves, arched doorways, circular shapes, soft edges"
  vibe: string;            // "cozy, natural, artisanal, warm, understated"

  // Ads-specific (optional — only populated if refs show ads/UI patterns)
  ads_design?: string;     // "Grid layout, photography only, flat UI, pill buttons"
  ads_copy?: string;       // "Headline + body + CTA required, no repeated phrases"
  logo_guidance?: string;  // "Logo top-left, prominent but natural"

  // Constraints
  do_not: string;          // "Harsh flash, neon colors, busy patterns, overly staged"

  // Metadata
  image_count: number;
  extracted_at: string;    // ISO timestamp
};
```

### Why Flat Text Blocks?

| Aspect | Benefit |
|--------|---------|
| LLM reliability | Simple flat structure — much easier to produce correctly |
| Flexibility | Free text captures nuance that rigid fields miss |
| Prompt injection | Just concatenate sections — no field extraction logic |
| Schema evolution | Add/remove fields without breaking existing data |

---

## Backend / API Changes

### New API Endpoint: Create + Analyze (Blocking)

**`POST /api/moodboards`** — updated behavior:

```typescript
// Request
{
  name: string;
  imageIds: number[]; // uploaded_file IDs
}

// Response (blocking — waits for analysis)
{
  moodboard: {
    id: number;
    name: string;
    status: 'ready' | 'failed';
    styleProfile: StyleProfileV2;
  };
}
```

Implementation:
1. Create moodboard record with `status='analyzing'`
2. Create moodboard_assets for each imageId (kind='reference_positive')
3. Run analysis synchronously
4. Update `style_profile` and `status='ready'`
5. Return complete moodboard

### Remove Legacy Asset Kinds

- Remove `listMoodboardAssetsByKind` calls for `'background' | 'model' | 'reference_negative'`
- Simplify to single `listMoodboardAssets(teamId, moodboardId)` returning all `reference_positive` assets

### Analysis Pipeline Rewrite (Two-Pass, Incremental)

**Current** (`lib/moodboards/analysis.ts`):
- 4 separate analyzers: backgrounds, models, positive refs, negative refs
- Returns 4 summary strings

**New (two-pass, incremental approach)**:
- **Pass 1**: `extractImageStyleText(image)` → sectioned text per image
  - Stored in `moodboard_assets.analysis_text` column
  - Only runs for images where `analysis_text IS NULL`
- **Pass 2**: `combineExtractionsToProfile(texts[])` → LLM merges all texts into `StyleProfileV2`
  - Runs whenever images are added/removed
  - Uses all stored `analysis_text` values

**Benefits of incremental + parallel approach**:
- Adding 1 image to a 10-image moodboard only requires 1 new extraction (not 10)
- All new images analyzed **in parallel** — 5 images take same time as 1
- Faster updates, lower LLM costs
- Per-image analysis is reusable if needed elsewhere

---

## Analysis Logic (Detailed)

### Two-Pass Approach

1. **Pass 1 (per-image, parallel)**: Extract sectioned text descriptions from each image
   - All images processed **concurrently** using `Promise.all()`
   - Results stored in `moodboard_assets.analysis_text`
2. **Pass 2 (combine)**: Feed all per-image texts to LLM → output structured `StyleProfileV2` JSON

This approach captures richer observations per image and lets the LLM handle consensus/merging naturally. Parallel extraction ensures fast processing even with many images.

---

### Pass 1: Per-Image Text Extraction

For each image, extract free-form text under section headings:

```
Analyze this reference image for a brand moodboard.
Describe what you observe under each heading. Be specific and concise.

VISUAL_STYLE:
(editorial, ecommerce, lifestyle, studio, or mixed — describe the overall feel)

LIGHTING:
(type, softness, direction, any special effects like dappled shadows or lens flare)

PALETTE:
(dominant colors, accent colors, temperature warm/cool, saturation muted/vibrant)

CAMERA_DOF:
(framing close-up/mid/wide, angle, lens feel, depth of field)

COMPOSITION_LAYOUT:
(centering, negative space usage, symmetry, grid or organic)

ENVIRONMENT_MATERIALS:
(setting type, surfaces, materials visible)

MODEL_STYLING:
(if people are present: clothing style, poses, expressions, casting/demographics)

PROPS_TEXTURES:
(prop density, common textures)

MOTIFS_SHAPES:
(recurring shapes or design motifs — arches, circles, pills, grids, etc.)

VIBE_KEYWORDS:
(3-5 mood/vibe words)

GRAPHICS_UI_STYLE:
(if this looks like an ad/layout: graphics policy, layout style, UI elements, depth)

LOGO_PLACEMENT:
(if a logo is visible: where is it placed?)

DO_NOT:
(any styles/elements to avoid based on what this image represents)
```

**Example output (per image):**

```
VISUAL_STYLE:
Lifestyle editorial with warm, inviting feel. Mix of product and context shots.

LIGHTING:
Soft natural window light, warm temperature, gentle shadows. Some images have dappled sunlight through foliage.

PALETTE:
Dominant cream and terracotta. Sage green accents. Muted saturation overall, warm temperature.

CAMERA_DOF:
Shallow depth of field, mid-range framing, eye-level angle. Slightly telephoto compression.

COMPOSITION_LAYOUT:
Centered subjects with moderate negative space. Asymmetric but balanced. No strict grid.

ENVIRONMENT_MATERIALS:
Interior home settings. Wood floors, linen textiles, ceramic vessels, natural materials.

MODEL_STYLING:
Models in relaxed casual wear, natural poses, warm expressions. Mix of ages, authentic non-posed feel.

PROPS_TEXTURES:
Moderate prop density. Linen, woven baskets, dried botanicals, matte ceramics.

MOTIFS_SHAPES:
Organic curves, arched doorways, circular vessels, soft rounded edges.

VIBE_KEYWORDS:
cozy, natural, artisanal, warm, understated

GRAPHICS_UI_STYLE:
Not an ad layout — purely photographic.

LOGO_PLACEMENT:
No logo visible.

DO_NOT:
Harsh flash lighting, neon colors, busy patterns, overly styled/staged looks.
```

---

### Pass 2: LLM Combine → Flat JSON

After collecting all per-image extractions, feed them to the LLM with this prompt:

```
You are given style analysis from multiple reference images for a brand moodboard.
Synthesize these into a single cohesive style profile.

RULES:
- Only include traits that appear consistently across multiple images (2+ images)
- If traits conflict, describe as "mixed" or find common ground
- Only populate ads_design/ads_copy/logo_guidance if multiple images clearly show ad/UI layouts
- Merge all DO_NOT items into a single comma-separated string (deduplicated)
- Each field should be a concise text description (1-3 sentences max)

INPUT (per-image extractions):
---
IMAGE 1:
{extraction_1}
---
IMAGE 2:
{extraction_2}
---
... (all images)
---

Return JSON with these fields:
{
  "version": 2,
  "summary": "Overall 2-4 sentence visual description",
  "lighting": "Lighting description",
  "palette": "Color palette description",
  "camera": "Camera/DOF description",
  "composition": "Composition/layout description",
  "environment": "Environment/materials description",
  "model_styling": "Model styling, poses, wardrobe description",
  "props": "Props/textures description",
  "motifs": "Shapes/motifs description",
  "vibe": "Mood/vibe keywords",
  "ads_design": "Ads layout description (or null if not applicable)",
  "ads_copy": "Copy system description (or null if not applicable)",
  "logo_guidance": "Logo placement guidance (or null if not applicable)",
  "do_not": "Comma-separated list of things to avoid",
  "image_count": <number of images analyzed>,
  "extracted_at": "<ISO timestamp>"
}
```

The flat structure is easy for the LLM to produce reliably.

---

### Why This Approach

| Aspect | Benefit |
|--------|---------|
| Per-image text | Captures nuanced observations that don't fit rigid fields |
| LLM combine | Handles fuzzy consensus (e.g., "warm" vs "golden warm" → "warm") |
| Flat JSON output | Simple structure — LLM produces reliably, easy to validate |
| Text fields | Flexible descriptions, no rigid enums to match |
| Fewer parse failures | Text extraction rarely fails; flat JSON at final step is reliable |
| Incremental analysis | Only new images analyzed; stored per-image texts reused |

---

### Incremental Analysis Flow

When moodboard images change, the system:

```
┌─────────────────────────────────────────────────────────────────┐
│  Moodboard Update (add/remove images)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Identify images needing analysis                            │
│     - New images: analysis_text IS NULL                         │
│     - Existing images: already have analysis_text (skip)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Run Pass 1 on new images IN PARALLEL (Promise.all)          │
│     - extractImageStyleText(image) → sectioned text             │
│     - All images processed concurrently, not sequentially       │
│     - Store each result in moodboard_assets.analysis_text       │
│     - Set analyzed_at = now()                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Collect ALL analysis_text from moodboard assets             │
│     - Both new and existing images                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Run Pass 2 (combine)                                        │
│     - combineExtractionsToProfile(allTexts[])                   │
│     - Output: StyleProfileV2 JSON                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Update moodboard                                            │
│     - Set style_profile = new StyleProfileV2                    │
│     - Set status = 'ready'                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Example scenarios:**

| Scenario | Pass 1 runs on | Pass 2 | Notes |
|----------|----------------|--------|-------|
| Create moodboard with 5 images | 5 images | Yes | Initial creation |
| Add 2 images to existing moodboard | 2 new images only | Yes (with all 7 texts) | Incremental — fast |
| Remove 1 image | None | Yes (with remaining texts) | Deleted asset's analysis_text gone |
| Re-analyze (force refresh) | All images | Yes | Clears all analysis_text first |

**Note on image removal**: When an asset is deleted, its `analysis_text` is removed from DB. Pass 2 re-runs with remaining texts to update the StyleProfileV2.

---

## Prompt Injection (Generation Workflow)

### Current Flow

`lib/workflows/generation/workflows.ts` builds prompts using moodboard summaries.

### Updated Flow — Brand + Moodboard Combined

Generation prompts combine **Brand identity** + **Moodboard visual style**:

1. **Brand section** — name, about, voice, tone, hex colors (see [Brand Implementation](./brand_implementation.md))
2. **Moodboard section** — visual style from StyleProfileV2

```typescript
function buildMoodboardPromptSection(profile: StyleProfileV2): string {
  let prompt = `
## BRAND AESTHETIC (from moodboard)

OVERALL: ${profile.summary}

LIGHTING: ${profile.lighting}

PALETTE: ${profile.palette}

CAMERA/DOF: ${profile.camera}

COMPOSITION: ${profile.composition}

ENVIRONMENT: ${profile.environment}

MODEL STYLING: ${profile.model_styling}

PROPS/TEXTURES: ${profile.props}

MOTIFS/SHAPES: ${profile.motifs}

VIBE: ${profile.vibe}

DO NOT: ${profile.do_not}
`;

  // Add ads-specific sections if present
  if (profile.ads_design) {
    prompt += `\nADS DESIGN: ${profile.ads_design}`;
  }
  if (profile.ads_copy) {
    prompt += `\nCOPY SYSTEM: ${profile.ads_copy}`;
  }
  if (profile.logo_guidance) {
    prompt += `\nLOGO: ${profile.logo_guidance}`;
  }

  return prompt;
}

// Combined prompt building
function buildFullPrompt(brand: Brand, moodboard: Moodboard, product: Product): string {
  return `
${buildBrandPromptSection(brand)}       // from brand-prompt.ts
${buildMoodboardPromptSection(moodboard.styleProfile)}
${buildProductSection(product)}
`;
}
```

### Injection Rules

1. **Brand context**: Always inject name, about, voice, tone
2. **Brand colors**: Inject hex_colors with "do not render as text" instruction
3. **Brand logo**: Include if present and generation type requires it
4. **Moodboard visual style**: All core visual fields (summary through do_not)
5. **Moodboard ads blocks**: Include ads_design, ads_copy, logo_guidance if present

### Source Mapping

| Field | Source | Notes |
|-------|--------|-------|
| Brand name | Brand | |
| Brand description | Brand | `about` field |
| Voice & tone | Brand | |
| Hex colors | Brand | With "do not render as text" protection |
| Logo | Brand | |
| Visual style | Moodboard | Derived from images |
| Ads design/copy | Moodboard | Only if evidence in images |
| Product title/SKU | Product entity | |
| Language | Generation request | Default globally |
| Aspect ratio | Generation request | |

---

## Files to Modify

> Brand-related files are listed in [Brand Implementation](./brand_implementation.md).

| File | Changes |
|------|---------|
| `lib/db/schema.ts` | Add `brand_id`, `status` to moodboards; add `analysis_text`, `analyzed_at` to moodboard_assets |
| `lib/db/moodboards.ts` | Add status handling; add per-image analysis helpers; add brand_id filtering |
| `lib/moodboards/analysis.ts` | Rewrite to two-pass v2 extraction pipeline |
| `lib/moodboards/types.ts` | **New file** — StyleProfileV2 type definition |
| `app/api/brands/[brandId]/moodboards/route.ts` | List/create moodboards for brand |
| `app/api/brands/[brandId]/moodboards/[moodboardId]/route.ts` | Moodboard CRUD within brand |
| `app/api/brands/[brandId]/moodboards/[moodboardId]/analyze/route.ts` | **New file** — Retry analysis |
| `app/(dashboard)/dashboard/brands/[brandId]/moodboards/page.tsx` | Moodboards list for brand |
| `app/(dashboard)/dashboard/brands/[brandId]/moodboards/new/page.tsx` | **New file** — Create moodboard |
| `app/(dashboard)/dashboard/brands/[brandId]/moodboards/[moodboardId]/page.tsx` | **New file** — Moodboard detail |
| `lib/workflows/generation/moodboard-prompt.ts` | **New file** — Moodboard prompt injection |
| `lib/workflows/generation/workflows.ts` | Consume moodboard + brand in prompt building |
| `app/api/moodboards/route.ts` | Update POST to run blocking analysis |
| `app/api/moodboards/[moodboardId]/route.ts` | Handle status; add retry endpoint |
| `app/api/moodboards/[moodboardId]/assets/route.ts` | Always use `reference_positive` kind |
| `app/(dashboard)/dashboard/moodboards/new/page.tsx` | **New file** — upload-only creation UI |
| `app/(dashboard)/dashboard/moodboards/[moodboardId]/page.tsx` | Remove legacy sections; show v2 analysis |
| `app/(dashboard)/dashboard/moodboards/page.tsx` | Add status badges |
| `lib/workflows/generation/workflows.ts` | Consume v2 fields in prompt building |
| `lib/workflows/generation/moodboard-runtime.ts` | Update types to v2 |

---

## Detailed Implementation Todos

> **Prerequisite:** Brand entity must be implemented first. See [Brand Implementation](./brand_implementation.md).

### Phase 1: Schema + Data Model (Moodboards)

- [ ] **1.1** Add `brand_id` and `status` columns to `moodboards` table
  - File: `lib/db/schema.ts`
  - Add: `brand_id: integer('brand_id').references(() => brands.id)`
  - Add: `status: varchar('status', { length: 20 }).notNull().default('ready')`
  - Add index on brand_id
  - Generate migration

- [ ] **1.2** Define `StyleProfileV2` TypeScript type
  - File: `lib/moodboards/types.ts` (new file)
  - Export flat type with string fields (summary, lighting, palette, etc.)
  - Optional fields for ads_design, ads_copy, logo_guidance

- [ ] **1.3** Keep `moodboard_assets.kind` as `reference_positive`
  - Remove code paths that use `'background'`, `'model'`, `'reference_negative'` kinds

- [ ] **1.4** Add `analysis_text` and `analyzed_at` columns to `moodboard_assets`
  - File: `lib/db/schema.ts`
  - Add: `analysis_text: text('analysis_text')` (nullable)
  - Add: `analyzed_at: timestamp('analyzed_at')` (nullable)
  - Generate migration

- [ ] **1.5** Add DB helper for status updates
  - File: `lib/db/moodboards.ts`
  - Add: `updateMoodboardStatus(teamId, id, status)`

- [ ] **1.6** Add DB helpers for per-image analysis
  - File: `lib/db/moodboards.ts`
  - Add: `getAssetsNeedingAnalysis(moodboardId)` — returns assets where `analysis_text IS NULL`
  - Add: `updateAssetAnalysis(assetId, analysisText)` — sets `analysis_text` and `analyzed_at`
  - Add: `getAllAssetAnalyses(moodboardId)` — returns all `analysis_text` values

### Phase 2: Analysis Pipeline Rewrite (Two-Pass, Incremental)

- [ ] **2.1** Create per-image text extraction function (Pass 1)
  - File: `lib/moodboards/analysis.ts`
  - Function: `extractImageStyleText(imageBytes, mimeType): string`
  - Returns sectioned text (VISUAL_STYLE, LIGHTING, PALETTE, etc.)
  - No JSON parsing — just raw text output

- [ ] **2.2** Create LLM combine function (Pass 2)
  - File: `lib/moodboards/analysis.ts`
  - Function: `combineExtractionsToProfile(perImageTexts: string[]): StyleProfileV2`
  - Feeds all per-image texts to LLM with consensus rules
  - Returns structured JSON (validated with Zod)

- [ ] **2.3** Create incremental analysis orchestrator
  - File: `lib/moodboards/analysis.ts`
  - Function: `analyzeMoodboard(moodboardId, authContext): StyleProfileV2`
  - Step 1: Get assets needing analysis (`analysis_text IS NULL`)
  - Step 2: Run Pass 1 on new assets **in parallel** using `Promise.all()`
  - Step 3: Store each `analysis_text` result
  - Step 4: Collect ALL `analysis_text` from moodboard assets
  - Step 5: Run Pass 2 (combine) → return StyleProfileV2
  
  ```typescript
  // Parallel extraction example
  const assetsToAnalyze = await getAssetsNeedingAnalysis(moodboardId);
  const extractions = await Promise.all(
    assetsToAnalyze.map(async (asset) => {
      const text = await extractImageStyleText(asset.url, authContext);
      await updateAssetAnalysis(asset.id, text);
      return { assetId: asset.id, text };
    })
  );
  ```

- [ ] **2.4** Delete legacy analysis functions
  - Remove: `analyzeBackgrounds`, `analyzeModels`, `analyzePositiveReferences`, `analyzeNegativeReferences`
  - Remove: `recomputeMoodboardAssetSummaries` (replace with new orchestrator)

- [ ] **2.5** Add Zod schema for flat StyleProfileV2 validation
  - File: `lib/moodboards/analysis.ts`
  - Simple flat schema: all string fields + optional ads fields
  - Validate final JSON output from Pass 2; retry on failure

- [ ] **2.6** Add force re-analyze option
  - Function: `analyzeMoodboard(moodboardId, authContext, { force: true })`
  - When `force=true`, clear all `analysis_text` first, then re-run full pipeline
  - Useful for "Refresh analysis" CTA in UI

### Phase 3: API Changes

- [ ] **3.1** Update `POST /api/moodboards` to blocking create+analyze
  - File: `app/api/moodboards/route.ts`
  - Accept: `{ name, imageIds[] }`
  - Set `status='analyzing'` → run analysis → set `status='ready'` → return
  - Handle errors: set `status='failed'`, return error

- [ ] **3.2** Add retry analysis endpoint
  - File: `app/api/moodboards/[moodboardId]/analyze/route.ts` (new file)
  - `POST` — re-run analysis for failed moodboards

- [ ] **3.3** Simplify asset creation
  - File: `app/api/moodboards/[moodboardId]/assets/route.ts`
  - Remove `kind` from request body; always use `'reference_positive'`

- [ ] **3.4** Update moodboard GET to include status
  - File: `app/api/moodboards/[moodboardId]/route.ts`
  - Ensure response includes `status` field

### Phase 4: Dashboard UX

- [ ] **4.1** Create new moodboard creation page
  - File: `app/(dashboard)/dashboard/moodboards/new/page.tsx` (new file)
  - Components: dropzone, image grid with remove/reorder, Save button
  - State: `uploadedImages[]`, `isUploading`, `isSaving`, `isAnalyzing`

- [ ] **4.2** Implement upload handling
  - Direct upload to blob storage
  - Show thumbnails immediately
  - Track `uploadedFileId` for each

- [ ] **4.3** Implement Save flow
  - Open name modal on Save click
  - On confirm: show full-screen analyzing overlay
  - Call `POST /api/moodboards` with name + imageIds
  - Block navigation during analysis (beforeunload + router guard)

- [ ] **4.4** Implement completion/error handling
  - Success: toast + redirect to detail page
  - Failure: show error overlay with Retry button

- [ ] **4.5** Update moodboard detail page
  - File: `app/(dashboard)/dashboard/moodboards/[moodboardId]/page.tsx`
  - Remove: backgrounds/models/negative refs sections entirely
  - Add: single "Reference Images" grid
  - Add: expandable/formatted analysis results display
  - Add: status badge + retry button if failed

- [ ] **4.6** Update moodboard list page
  - File: `app/(dashboard)/dashboard/moodboards/page.tsx`
  - Add status badge to each card
  - Disable actions for non-ready moodboards

### Phase 5: Generation Prompt Integration

- [ ] **5.1** Update moodboard runtime types
  - File: `lib/workflows/generation/moodboard-runtime.ts`
  - Update `MoodboardSnapshotV2` to match new flat `StyleProfileV2`

- [ ] **5.2** Create moodboard prompt injection helper
  - File: `lib/workflows/generation/moodboard-prompt.ts` (new file)
  - Function: `buildMoodboardPromptSection(profile: StyleProfileV2): string`
  - Simple string concatenation of text fields

- [ ] **5.3** Update workflow prompt building
  - File: `lib/workflows/generation/workflows.ts`
  - Inject brand context section (from brand-prompt.ts, see [Brand Implementation](./brand_implementation.md))
  - Inject moodboard visual style section
  - Conditionally include ads fields when `purpose=ads`

- [ ] **5.4** Ensure do_not is always injected
  - Moodboard's `do_not` field included in all generation prompts

### Phase 6: Cleanup

- [ ] **6.1** Remove legacy asset kind references
  - Search codebase for `'background' | 'model' | 'reference_negative'`
  - Remove code paths using these kinds (keep `'reference_positive'` as the only kind)

- [ ] **6.2** Remove legacy style_profile fields
  - Remove: `backgrounds_analysis_summary`, `models_analysis_summary`, etc.
  - Ensure all reads expect flat v2 structure (string fields, not nested objects)

- [ ] **6.3** Update any remaining UI that references old structure
  - Check generation flows, previews, etc.

---

## State Machine

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │ create + save
                           ▼
                    ┌─────────────┐
                    │  analyzing  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │ success                 │ failure
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │    ready    │          │   failed    │
       └─────────────┘          └──────┬──────┘
                                       │ retry
                                       ▼
                                ┌─────────────┐
                                │  analyzing  │
                                └─────────────┘
```

---

## Success Criteria

1. User can create moodboard by only uploading images and naming it
2. Analysis completes (blocking) before showing "created"
3. Generated `style_profile.v2` contains all specified visual + optional ads fields
4. Generation prompts correctly consume new fields
5. No references to legacy background/model/negative concepts remain

