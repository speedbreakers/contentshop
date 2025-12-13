# Product & Variant Implementation Spec (Team-Owned, Variant-Scoped Assets)

This document is the **source of truth** for how **Products** and **Product Variants** are modeled and how **AI-generated assets** (images/text) and **Shopify linking/sync** work in Content Shop.

## Goals & scope

- **Product** represents an e-commerce product a team sells.
- A product can have **multiple variants**, aligned with Shopify’s model.
- **All generated/uploaded assets are variant-scoped** (no product-level images/text).
  - If you want “product-level” content, use the product’s **default variant**.
- Users can **manually link**:
  - a Content Shop Product ↔ a Shopify Product
  - a Content Shop Variant ↔ a Shopify Variant (within the linked Shopify product)
- Users can generate images/text for each variant and **sync selected assets** to Shopify.
- **Ownership is team-based**; access is granted via membership (`team_members`).

Non-goals (for MVP of this spec):
- Importing full Shopify catalog into Content Shop.
- Bi-directional sync conflict resolution beyond simple “Content Shop pushes selected assets”.

## Ownership & access control (critical)

- Every row in the Product domain is owned by **exactly one team** via `teamId`.
- All reads/writes must be scoped by `teamId` and validated by membership:
  - request user must be a member of `teamId` (`team_members`) and have sufficient role.
- Where we store `createdByUserId`, it is for **audit only** and must not be used as an authorization boundary.

## Core invariants (must always hold)

### Product/variant invariants

- **Every Product must always have at least 1 Variant.**
- `products.defaultVariantId` is the **single source of truth** for the default variant.
- `products.defaultVariantId` must reference a non-deleted variant whose `productId = products.id`.
- Variants belong to exactly one product, and both share the same `teamId`.

### Asset invariants (variant-scoped)

- Every `variant_image` and `variant_text` belongs to exactly one variant.
- A variant may have multiple images/text generations.
- Sync uses **selected** asset pointers on the variant (see below).

### Shopify linking invariants

- A Product can be linked to **at most one** Shopify Product at a time (per store connection).
- A Variant can be linked to **at most one** Shopify Variant at a time.
- A Shopify product/variant should not be linked to two different Content Shop entities within the same team/store (enforce with unique constraints or mapping policy).

## Entity model (tables) and responsibilities

### `shopify_stores` (team-owned store connection)

Represents a connected Shopify shop for a team.

Key fields:
- `id`
- `teamId`
- `shopDomain` (unique)
- `accessToken` (store securely; encrypt at rest)
- `createdAt`, `updatedAt`, `deletedAt`

Notes:
- If you later allow multiple teams to connect the same shop domain, remove global uniqueness and scope uniqueness by `teamId`.

### `products` (team-owned)

Represents an internal product record (aligned with Shopify product concept).

Key fields:
- `id`, `teamId`
- `title`, `status` (`draft|active|archived`)
- Optional merchandising metadata: `vendor`, `productType`, `handle`, `tags`
- Shopify linkage: `shopifyStoreId`, `shopifyProductGid`
- Default variant pointer: `defaultVariantId`
- `createdAt`, `updatedAt`, `deletedAt`

Responsibilities:
- Owns the variant set.
- Holds the Shopify product link (if any).
- Defines the default variant via `defaultVariantId`.

### `product_options` (normalized option schema)

Defines the option schema for a product (Shopify supports up to 3 options).

Key fields:
- `id`, `teamId`, `productId`
- `name` (e.g., `Color`)
- `position` (1..3)

Constraints:
- Unique `(productId, name)`
- Unique `(productId, position)`
- Enforce max 3 options in application validation (or DB constraint if desired).

### `product_variants` (team-owned)

Represents a product variant aligned with Shopify’s “variant”.

Key fields:
- `id`, `teamId`, `productId`
- `title` (required, e.g. `Black / M`, or `Default`)
- Optional: `sku`
- Shopify linkage: `shopifyVariantGid` (optional)

**Selection pointers (critical):**
- `selectedDescriptionTextId`
- `selectedShortCopyTextId`
- `selectedHighlightsTextId`
- `selectedPrimaryImageId`

These pointers determine exactly what gets pushed to Shopify during sync.

