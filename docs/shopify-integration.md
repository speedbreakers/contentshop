## Shopify integration (multi-store, canonical products, explicit variant publish)

This document describes a **detailed v1 implementation** for integrating ContentShop with Shopify while preserving a long-term architecture that can later support other commerce channels (Amazon Seller, Meesho, etc.).

Key decisions (confirmed):
- **Publish**: explicit user action (no automatic push)
- **Target**: **variant media only**
- **Stores**: a team can connect **multiple storefront accounts**
- **Catalog size**: ~100+ products per store
- **Canonical model**: ContentShop stores **canonical products/variants** that can be **linked** to multiple external listings
- **Linking**: external listings can link to **only one** canonical product/variant
  - **Individual linking**: manual picker to link single variant to existing canonical
  - **Bulk Import & Link**: one-click create canonicals from all unlinked externals and auto-link
- **Bulk**: support bulk import from Shopify

--- 

## Goals

1) **Connect multiple Shopify stores** per team.
2) **Bulk sync** external catalog from a chosen store into an "External Catalog" mirror.
3) Allow users to maintain **canonical ContentShop products/variants** that can be linked to:
   - Shopify store A listing(s)
   - Shopify store B listing(s)
   - future channels (Amazon/Meesho)
4) Allow explicit "Publish" of a generated image to a **specific external variant** (variant media only) and persist publish history.

Non-goals (v1):
- Automatic linking/matching by SKU/options
- Automatic publish after generation
- Cross-store deduplication of identical external listings beyond manual linking

--- 

## Concepts and data model

### Canonical vs external

- **Canonical Product/Variant**: the ContentShop "internal" entities used for generation workflows, moodboards, folders/sets, assets, etc.
- **External Listing**: a product/variant as represented in a specific commerce account (Shopify/Amazon/Meesho).

The same canonical product can be linked to multiple external products across multiple accounts. External products can be different or overlapping across stores.

### Tables (recommended)

> Names are suggestions; adapt to existing schema conventions.

#### 1) `commerce_accounts` (storefront connections)
One row per connected storefront account per team.

- `id` (pk)
- `team_id` (fk)
- `provider` (`shopify` | `amazon` | `meesho` | …)
- `display_name` (e.g. "Main D2C Shopify", "India Shopify")
- `status` (`connected` | `disconnected`)
- `created_at`, `updated_at`, `deleted_at`

Provider-specific columns:
- Shopify:
  - `shop_domain` (e.g. `mybrand.myshopify.com`)
  - `access_token` (encrypted at rest)
  - `scopes` (string)
  - `installed_at`
  - `app_uninstalled_at` (nullable)

#### 2) External catalog mirror
Store raw Shopify entities per account (lightweight fields for listing + linking UX).

`external_products`
- `id` (pk)
- `team_id`
- `account_id`
- `provider`
- `external_product_id` (Shopify GID string)
- `title`, `handle`, `status`, `product_type`, `vendor`, `tags` (optional)
- `raw` (jsonb, optional: minimal snapshot)
- `created_at`, `updated_at`
- unique(`account_id`, `external_product_id`)

`external_variants`
- `id` (pk)
- `team_id`
- `account_id`
- `provider`
- `external_product_id` (Shopify product GID)
- `external_variant_id` (Shopify variant GID)
- `title`, `sku`, `selected_options` (jsonb), `price` (optional)
- `raw` (jsonb, optional)
- `created_at`, `updated_at`
- unique(`account_id`, `external_variant_id`)

> Keep `external_*` tables intentionally minimal. They exist to support search/browse and stable linking, not to fully replicate Shopify.

#### 3) Linking (manual)

`product_links`
- `id` (pk)
- `team_id`
- `product_id` (canonical ContentShop product)
- `account_id`
- `provider`
- `external_product_id`
- `status` (`linked` | `broken` | `unlinked`) default `linked`
- `created_at`, `updated_at`
- unique(`account_id`, `external_product_id`)
- unique(`account_id`, `product_id`) (optional, if you want 1 product per account; usually allow multiple external products per canonical across same account only if needed)

`variant_links`
- `id` (pk)
- `team_id`
- `variant_id` (canonical ContentShop variant)
- `account_id`
- `provider`
- `external_product_id`
- `external_variant_id`
- `status` (`linked` | `broken` | `unlinked`) default `linked`
- `created_at`, `updated_at`
- unique(`account_id`, `external_variant_id`)  ✅ enforces "external variant links to only one canonical variant"

#### 4) Publishing history

`asset_publications`
- `id` (pk)
- `team_id`
- `provider` (`shopify` for v1)
- `account_id`
- `product_id` (canonical)
- `variant_id` (canonical)
- `variant_image_id` (the generated image being published)
- `external_product_id`
- `external_variant_id`
- `remote_media_id` (string, Shopify media GID)
- `remote_resource_version` (string/int optional)
- `status` (`pending` | `success` | `failed`)
- `error` (text nullable)
- `created_at`, `updated_at`

--- 