Constraints (recommended):
- Unique `(productId, sku)` (if you use SKUs consistently)
- Unique `(teamId, shopifyVariantGid)` (or scope by store—see Shopify linking notes)

### `variant_option_values` (option values per variant)

Stores the value for each product option on a variant.

Key fields:
- `variantId`
- `productOptionId`
- `value`

Constraints:
- Unique `(variantId, productOptionId)` (one value per option per variant)

Important rule:
- For a non-default variant, you typically want values for each defined product option.
- For the default variant, values may be empty (no options) or set explicitly depending on UI needs.

### `variant_images` (variant-scoped images)

Stores both uploaded reference images and AI generated images.

Key fields:
- `id`, `teamId`, `variantId`
- Audit: `createdByUserId` (optional)
- `kind`: `uploaded_reference | ai_generated`
- Generation lifecycle: `status` (`queued|generating|ready|failed`), `error`
- Storage metadata: `storageKey`, `url`, `mimeType`, `sizeBytes`, `width`, `height`, `checksum`
- Ordering: `sortOrder` (for multi-image ordering)
- Provenance: `prompt`, `model`, `providerRequestId`, `params`, `costCents`, `latencyMs`
- `createdAt`

### `variant_texts` (variant-scoped texts)

Stores AI generated text content per variant and type.

Key fields:
- `id`, `teamId`, `variantId`
- Audit: `createdByUserId` (optional)
- `type`: `description | short_marketing_copy | highlights`
- Lifecycle: `status`, `error`
- Content: `content`
- Provenance: `prompt`, `model`, `providerRequestId`, `params`, `costCents`, `latencyMs`
- `createdAt`

### `sync_jobs` and `sync_logs` (auditable Shopify pushes)

`sync_jobs` represents a single sync attempt (product-level or variant-level).

Key fields (`sync_jobs`):
- `id`, `teamId`, `shopifyStoreId`
- Optional scope: `productId`, `variantId` (at least one should be set)
- Audit: `createdByUserId` (optional)
- `status`: `queued|running|succeeded|failed`
- `error`, `startedAt`, `finishedAt`, `createdAt`

Key fields (`sync_logs`):
- `jobId`
- `entityType`: `product|variant|variant_image|variant_text`
- `entityId` (internal id, optional)
- `action` (e.g. `link`, `unlink`, `push_text`, `push_image`)
- `request` (json), `response` (json)
- `createdAt`

## Default variant lifecycle (must be transactional)

### Product creation (required transaction)

Create product and ensure it immediately has a default variant.

Required flow:
1. Insert into `products` with `defaultVariantId = NULL` initially (avoid circular FK issues).
2. Insert the **default variant** into `product_variants`:
   - `title = "Default"` (or localized equivalent)
   - no option values required
3. Update the product row: set `defaultVariantId = <newVariantId>`.

### Removing “default variant”

The user can “remove” the default variant, but the invariant **≥ 1 variant** must hold.

Allowed removal flow:
- If only one variant exists: **disallow deletion**. Require creating another variant first.
- Otherwise:
  1. Choose or create a replacement variant.
  2. Update `products.defaultVariantId` to the replacement variant.
  3. Delete (or soft-delete) the old default variant.
  4. If any `selected*Id` pointers referenced assets on the deleted variant, clear/reselect (see selection rules).

## Variant options (Shopify-aligned)

### Max options

- Shopify supports up to **3 option names** per product (e.g., Color, Size, Material).
- Enforce at creation/update time for `product_options`.

### Consistency

- All variants for a product share the same option schema (`product_options`).
- Ordering is defined by `position` (1..3). Use it when rendering and when generating Shopify variant title.

### Prevent duplicate variants (recommended)

If you want to prevent duplicates like (Color=Black, Size=M) being created twice:
- Compute a normalized “option tuple” in application code (ordered by position), and enforce uniqueness.
  - Example normalized key: `Color=Black|Size=M|Material=`
- Store this key on `product_variants` as `optionsKey` and unique-index `(productId, optionsKey)`.

## Generation & selection semantics (critical)

### Status machine (images and texts)

- `queued`: request accepted, waiting for worker/model
- `generating`: in progress
- `ready`: final content available
- `failed`: generation failed; record `error`

Workers should be idempotent using `providerRequestId` where possible.