## UX + IA (screens)

### A) Settings → Storefronts

Purpose: connect/manage multiple commerce accounts.

UI:
- List of connected accounts (provider badge, display name, status)
- Actions:
  - Connect Shopify (OAuth)
  - Rename display name
  - Disconnect
  - "Sync catalog" (goes to Sync Wizard)

### B) Sync Wizard (bulk import from a selected store)

Entry points:
- Settings → Storefronts → "Sync catalog"
- Products page → "Import from storefront"

Steps:
1) Choose storefront account (Shopify store)
2) Choose sync mode:
   - **Import into External Catalog only** (default)
   - Import + **Create canonical products** (bulk)  ✅ (your "Bulk" requirement)
3) Run sync (background job with progress + logs)

Results:
- External Catalog shows imported products/variants.
- If "Create canonical products" chosen:
  - Create canonical products/variants (per external product/variant)
  - Create links (`product_links`, `variant_links`)
  - Attach initial images into canonical assets (optional; decide based on storage approach below)

### C) External Catalog (per storefront)

Purpose: browse Shopify products/variants and link to canonical items.

UI:
- Filter by storefront
- Search by title/handle/SKU
- Product rows show:
  - linked/unlinked state
  - link target (canonical product name)
  - action: "Link to canonical…" / "Create canonical + link"

#### Linking modes

**1. Individual Linking (manual)**
- User clicks "Link" on an unlinked external variant
- Searchable picker shows existing canonical products/variants
- User selects which canonical variant to link to
- One link created at a time

Flow:
```
[External Variant] → [Link Button] → [Picker Dialog] → [Select Canonical] → [Confirm]
```

Picker dialog:
- Search by name or SKU
- Show canonical product → variant hierarchy
- Only show unlinked canonical variants (or allow re-linking with warning)

**2. Bulk Import & Link (one-click)**
- User clicks "Bulk Import & Link All" button in external catalog header
- Confirmation dialog shows count of unlinked products/variants
- System creates canonical products from ALL unlinked external products
- System creates canonical variants for each external variant
- Links are automatically created

Flow:
```
[Bulk Import Button] → [Confirmation Dialog] → [Background Job] → [Progress] → [Done]
```

What gets created:
- For each unlinked external product → new canonical `product` + `product_link`
- For each external variant → new canonical `product_variant` + `variant_link`
- Variant names/SKUs copied from external data

#### API shape

```
POST /api/commerce/links/variants
Body: {
  canonical_variant_id: number,
  account_id: number,
  external_product_id: string,
  external_variant_id: string
}
Response: { link: VariantLink }
```

```
DELETE /api/commerce/links/variants/[linkId]
Response: { success: true }
```

```
POST /api/commerce/accounts/[accountId]/bulk-import
Body: {}
Response: {
  job_id: number,
  status: "queued"
}
```

```
GET /api/commerce/accounts/[accountId]/bulk-import/status
Response: {
  status: "running" | "success" | "failed",
  products_created: number,
  variants_linked: number,
  error?: string
}
```

### D) Canonical product/variant pages

Show per-variant:
- "Linked storefront variants" list (store badge + variant title + status)
- "Publish" actions available only when a canonical variant is linked.

### E) Variant assets page → "Publish to Shopify"

Explicit publish from a generated image:
1) Choose storefront account (if multiple linked options exist)
2) Choose linked external variant (already mapped)
3) Choose which image(s) to publish
4) Confirm

UX notes:
- Show last publish status badges from `asset_publications`.
- Use background job to publish; show progress and error.

--- 

## Backend architecture

### Provider modules

Create a provider abstraction for commerce channels:

- `lib/commerce/providers/types.ts`
  - `Provider = 'shopify' | ...`
  - interfaces: `syncCatalog`, `publishVariantMedia`, `verifyWebhook`, etc.
- `lib/commerce/providers/shopify/*`
  - OAuth helpers
  - GraphQL client
  - sync implementation
  - publish implementation
  - webhook verification/handlers

This keeps "Shopify v1" isolated and makes Amazon/Meesho pluggable later.

### Background jobs

100+ products means **sync/publish should be job-based**.

Recommended job approach:
- DB-backed jobs table (or an existing queue if you have one)
- Worker can run via:
  - Next.js server runtime (if small), or
  - a separate worker process / cron / platform job runner

At minimum:
- `commerce_jobs`: `id`, `team_id`, `account_id`, `provider`, `type`, `status`, `progress`, `error`, `created_at`, `updated_at`
  - `type`: `shopify.catalog_sync`, `shopify.publish_variant_media`
  - `status`: `queued|running|success|failed|canceled`

### Vercel Cron Jobs (recommended for v1)

Vercel cron jobs provide a simple, infrastructure-free way to process background jobs. They trigger serverless functions at scheduled intervals.

#### Plan limits

| Plan | Max crons | Min frequency | Function timeout |
|------|-----------|---------------|------------------|
| Hobby | 2 | 1×/day | 10s |
| **Pro** | 40 | 1×/min | 60s (up to 300s with `maxDuration`) |
| Enterprise | 100 | 1×/min | 900s |