### Selection (what gets synced)

The canonical sources for sync are the pointers on `product_variants`:
- `selectedDescriptionTextId` → the Shopify product/variant description target (see sync rules)
- `selectedShortCopyTextId` → used for optional metafield or not synced depending on scope
- `selectedHighlightsTextId` → used for optional metafield or not synced depending on scope
- `selectedPrimaryImageId` → primary variant image to push

Selection rules (recommended):
- When the first `ready` asset of a type is created and no selection exists, auto-select it.
- If the selected asset is deleted/soft-deleted, clear the pointer and select the next best candidate by:
  1. latest created `ready`
  2. or smallest `sortOrder` (images)

### Uploaded images

Reference images are stored in `variant_images` with `kind = uploaded_reference`.
They should never be pushed to Shopify unless explicitly selected (policy decision).

## Shopify linking & sync behavior

### Shopify ID formats

Use Shopify GraphQL IDs (`gid://shopify/...`) in `shopifyProductGid` and `shopifyVariantGid` as strings.

### Manual linking flows

#### Link Product → Shopify Product
- Preconditions:
  - team has a connected `shopify_store`
  - user has permission
- Operation:
  - set `products.shopifyStoreId`
  - set `products.shopifyProductGid`
  - write a `sync_log` entry (`action = "link_product"`)

#### Unlink Product
- Clear `shopifyProductGid` (and optionally `shopifyStoreId` if you want to fully detach).
- Also clear all variant `shopifyVariantGid` (recommended) because variants are only meaningful within the linked Shopify product.

#### Link Variant → Shopify Variant
- Preconditions:
  - product is linked to a Shopify product
  - the Shopify variant belongs to that Shopify product (verify via Shopify API)
- Operation:
  - set `product_variants.shopifyVariantGid`
  - write `sync_log` (`action = "link_variant"`)

#### Unlink Variant
- Clear `shopifyVariantGid`.

### Sync “push” behavior (Content Shop → Shopify)

Sync should be **job-based**:
1. Create `sync_job` in `queued`.
2. Worker transitions to `running`.
3. Perform API calls; log request/response per action in `sync_logs`.
4. Mark job `succeeded` or `failed` with `error`.

#### What gets pushed

Minimum recommended push set (MVP):
- **Images**: push `selectedPrimaryImageId` (and optionally additional images ordered by `sortOrder`).
- **Text**:
  - push `selectedDescriptionTextId` as the Shopify product description (or variant metafield if you choose variant-level text storage).

Important Shopify nuance:
- Shopify’s core `bodyHtml` is **product-level**, not variant-level.
  - If you truly need variant-level text, use Shopify **metafields** on variants.
  - Decide and document which targets you will use:
    - Product description → product `bodyHtml`
    - Variant copy/highlights → variant metafields (recommended for variant-scoped text)

#### Idempotency and retries

- Sync operations should be safe to retry:
  - Use Shopify IDs and deterministic selection pointers.
  - If pushing media, de-dupe using checksum/alt text or stored Shopify media IDs (future enhancement).

#### Rate limiting

- Shopify API is rate-limited; job runner should backoff and record rate-limit responses in logs.

## Soft delete & data retention

Recommended policy:
- Use `deletedAt` for products/variants and keep generated assets for audit unless explicitly purged.

Rules:
- A deleted variant cannot be the product’s default variant.
- If a selected asset is deleted, selection pointers must be cleared/recomputed.
- Never delete `sync_jobs`/`sync_logs` for debugging and audit; keep them indefinitely or per retention policy.

## Recommended indexes (minimum)

- All tables: index `teamId`.
- Variants: index `productId`.
- Assets: index `variantId` and `status`.
- Shopify lookups: index `shopifyProductGid`, `shopifyVariantGid` (scoped uniqueness as chosen).
- Sync: index `shopifyStoreId`, `status`, `createdAt`.

## Operational checklist (for future implementation work)

When implementing Product/Variant features, ensure:
- All mutations are membership-checked against `team_members`.
- Product creation uses the **transactional default variant flow**.
- Any variant deletion preserves invariants (≥1 variant, valid default).
- Generation writes are async-safe (status/provenance).
- Sync uses selection pointers and logs every Shopify request/response.