#### Recommended cron configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/commerce/cron/process-jobs",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/commerce/cron/sync-all-stores",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/commerce/cron/retry-failed-publishes",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

| Cron | Schedule | Purpose |
|------|----------|---------|
| `process-jobs` | Every minute | Poll `commerce_jobs` table, process `queued` jobs |
| `sync-all-stores` | Daily 3 AM UTC | Safety net: full catalog refresh for all accounts |
| `retry-failed-publishes` | Every 15 min | Retry `asset_publications` with `status=failed` (max 3 attempts) |

#### Cron endpoint implementation

```typescript
// app/api/commerce/cron/process-jobs/route.ts
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { commerceJobs } from '@/lib/db/schema';

export const maxDuration = 60; // Pro plan: up to 60s

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch queued jobs (batch of 5 to stay within timeout)
  const jobs = await db.query.commerceJobs.findMany({
    where: eq(commerceJobs.status, 'queued'),
    limit: 5,
    orderBy: asc(commerceJobs.createdAt),
  });

  const results = [];
  for (const job of jobs) {
    try {
      await db.update(commerceJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(commerceJobs.id, job.id));

      await processJob(job);

      await db.update(commerceJobs)
        .set({ status: 'success', updatedAt: new Date() })
        .where(eq(commerceJobs.id, job.id));

      results.push({ id: job.id, status: 'success' });
    } catch (error) {
      await db.update(commerceJobs)
        .set({ status: 'failed', error: String(error), updatedAt: new Date() })
        .where(eq(commerceJobs.id, job.id));

      results.push({ id: job.id, status: 'failed', error: String(error) });
    }
  }

  return Response.json({ processed: results.length, results });
}

async function processJob(job: typeof commerceJobs.$inferSelect) {
  switch (job.type) {
    case 'shopify.catalog_sync':
      await processCatalogSyncJob(job);
      break;
    case 'shopify.publish_variant_media':
      await processPublishJob(job);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
```

#### Handling long-running catalog syncs (chunked approach)

For stores with 100+ products, a single sync may exceed the 60s timeout. Use a **chunked approach** where each cron invocation processes one page:

```typescript
async function processCatalogSyncJob(job: CommerceJob) {
  const progress = job.progress as { cursor?: string; processed?: number } ?? {};
  const client = await getShopifyClient(job.accountId);

  // Fetch one page (50 products)
  const { data } = await client.query(FETCH_PRODUCTS_QUERY, {
    first: 50,
    after: progress.cursor ?? null,
  });

  const { edges, pageInfo } = data.products;

  // Upsert products + variants
  for (const { node: product } of edges) {
    await upsertExternalProduct(job.accountId, product);
    for (const { node: variant } of product.variants.edges) {
      await upsertExternalVariant(job.accountId, product.id, variant);
    }
  }

  // Update progress
  const newProgress = {
    cursor: pageInfo.endCursor,
    processed: (progress.processed ?? 0) + edges.length,
  };

  if (pageInfo.hasNextPage) {
    // Keep job queued for next cron invocation
    await db.update(commerceJobs)
      .set({ progress: newProgress, status: 'queued', updatedAt: new Date() })
      .where(eq(commerceJobs.id, job.id));
  } else {
    // Done - mark success
    await db.update(commerceJobs)
      .set({ progress: newProgress, status: 'success', updatedAt: new Date() })
      .where(eq(commerceJobs.id, job.id));
  }
}
```

This pattern:
- Processes 50 products per cron invocation (~5-10s)
- Stores cursor in `progress` jsonb column
- Job stays `queued` until all pages processed
- Next cron picks it up and continues

#### Security: CRON_SECRET

Add to Vercel environment variables:

```bash
CRON_SECRET=your-random-secret-here
```

Vercel automatically sends this as `Authorization: Bearer {CRON_SECRET}` header when invoking cron endpoints.

#### Monitoring

- View cron execution logs in Vercel Dashboard → Logs
- Filter by `/api/commerce/cron/*` to see job processing
- Set up alerts for repeated failures

#### Alternative: Inngest / Trigger.dev (for complex workflows)

If v1 crons become limiting, consider upgrading to a dedicated job system:

| Feature | Vercel Crons | Inngest/Trigger.dev |
|---------|-------------|---------------------|
| Max duration | 60-300s | Hours |
| Automatic retries | No | Yes (configurable) |
| Fan-out/parallel | Manual | Native |
| Event-driven triggers | No | Yes |
| Step functions | No | Yes |
| Cost | Included | Additional (~$25/mo+) |

For v1 with ~100 products and simple sync/publish jobs, **Vercel crons + chunked jobs** is sufficient.

--- 

## Shopify specifics (v1)

### OAuth (connect storefront) — authorization code grant

ContentShop is a **non-embedded** custom app, so we use the **authorization code grant** flow.

**Scopes required**:
- `read_products` (for catalog sync)
- `write_products` (for publishing media to variants)
- `write_files` (for uploading images via staged uploads)

#### Endpoints

**1. Install initiation**
```
GET /api/integrations/shopify/install?shop={shop_domain}
```
Redirects to Shopify's OAuth authorize URL:
```
https://{shop}.myshopify.com/admin/oauth/authorize?client_id={client_id}&scope=read_products,write_products,write_files&redirect_uri={redirect_uri}&state={nonce}
```

**2. OAuth callback**
```
GET /api/integrations/shopify/callback?code={code}&hmac={hmac}&shop={shop}&state={nonce}&timestamp={ts}
```
Steps:
1. Verify `hmac` using HMAC-SHA256 with client secret
2. Verify `state` matches the nonce from install
3. Exchange code for access token:

```bash
POST https://{shop}.myshopify.com/admin/oauth/access_token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&client_secret={client_secret}&code={authorization_code}
```

**Response:**
```json
{
  "access_token": "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "scope": "read_products,write_products,write_files"
}
```

4. Create/update `commerce_accounts` row with encrypted `access_token`, `shop_domain`, `scopes`, `status=connected`

> **Security notes:**
> - Store tokens encrypted at rest
> - Validate `shop` parameter format: `/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/`

---

### Bulk catalog sync — GraphQL Admin API

Use the `products` query with cursor-based pagination.

**Query: Fetch products with variants**

```graphql
query FetchProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id                       # gid://shopify/Product/123
        title
        handle
        status
        productType
        vendor
        tags
        featuredMedia {
          preview {
            image {
              url
            }
          }
        }
        variants(first: 100) {
          edges {
            node {
              id                 # gid://shopify/ProductVariant/456
              title
              sku
              price
              selectedOptions {
                name
                value
              }
              image {
                url
              }
            }
          }
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "first": 50,
  "after": null  // or cursor from previous page
}
```

**Pagination loop:**
```typescript
let hasNextPage = true;
let cursor: string | null = null;

while (hasNextPage) {
  const response = await shopifyGraphQL(FETCH_PRODUCTS_QUERY, { first: 50, after: cursor });
  const { pageInfo, edges } = response.data.products;
  
  for (const { node: product } of edges) {
    // Upsert external_products
    // For each product.variants.edges → upsert external_variants
  }
  
  hasNextPage = pageInfo.hasNextPage;
  cursor = pageInfo.endCursor;
}
```

**Idempotency:**
- `external_products`: upsert keyed by `(account_id, external_product_id)`
- `external_variants`: upsert keyed by `(account_id, external_variant_id)`

---

### Publishing variant media — 3-step process

Publishing a generated image to a Shopify variant requires:
1. Upload image to Shopify via staged upload
2. Create product media from the staged upload
3. Attach media to the variant

#### Step 1: Create staged upload target

```graphql
mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables:**
```json
{
  "input": [
    {
      "filename": "generated-variant-image.png",
      "mimeType": "image/png",
      "httpMethod": "POST",
      "resource": "PRODUCT_IMAGE"
    }
  ]
}
```

**Response:**
```json
{
  "stagedUploadsCreate": {
    "stagedTargets": [
      {
        "url": "https://shopify-staged-uploads.storage.googleapis.com",
        "resourceUrl": "https://shopify-staged-uploads.storage.googleapis.com?external_video_id=...",
        "parameters": [
          { "name": "key", "value": "tmp/.../generated-variant-image.png" },
          { "name": "Content-Type", "value": "image/png" },
          { "name": "policy", "value": "..." },
          { "name": "x-goog-credential", "value": "..." },
          { "name": "x-goog-algorithm", "value": "GOOG4-RSA-SHA256" },
          { "name": "x-goog-date", "value": "..." },
          { "name": "x-goog-signature", "value": "..." }
        ]
      }
    ]
  }
}
```

#### Step 2: Upload file to staged target

```typescript
// Build FormData with parameters + file
const formData = new FormData();
for (const param of stagedTarget.parameters) {
  formData.append(param.name, param.value);
}
formData.append('file', imageBuffer, { filename: 'generated-variant-image.png' });

await fetch(stagedTarget.url, {
  method: 'POST',
  body: formData,
});
```

#### Step 3: Create media on product using `fileCreate`

```graphql
mutation FileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      fileStatus
      ... on MediaImage {
        id
        image {
          url
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables:**
```json
{
  "files": [
    {
      "contentType": "IMAGE",
      "originalSource": "{resourceUrl from staged upload}"
    }
  ]
}
```

> **Note:** The `fileCreate` mutation adds the image to the store's Files. To associate it with a specific product, use `productUpdate` with media input, or use the older `productCreateMedia` mutation (deprecated but still available).

#### Step 4: Attach media to variant

```graphql
mutation ProductVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
  productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
    product {
      id
    }
    productVariants {
      id
      media(first: 5) {
        edges {
          node {
            ... on MediaImage {
              id
              image {
                url
              }
            }
          }
        }
      }
    }
    userErrors {
      code
      field
      message
    }
  }
}
```

**Variables:**
```json
{
  "productId": "gid://shopify/Product/123456789",
  "variantMedia": [
    {
      "variantId": "gid://shopify/ProductVariant/987654321",
      "mediaIds": ["gid://shopify/MediaImage/111222333"]
    }
  ]
}
```

**Full publish flow in code:**
```typescript
async function publishVariantMedia(
  accountId: number,
  externalProductId: string,
  externalVariantId: string,
  imageUrl: string,  // ContentShop blob URL
  filename: string
): Promise<{ mediaId: string }> {
  const client = await getShopifyClient(accountId);
  
  // 1. Download image from ContentShop blob
  const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
  
  // 2. Create staged upload
  const stagedUpload = await client.mutation(STAGED_UPLOADS_CREATE, {
    input: [{
      filename,
      mimeType: 'image/png',
      httpMethod: 'POST',
      resource: 'PRODUCT_IMAGE',
    }]
  });
  const target = stagedUpload.stagedUploadsCreate.stagedTargets[0];
  
  // 3. Upload to staged target
  const formData = new FormData();
  for (const p of target.parameters) formData.append(p.name, p.value);
  formData.append('file', new Blob([imageBuffer]), filename);
  await fetch(target.url, { method: 'POST', body: formData });
  
  // 4. Create media on product
  const fileResult = await client.mutation(FILE_CREATE, {
    files: [{ contentType: 'IMAGE', originalSource: target.resourceUrl }]
  });
  const mediaId = fileResult.fileCreate.files[0].id;
  
  // 5. Attach to variant
  await client.mutation(PRODUCT_VARIANT_APPEND_MEDIA, {
    productId: externalProductId,
    variantMedia: [{
      variantId: externalVariantId,
      mediaIds: [mediaId]
    }]
  });
  
  return { mediaId };
}
```

---

### Webhooks — app configuration (TOML) or GraphQL

**Recommended approach:** Configure webhooks via app TOML file for automatic management.

**shopify.app.toml:**
```toml
[webhooks]
api_version = "2024-10"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/api/webhooks/shopify"

[[webhooks.subscriptions]]
topics = ["products/update", "products/delete"]
uri = "/api/webhooks/shopify"
```

**Alternative:** Create via GraphQL mutation:

```graphql
mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription {
      id
      topic
      endpoint {
        ... on WebhookHttpEndpoint {
          callbackUrl
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables:**
```json
{
  "topic": "PRODUCTS_UPDATE",
  "webhookSubscription": {
    "callbackUrl": "https://your-app.com/api/webhooks/shopify",
    "format": "JSON"
  }
}
```

**Topics to subscribe:**
| Topic | Purpose |
|-------|---------|
| `app/uninstalled` | Mark account `disconnected`, revoke token |
| `products/create` | Optionally add to external catalog |
| `products/update` | Sync title/status changes; update `external_products` |
| `products/delete` | Mark linked `external_products` as deleted; set `variant_links.status='broken'` |

**Webhook handler:**
```typescript
// POST /api/webhooks/shopify
export async function POST(request: Request) {
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
  const topic = request.headers.get('X-Shopify-Topic');
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain');
  const body = await request.text();
  
  // Verify HMAC
  const expectedHmac = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  
  if (hmac !== expectedHmac) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const payload = JSON.parse(body);
  const account = await findAccountByShopDomain(shopDomain);
  
  switch (topic) {
    case 'app/uninstalled':
      await markAccountDisconnected(account.id);
      break;
    case 'products/update':
      await syncExternalProduct(account.id, payload);
      break;
    case 'products/delete':
      await markExternalProductDeleted(account.id, payload.id);
      await markVariantLinksBroken(account.id, payload.id);
      break;
  }
  
  return new Response('OK', { status: 200 });
}
```

---

## API endpoints summary

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/integrations/shopify/install` | Initiate OAuth |
| `GET` | `/api/integrations/shopify/callback` | OAuth callback |
| `GET` | `/api/commerce/accounts` | List connected accounts |
| `POST` | `/api/commerce/accounts/:id/sync` | Start catalog sync job |
| `GET` | `/api/commerce/accounts/:id/sync/status` | Check sync job progress |
| `GET` | `/api/commerce/accounts/:id/products` | List external products |
| `GET` | `/api/commerce/accounts/:id/variants` | List external variants |
| `POST` | `/api/products/:id/links` | Create product link |
| `POST` | `/api/variants/:id/links` | Create variant link |
| `DELETE` | `/api/variants/:id/links/:linkId` | Remove variant link |
| `POST` | `/api/commerce/accounts/:id/publish` | Publish image to variant |
| `POST` | `/api/webhooks/shopify` | Receive Shopify webhooks |

---

## Handling "same/different products across stores"

Because external catalogs are per-account, you can support:
- Store A has Product X, Store B doesn't → only one external product exists
- Store A and Store B both have "the same" product (by merchant intent) → the user manually links both external products to the same canonical product

Linking constraints (confirmed):
- A given external product/variant can link to **only one** canonical product/variant.
- Canonical product/variant can link to **many** external listings across accounts.

--- 

## Storage strategy for product images

**Decision: Option 1 — Ingest Shopify images into ContentShop blob storage**

Benefits:
- Stable access with consistent signing/proxy behavior
- Easy reuse in generation workflows (same security model as other uploaded assets)
- No dependency on Shopify CDN URL stability
- Images available even if Shopify store is disconnected

Trade-off:
- Additional storage cost (~$0.15/GB/month on Vercel Blob)

### Data model additions

Add columns to track ingested images:

```sql
-- Add to external_variants table
ALTER TABLE external_variants ADD COLUMN featured_image_url text;      -- Original Shopify CDN URL
ALTER TABLE external_variants ADD COLUMN uploaded_file_id integer REFERENCES uploaded_files(id);  -- Ingested copy
```

Add new upload kind:

```typescript
// lib/db/uploads.ts
export type UploadKind = 'garment' | 'product' | 'model' | 'background' | 'moodboard' | 'shopify_import';
```

### Ingestion flow (during catalog sync)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Shopify CDN URL │────►│ Download to      │────►│ Upload to       │
│ (variant.image) │     │ memory buffer    │     │ Vercel Blob     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Create record   │
                                                 │ in uploaded_files│
                                                 └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Link to         │
                                                 │ external_variant│
                                                 └─────────────────┘
```

### Implementation: `lib/commerce/shopify/ingest-image.ts`

```typescript
import { put } from '@vercel/blob';
import { db } from '@/lib/db/drizzle';
import { uploadedFiles, externalVariants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface IngestImageInput {
  teamId: number;
  accountId: number;
  externalVariantId: number;
  shopifyImageUrl: string;
  variantTitle: string;
}

export async function ingestShopifyImage(input: IngestImageInput): Promise<number | null> {
  const { teamId, externalVariantId, shopifyImageUrl, variantTitle } = input;

  // Skip if no image
  if (!shopifyImageUrl) return null;

  // 1. Download from Shopify CDN
  const response = await fetch(shopifyImageUrl);
  if (!response.ok) {
    console.warn(`Failed to fetch Shopify image: ${shopifyImageUrl}`);
    return null;
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // 2. Determine filename and extension
  const ext = contentType.includes('png') ? 'png' 
            : contentType.includes('webp') ? 'webp' 
            : contentType.includes('gif') ? 'gif' 
            : 'jpg';
  const safeName = variantTitle.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 50) || 'variant';
  const filename = `${safeName}.${ext}`;

  // 3. Upload to Vercel Blob
  const pathname = `team-${teamId}/shopify-import/${Date.now()}-${crypto.randomUUID()}-${filename}`;
  const blob = new Blob([buffer], { type: contentType });

  const result = await put(pathname, blob, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // 4. Create uploaded_files record
  const [uploadedFile] = await db
    .insert(uploadedFiles)
    .values({
      teamId,
      kind: 'shopify_import',
      pathname: result.pathname,
      blobUrl: result.url,
      originalName: filename,
      contentType,
      size: buffer.byteLength,
    })
    .returning();

  // 5. Link to external_variant
  await db
    .update(externalVariants)
    .set({ uploadedFileId: uploadedFile.id })
    .where(eq(externalVariants.id, externalVariantId));

  return uploadedFile.id;
}
```

### Batch ingestion during sync job

```typescript
// lib/commerce/shopify/sync-catalog.ts

async function syncProductWithImages(
  teamId: number,
  accountId: number,
  product: ShopifyProduct
) {
  // 1. Upsert external_product
  const externalProduct = await upsertExternalProduct(accountId, product);

  // 2. Process each variant
  for (const variant of product.variants.edges) {
    const { node } = variant;

    // Upsert external_variant
    const externalVariant = await upsertExternalVariant(accountId, product.id, node);

    // Get image URL (variant image or fallback to product featured image)
    const imageUrl = node.image?.url || product.featuredMedia?.preview?.image?.url;

    // Skip if already ingested (check uploadedFileId)
    if (externalVariant.uploadedFileId) continue;

    // Ingest image (async, can be batched)
    if (imageUrl) {
      await ingestShopifyImage({
        teamId,
        accountId,
        externalVariantId: externalVariant.id,
        shopifyImageUrl: imageUrl,
        variantTitle: `${product.title} - ${node.title}`,
      });
    }
  }
}
```

### Deferred ingestion (optional optimization)

For faster initial sync, defer image ingestion:

```typescript
// During sync: just store the Shopify URL
await db.update(externalVariants).set({
  featuredImageUrl: imageUrl,
  uploadedFileId: null,  // Not yet ingested
});

// Later: background job ingests images
// GET /api/commerce/cron/ingest-images
export async function GET(request: Request) {
  // Find variants with featuredImageUrl but no uploadedFileId
  const pending = await db.query.externalVariants.findMany({
    where: and(
      isNotNull(externalVariants.featuredImageUrl),
      isNull(externalVariants.uploadedFileId)
    ),
    limit: 20,  // Batch size
  });

  for (const variant of pending) {
    await ingestShopifyImage({
      teamId: variant.teamId,
      accountId: variant.accountId,
      externalVariantId: variant.id,
      shopifyImageUrl: variant.featuredImageUrl!,
      variantTitle: variant.title,
    });
  }

  return Response.json({ ingested: pending.length });
}
```

Add cron for deferred ingestion:

```json
// vercel.json
{
  "crons": [
    // ... existing crons ...
    {
      "path": "/api/commerce/cron/ingest-images",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Using ingested images in generation workflows

When creating a canonical product from an external product, copy the ingested image:

```typescript
async function createCanonicalFromExternal(
  teamId: number,
  externalVariantId: number
) {
  const externalVariant = await db.query.externalVariants.findFirst({
    where: eq(externalVariants.id, externalVariantId),
  });

  // Create canonical variant
  const canonicalVariant = await createVariant({ ... });

  // If external has ingested image, attach it to canonical
  if (externalVariant.uploadedFileId) {
    // Option A: Reference same uploaded_file
    await attachVariantImage(canonicalVariant.id, externalVariant.uploadedFileId);

    // Option B: Copy to variant_images table as a "source" image
    const uploadedFile = await db.query.uploadedFiles.findFirst({
      where: eq(uploadedFiles.id, externalVariant.uploadedFileId),
    });
    await db.insert(variantImages).values({
      teamId,
      variantId: canonicalVariant.id,
      status: 'ready',
      url: uploadedFile.blobUrl,
      prompt: null,
      schemaKey: null,
      input: { source: 'shopify_import', externalVariantId },
    });
  }
}
```

### Storage cleanup

When an external variant is deleted (from webhook or manual unlinking), optionally clean up:

```typescript
async function cleanupExternalVariant(externalVariantId: number) {
  const variant = await db.query.externalVariants.findFirst({
    where: eq(externalVariants.id, externalVariantId),
  });

  if (variant?.uploadedFileId) {
    // Check if any other variant or canonical uses this file
    const usageCount = await countFileUsages(variant.uploadedFileId);

    if (usageCount === 0) {
      // Delete from Vercel Blob
      const file = await db.query.uploadedFiles.findFirst({
        where: eq(uploadedFiles.id, variant.uploadedFileId),
      });
      if (file) {
        await del(file.blobUrl);
        await db.delete(uploadedFiles).where(eq(uploadedFiles.id, file.id));
      }
    }
  }
}
```

### Summary: Image flow

| Stage | Data | Location |
|-------|------|----------|
| Shopify product | CDN URL | `external_variants.featured_image_url` |
| Ingested copy | Vercel Blob | `uploaded_files` → `external_variants.uploaded_file_id` |
| Canonical variant | Blob URL ref | `variant_images.url` |
| Generated output | New blob | `variant_images.url` |
| Published to Shopify | New media | `asset_publications.remote_media_id` |

--- 

## Rollout plan (phased)

### Phase 0: schema + provider skeleton
- Add tables: `commerce_accounts`, `external_products`, `external_variants`, `product_links`, `variant_links`, `asset_publications`, `commerce_jobs`
- Add provider interfaces + Shopify client skeleton

### Phase 1: Shopify OAuth connect + accounts UI
- Connect/disconnect Shopify stores
- Storefront list page

### Phase 2: Bulk sync into External Catalog
- Sync wizard (pick store → run job)
- External catalog browsing UI + search

### Phase 3: Linking (manual + bulk)
- **Individual linking**: Link single external variant to existing canonical variant
  - Searchable canonical variant picker
  - Link/unlink actions in external catalog
- **Bulk Import & Link**: One-click import all unlinked external products
  - Creates canonical products/variants from external data
  - Auto-creates product_links and variant_links
  - Background job with progress tracking
- Show linked status in external catalog UI
- Show linked storefronts on canonical variant pages

### Phase 4: Explicit publish (variant media only)
- Add explicit publish from a generated image to a **linked external variant** (Shopify).
- Publish is always **manual** (explicit user action) and publishes **variant media only**.

#### UX (Variant Assets page)
- Location: canonical variant page → generated images list/grid.
- Add a **Publish** button on each generated image (or a bulk select → Publish action).
- Publish modal:
  - Step 1: **Choose storefront account** (only show accounts that are linked to this canonical variant).
  - Step 2: **Choose external variant** (if multiple links exist under that account; otherwise preselect).
  - Step 3: Confirm what will be published:
    - The selected image URL (ContentShop blob URL)
    - Destination: `{shopDomain} → {externalVariant.title}`
  - Step 4: Submit → show progress (queued/running/success/failed).
- Show publish history inline:
  - “Last published” status badge for this image+destination.
  - “View publish history” table (from `asset_publications`).

#### Backend (API + Jobs)
We publish via a job (to avoid Shopify + upload latency issues and allow retries).

**1) Start publish**
```
POST /api/commerce/accounts/[accountId]/publish
Body: {
  variant_id: number,          // canonical variant id
  variant_image_id: number,    // generated image id
  external_product_id: string, // Shopify product GID
  external_variant_id: string  // Shopify variant GID
}
Response: {
  status: "queued",
  job: { id: number, status: "queued" },
  publication: { id: number, status: "pending" }
}
```

Server behavior:
- Validate: account belongs to team, canonical variant belongs to team, and the `(account_id, external_variant_id)` is linked to that canonical variant.
- Create `asset_publications` row with `status='pending'` (attempts=1).
- Create `commerce_jobs` row:
  - `type='shopify.publish_variant_media'`
  - `metadata`: `{ publicationId, variantImageId, externalProductId, externalVariantId }`

**2) Fetch publish history**
```
GET /api/commerce/publications?variant_id=...  (or variant_image_id=...)
Response: { publications: AssetPublication[] }
```

#### Job processor (Vercel cron)
Update the cron worker (`/api/commerce/cron/process-jobs`) to process `shopify.publish_variant_media`:
- Load job metadata + publication record
- Download image bytes from ContentShop blob URL (`variant_images.url`)
- Call Shopify publish pipeline (already scaffolded):
  - staged upload → fileCreate → productVariantAppendMedia
  - implemented in `lib/commerce/providers/shopify/publish.ts`
- On success:
  - `asset_publications.status='success'`
  - persist `remote_media_id`
  - mark `commerce_jobs.status='success'`
- On failure:
  - `asset_publications.status='failed'`, set `error`, increment `attempts`
  - mark `commerce_jobs.status='failed'` (or keep as failed and rely on a retry worker)

#### Retry strategy
Add a retry cron (recommended) to retry failed publishes:
- Endpoint: `GET /api/commerce/cron/retry-failed-publishes`
- Rules:
  - Retry only `asset_publications.status='failed'` and `attempts < 3`
  - Create a new `commerce_jobs` row referencing the existing `publicationId` (or re-queue the original job)
  - Backoff: at least 15 minutes between retries

#### Idempotency / safety
- Prevent duplicate publish spam:
  - If there is already a `pending` publication for the same `(variant_image_id, account_id, external_variant_id)`, return 409.
- Keep publish history immutable:
  - Each attempt is recorded (either by incrementing attempts on the same row, or by creating a new row per attempt; v1 can use attempts on a single row as implemented).

--- 

## Testing checklist

### OAuth + accounts
- Connect 2 Shopify stores to the same team
- Disconnect one store (ensure token invalidated + status updates)

### Sync
- Run bulk sync for store A, verify `external_*` counts ~100+ products
- Run again (idempotent upsert; no duplicates)

### Individual linking
- Link single external variant from store A to an existing canonical variant
- Verify link appears in external catalog UI
- Verify linked storefront appears on canonical variant page
- Ensure external variant cannot be linked to two canonicals (unique constraint)
- Unlink a variant and verify status updates

### Bulk Import & Link
- Click "Bulk Import & Link All" for store A
- Verify confirmation dialog shows correct unlinked count
- Run bulk import job
- Verify canonical products/variants created
- Verify all links created automatically
- Run again (should show 0 unlinked - idempotent)

### Cross-store linking
- Sync store B
- Manually link external product from store B to canonical product created from store A
- Verify one canonical can have links to multiple stores

### Publish
- Publish a generated image to a linked external variant
- Verify `asset_publications` row transitions: pending → success
- Verify Shopify reflects the variant media change
- Failure case: revoke token; publish should fail with clear error and status `failed`

---

## GraphQL operations reference

### Products query (catalog sync)
```graphql
query FetchProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage, endCursor }
    edges {
      node {
        id, title, handle, status, productType, vendor, tags
        variants(first: 100) {
          edges {
            node {
              id, title, sku, price
              selectedOptions { name, value }
            }
          }
        }
      }
    }
  }
}
```
**Required scope:** `read_products`

### Staged uploads (for publishing)
```graphql
mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url, resourceUrl, parameters { name, value } }
    userErrors { field, message }
  }
}
```
**Required scope:** `write_files`

### File create
```graphql
mutation FileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files { id, fileStatus, ... on MediaImage { id } }
    userErrors { field, message }
  }
}
```
**Required scope:** `write_files`

### Attach media to variant
```graphql
mutation ProductVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
  productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
    product { id }
    productVariants { id }
    userErrors { code, field, message }
  }
}
```
**Required scope:** `write_products`

### Webhook subscription (GraphQL alternative)
```graphql
mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id, topic }
    userErrors { field, message }
  }
}
```

---

## API version

Use the latest stable Shopify Admin API version. As of this writing, **2025-10** or **2025-07** are recommended.

Set the version in your GraphQL client:
```
https://{shop}.myshopify.com/admin/api/2025-10/graphql.json
```

And in webhook TOML configuration:
```toml
[webhooks]
api_version = "2025-10"
```
