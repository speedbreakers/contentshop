# Brand Implementation

## Overview

Implement the Brand entity as a container for brand identity that owns moodboards. Brands provide voice, tone, colors, fonts, and logo that complement moodboard visual styles during generation.

This implementation includes a **Brand Memory Scraper** that can automatically extract brand identity from a website URL using AI-powered web scraping with Google Gemini-2.5-Flash and Cheerio.

**Hierarchy:**
```
Team
└── Brand: "Acme Co"
    ├── Moodboard: "Summer 2024"
    └── Moodboard: "Holiday Campaign"
└── Brand: "Acme Kids"
    └── Moodboard: "Playful Pastels"
```

**Key principles:**
- Each team can have multiple brands
- Each brand can have multiple moodboards
- Moodboards must belong to a brand
- Brand provides identity; moodboard provides visual style
- Brands can be created manually or imported from a URL

---

## Data Model

### Schema

**`brands` table:**

```sql
CREATE TABLE brands (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id),
  
  -- Core Identity
  name varchar(255) NOT NULL,
  mission text,                          -- brand mission statement
  tagline varchar(500),
  tagline_tones jsonb DEFAULT '[]',      -- array of tone strings
  values jsonb DEFAULT '[]',             -- array of brand value strings
  unique_selling_points jsonb DEFAULT '[]',  -- array of USP strings
  differentiator text,                   -- key competitive advantage
  
  -- Voice & Communication
  voice varchar(255),
  tone varchar(255),
  tone_of_voice text,                    -- detailed tone guidance
  use_emojis boolean DEFAULT false,
  website_language varchar(10) DEFAULT 'EN',
  
  -- Target Audience
  ideal_customer text,                   -- target customer description
  motivators jsonb DEFAULT '[]',         -- array of audience motivators
  pain_points jsonb DEFAULT '[]',        -- array of customer pain points
  niches jsonb DEFAULT '[]',             -- array of industry categories
  what_you_sell varchar(50) DEFAULT 'Physical Products',  -- 'Physical Products', 'SaaS', 'Services'
  
  -- Business-type specific (mutually exclusive based on what_you_sell)
  products jsonb DEFAULT '[]',           -- Physical Products: scraped product catalog
  features jsonb DEFAULT '[]',           -- SaaS: product features
  services jsonb DEFAULT '[]',           -- Services: service offerings
  
  -- Visual Identity
  primary_colors jsonb DEFAULT '[]',     -- array of {value: hex, label: string}
  secondary_colors jsonb DEFAULT '[]',   -- array of {value: hex, label: string}
  colors_usage text,                     -- guidelines for color application
  fonts jsonb DEFAULT '[]',              -- array of font objects
  
  -- Logo
  logo_url varchar(2048),                -- primary logo URL
  logo_urls jsonb DEFAULT '[]',          -- array of logo URL strings
  logo_dominant_colors jsonb DEFAULT '[]',
  logo_file_id integer REFERENCES uploaded_files(id),
  
  -- Competitive Context
  competitors jsonb DEFAULT '[]',        -- array of competitor names
  competitor_strengths text,
  competitor_weaknesses text,
  emerging_trends text,
  
  -- Content Guidelines
  keywords jsonb DEFAULT '[]',           -- array of keywords to include
  keywords_to_avoid jsonb DEFAULT '[]',  -- array of keywords to avoid
  copy_examples_good jsonb DEFAULT '[]', -- array of good copy examples
  copy_examples_bad jsonb DEFAULT '[]',  -- array of bad copy examples
  extra_guidelines text,                 -- additional brand rules
  
  -- Scraper metadata
  source_url varchar(2048),              -- URL brand was scraped from
  scrape_confidence jsonb,               -- confidence scores per field
  last_scraped_at timestamp,
  
  -- System fields
  status varchar(50) DEFAULT 'active',   -- 'active', 'archived'
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX brands_team_id_idx ON brands(team_id);
CREATE INDEX brands_team_deleted_at_idx ON brands(team_id, deleted_at);
CREATE INDEX brands_status_idx ON brands(status);
```

**Drizzle schema (`lib/db/schema.ts`):**

```typescript
export const brands = pgTable(
  'brands',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    // Core Identity
    name: varchar('name', { length: 255 }).notNull(),
    mission: text('mission'),
    tagline: varchar('tagline', { length: 500 }),
    taglineTones: jsonb('tagline_tones').notNull().default([]),
    values: jsonb('values').notNull().default([]),
    uniqueSellingPoints: jsonb('unique_selling_points').notNull().default([]),
    differentiator: text('differentiator'),

    // Voice & Communication
    voice: varchar('voice', { length: 255 }),
    tone: varchar('tone', { length: 255 }),
    toneOfVoice: text('tone_of_voice'),
    useEmojis: boolean('use_emojis').notNull().default(false),
    websiteLanguage: varchar('website_language', { length: 10 }).notNull().default('EN'),

    // Target Audience
    idealCustomer: text('ideal_customer'),
    motivators: jsonb('motivators').notNull().default([]),
    painPoints: jsonb('pain_points').notNull().default([]),
    niches: jsonb('niches').notNull().default([]),
    whatYouSell: varchar('what_you_sell', { length: 50 }).notNull().default('Physical Products'),

    // Business-type specific (mutually exclusive based on whatYouSell)
    products: jsonb('products').notNull().default([]),   // Physical Products
    features: jsonb('features').notNull().default([]),   // SaaS
    services: jsonb('services').notNull().default([]),   // Services

    // Visual Identity
    primaryColors: jsonb('primary_colors').notNull().default([]),
    secondaryColors: jsonb('secondary_colors').notNull().default([]),
    colorsUsage: text('colors_usage'),
    fonts: jsonb('fonts').notNull().default([]),

    // Logo
    logoUrl: varchar('logo_url', { length: 2048 }),
    logoUrls: jsonb('logo_urls').notNull().default([]),
    logoDominantColors: jsonb('logo_dominant_colors').notNull().default([]),
    logoFileId: integer('logo_file_id').references(() => uploadedFiles.id),

    // Competitive Context
    competitors: jsonb('competitors').notNull().default([]),
    competitorStrengths: text('competitor_strengths'),
    competitorWeaknesses: text('competitor_weaknesses'),
    emergingTrends: text('emerging_trends'),

    // Content Guidelines
    keywords: jsonb('keywords').notNull().default([]),
    keywordsToAvoid: jsonb('keywords_to_avoid').notNull().default([]),
    copyExamplesGood: jsonb('copy_examples_good').notNull().default([]),
    copyExamplesBad: jsonb('copy_examples_bad').notNull().default([]),
    extraGuidelines: text('extra_guidelines'),

    // Scraper metadata
    sourceUrl: varchar('source_url', { length: 2048 }),
    scrapeConfidence: jsonb('scrape_confidence'),
    lastScrapedAt: timestamp('last_scraped_at'),

    // System fields
    status: varchar('status', { length: 50 }).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    teamIdx: index('brands_team_id_idx').on(t.teamId),
    teamDeletedIdx: index('brands_team_deleted_at_idx').on(t.teamId, t.deletedAt),
    statusIdx: index('brands_status_idx').on(t.status),
  })
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
```

### TypeScript Types

```typescript
// Color with label
type BrandColor = {
  value: string;  // hex format: #RRGGBB
  label: string;  // e.g., "Ocean Blue"
};

// Font definition
type BrandFont = {
  family: string;    // e.g., "Inter", "Playfair Display"
  usage: 'heading' | 'paragraph';
  size: string;      // e.g., "16px", "1.2rem"
  weight: string;    // e.g., "400", "bold"
  color: string;     // hex format
  fileUrl: string | null;  // URL for custom font files
};

// What the brand sells
type WhatYouSell = 'Physical Products' | 'SaaS' | 'Services';

// Scraped image with metadata
type ScrapedImage = {
  url: string;                 // Full image URL
  alt: string | null;          // Alt text
  type: 'hero' | 'gallery' | 'thumbnail' | 'icon' | 'other';
  width: number | null;        // Image width if available
  height: number | null;       // Image height if available
};

// Product (scraped from website, only for Physical Products)
type BrandProduct = {
  name: string;
  description: string | null;
  price: string | null;        // e.g., "$49.99", "SGD 120"
  currency: string | null;     // e.g., "USD", "SGD"
  category: string | null;     // e.g., "Shoes", "T-Shirts"
  url: string;                 // product page URL
  images: ScrapedImage[];      // all images from product page
};

// Feature (scraped from website, only for SaaS)
type BrandFeature = {
  name: string;                // e.g., "Real-time Analytics"
  description: string | null;  // Feature description
  category: string | null;     // e.g., "Analytics", "Integrations", "Security"
  url: string | null;          // Feature page URL if exists
  images: ScrapedImage[];      // screenshots, icons, illustrations
};

// Service (scraped from website, only for Services)
type BrandService = {
  name: string;                // e.g., "Brand Strategy Consulting"
  description: string | null;  // Service description
  category: string | null;     // e.g., "Consulting", "Design", "Development"
  priceRange: string | null;   // e.g., "Starting at $5,000", "Contact for pricing"
  url: string | null;          // Service page URL
  images: ScrapedImage[];      // portfolio, case study, service images
};

// Brand status
type BrandStatus = 'active' | 'archived';

// Confidence scores from scraper
type ScrapeConfidence = {
  name: { confidence: number; evidence: string };
  logo: { confidence: number; evidence: string };
  tagline: { confidence: number; evidence: string };
  colors: { confidence: number; evidence: string };
  fonts: { confidence: number; evidence: string };
  mission: { confidence: number; evidence: string };
  values: { confidence: number; evidence: string };
};

// Full Brand type
type Brand = {
  id: number;
  teamId: number;
  
  // Core Identity
  name: string;
  mission: string | null;
  tagline: string | null;
  taglineTones: string[];
  values: string[];
  uniqueSellingPoints: string[];
  differentiator: string | null;
  
  // Voice & Communication
  voice: string | null;
  tone: string | null;
  toneOfVoice: string | null;
  useEmojis: boolean;
  websiteLanguage: string;
  
  // Target Audience
  idealCustomer: string | null;
  motivators: string[];
  painPoints: string[];
  niches: string[];
  whatYouSell: WhatYouSell;
  
  // Business-type specific (mutually exclusive)
  products: BrandProduct[];   // only for Physical Products
  features: BrandFeature[];   // only for SaaS
  services: BrandService[];   // only for Services
  
  // Visual Identity
  primaryColors: BrandColor[];
  secondaryColors: BrandColor[];
  colorsUsage: string | null;
  fonts: BrandFont[];
  
  // Logo
  logoUrl: string | null;
  logoUrls: string[];
  logoDominantColors: string[];
  logoFileId: number | null;
  
  // Competitive Context
  competitors: string[];
  competitorStrengths: string | null;
  competitorWeaknesses: string | null;
  emergingTrends: string | null;
  
  // Content Guidelines
  keywords: string[];
  keywordsToAvoid: string[];
  copyExamplesGood: string[];
  copyExamplesBad: string[];
  extraGuidelines: string | null;
  
  // Scraper
  sourceUrl: string | null;
  scrapeConfidence: ScrapeConfidence | null;
  lastScrapedAt: Date | null;
  
  // System
  status: BrandStatus;
  createdAt: Date;
  updatedAt: Date;
};
```

### Brand Attributes Reference

#### Core Identity

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Brand name |
| `mission` | text | No | Brand mission statement (the "why") |
| `tagline` | string | No | Brand tagline/slogan |
| `tagline_tones` | string[] | No | Tones of the tagline |
| `values` | string[] | No | Core brand values |
| `unique_selling_points` | string[] | No | What makes the brand different |
| `differentiator` | text | No | Key competitive advantage |

#### Voice & Communication

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `voice` | string | No | Brief voice description |
| `tone` | string | No | Emotional quality |
| `tone_of_voice` | text | No | Detailed tone guidance |
| `use_emojis` | boolean | No | Whether to use emojis in copy (default: false) |
| `website_language` | string | No | Primary language code (default: "EN") |

#### Target Audience

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `ideal_customer` | text | No | Target customer description |
| `motivators` | string[] | No | What motivates the audience |
| `pain_points` | string[] | No | Customer pain points |
| `niches` | string[] | No | Industry categories |
| `what_you_sell` | string | No | "Physical Products", "SaaS", or "Services" |
| `products` | BrandProduct[] | No | Scraped products (Physical Products only) |
| `features` | BrandFeature[] | No | Product features (SaaS only) |
| `services` | BrandService[] | No | Service offerings (Services only) |

#### Visual Identity

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `primary_colors` | BrandColor[] | No | Primary/dominant colors |
| `secondary_colors` | BrandColor[] | No | Secondary/accent colors |
| `colors_usage` | text | No | Guidelines for color application |
| `fonts` | BrandFont[] | No | Typography definitions |

#### Logo

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `logo_url` | string | No | Primary logo URL |
| `logo_urls` | string[] | No | All logo URLs (from scraping) |
| `logo_dominant_colors` | string[] | No | Colors extracted from logo |
| `logo_file_id` | FK | No | Reference to uploaded logo |

#### Competitive Context

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `competitors` | string[] | No | Competitor brand names |
| `competitor_strengths` | text | No | What competitors do well |
| `competitor_weaknesses` | text | No | Where competitors fall short |
| `emerging_trends` | text | No | Industry trends to leverage |

#### Content Guidelines

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `keywords` | string[] | No | Keywords to include in content |
| `keywords_to_avoid` | string[] | No | Keywords to never use |
| `copy_examples_good` | string[] | No | Examples of good copy |
| `copy_examples_bad` | string[] | No | Examples of bad copy |
| `extra_guidelines` | text | No | Additional brand rules |

---

## Brand Memory Scraper

### Overview

The Brand Memory Scraper is an AI-powered service that extracts brand identity from a website. It uses **Oxylabs Web Scraper API** for reliable content collection (supporting JS-heavy sites via Headless Browser rendering), Google Gemini-2.5-Flash (via Vercel AI SDK) for structured data extraction, and Cheerio for HTML parsing.

### Extraction Capabilities

**What CAN be extracted from a website:**

| Field | Source | Confidence |
|-------|--------|------------|
| `name` | Title tags, logo alt, footer, OG tags | High |
| `mission` | About/Mission pages, meta description | Medium |
| `tagline` | Hero sections, meta description | Medium |
| `logo_url` / `logo_urls` | Header images, favicon | High |
| `logo_dominant_colors` | Image color analysis | High |
| `primary_colors` / `secondary_colors` | CSS variables, theme colors | High |
| `fonts` | CSS font-family, Google Fonts links | High |
| `values` | About/Values pages | Low-Medium |
| `unique_selling_points` | Hero, "Why Choose Us" sections | Medium |
| `keywords` | Content patterns, meta keywords | Medium |
| `website_language` | HTML lang attribute | High |
| `niches` | Product categories, industry mentions | Medium |
| `what_you_sell` | Product vs service detection | Medium |
| `products` | Product catalog (Physical Products only) | High |
| `features` | Product features (SaaS only) | High |
| `services` | Service offerings (Services only) | High |

**What CANNOT be extracted (requires manual entry):**

| Field | Reason |
|-------|--------|
| `voice`, `tone`, `tone_of_voice` | Subjective interpretation |
| `ideal_customer` | Internal strategy, not public |
| `motivators`, `pain_points` | Customer psychology, not on site |
| `competitors` | Brands don't list competitors |
| `competitor_strengths/weaknesses` | Never on own site |
| `emerging_trends` | External market analysis |
| `differentiator` | May be implicit, hard to extract |
| `keywords_to_avoid` | Internal guidelines |
| `copy_examples_good/bad` | Internal guidelines |
| `colors_usage` | Internal brand rules |
| `extra_guidelines` | Internal brand rules |
| `use_emojis` | Could infer but risky |

### UX Flow for URL Import

1. User enters URL and clicks "Scan"
2. Scraper extracts available fields
3. UI shows extracted data with confidence scores
4. User reviews/edits extracted fields
5. UI prompts user to complete remaining fields (marked as "Needs your input")
6. User fills in manual fields
7. User saves complete brand

### Architecture

The scraper operates in two phases:

**Phase 1: Brand Discovery** — Extract core brand identity
**Phase 2: Deep Scraping** — Visit individual product/feature/service pages for images

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Workflow                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: BRAND DISCOVERY                                           │
│  ┌──────────┐      ┌────────────┐      ┌──────────────┐            │
│  │  START   │──────│  Crawler   │──────│  Extractor   │            │
│  └──────────┘      └────────────┘      └──────┬───────┘            │
│                                                │                     │
│                          ┌─────────────────────┘                    │
│                          ▼                                          │
│                   ┌─────────────┐                                   │
│                   │ Should      │──── No URL ────┐                  │
│                   │ Crawl More? │                │                  │
│                   └──────┬──────┘                │                  │
│                          │ Yes                   │                  │
│                          ▼                       │                  │
│                   ┌─────────────┐                │                  │
│                   │  Crawler    │ (loop)         │                  │
│                   └─────────────┘                │                  │
│                                                  ▼                  │
│  PHASE 2: DEEP SCRAPING (parallel)      ┌───────────────┐          │
│                                          │ Collect Items │          │
│  ┌─────────────────────────────────────┐ │ (products,    │          │
│  │                                     │ │ features, or  │          │
│  │  For each item URL (parallel):      │ │ services)     │          │
│  │  ┌──────────┐    ┌──────────────┐  │ └───────┬───────┘          │
│  │  │  Fetch   │────│  Extract     │  │         │                  │
│  │  │  Page    │    │  Images      │  │         │                  │
│  │  └──────────┘    └──────────────┘  │         │                  │
│  │                                     │◄────────┘                  │
│  └─────────────────────────────────────┘                           │
│                          │                                          │
│                          ▼                                          │
│                   ┌─────────────┐                                   │
│                   │    END      │                                   │
│                   └─────────────┘                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Zod Schemas (`lib/brands/schemas.ts`)

```typescript
import { z } from 'zod';

// --- Enums ---
export const WhatYouSellEnum = z.enum(['Physical Products', 'SaaS', 'Services']);

// --- Base Type with Confidence ---
export const BrandMemoryBase = z.object({
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
  evidence: z.string().describe('The evidence for the conclusion'),
});

// --- Brand Components ---
export const BrandMemoryName = BrandMemoryBase.extend({
  value: z.string().describe('The Brand name'),
});

export const BrandMemoryMission = BrandMemoryBase.extend({
  value: z.string().describe('The Brand mission statement'),
});

export const BrandMemoryLogo = BrandMemoryBase.extend({
  url: z.string().nullable().describe('Primary logo URL'),
  urls: z.array(z.string()).describe('All logo URLs found'),
  dominantColors: z.array(z.string()).describe('Dominant colors in hex format'),
});

export const BrandMemoryTagline = BrandMemoryBase.extend({
  value: z.string().describe('The Brand tagline'),
  tones: z.array(z.string()).describe('The tones of the brand tagline'),
});

export const BrandMemoryColor = z.object({
  value: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).describe('Color in hex format'),
  label: z.string().describe('Name/label of the color'),
});

export const BrandMemoryColors = BrandMemoryBase.extend({
  primary: z.array(BrandMemoryColor).describe('Primary/dominant brand colors'),
  secondary: z.array(BrandMemoryColor).describe('Secondary/accent colors'),
  usage: z.string().nullable().describe('Guidelines for color usage'),
});

export const BrandMemoryFont = z.object({
  family: z.string().describe('The font family name'),
  usage: z.enum(['heading', 'paragraph']).describe('What this font is used for'),
  size: z.string().regex(/^\d+(px|em|rem|%)$/).describe('Font size with unit'),
  weight: z.string().describe('Font weight (e.g., 400, bold)'),
  color: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).describe('Font color in hex'),
  fileUrl: z.string().nullable().describe('URL to font file if custom'),
});

export const BrandMemoryFonts = BrandMemoryBase.extend({
  values: z.array(BrandMemoryFont).describe('Brand typography definitions'),
});

export const BrandMemoryValues = BrandMemoryBase.extend({
  values: z.array(z.string()).describe('Core brand values'),
  uniqueSellingPoints: z.array(z.string()).describe('Unique selling points'),
  differentiator: z.string().nullable().describe('Key competitive advantage'),
});

export const ScrapedImageType = z.enum(['hero', 'gallery', 'thumbnail', 'icon', 'other']);

export const ScrapedImage = z.object({
  url: z.string().describe('Full image URL'),
  alt: z.string().nullable().describe('Image alt text'),
  type: ScrapedImageType.describe('Image type/purpose'),
  width: z.number().nullable().describe('Image width in pixels'),
  height: z.number().nullable().describe('Image height in pixels'),
});

export const BrandMemoryProduct = z.object({
  name: z.string().describe('Product name'),
  description: z.string().nullable().describe('Product description'),
  price: z.string().nullable().describe('Product price with currency symbol'),
  currency: z.string().nullable().describe('Currency code (USD, SGD, etc.)'),
  category: z.string().nullable().describe('Product category'),
  url: z.string().describe('Product page URL'),
  images: z.array(ScrapedImage).describe('All images from the product page'),
});

export const BrandMemoryFeature = z.object({
  name: z.string().describe('Feature name'),
  description: z.string().nullable().describe('Feature description'),
  category: z.string().nullable().describe('Feature category (Analytics, Security, etc.)'),
  url: z.string().nullable().describe('Feature detail page URL if exists'),
  images: z.array(ScrapedImage).describe('Screenshots, icons, illustrations for the feature'),
});

export const BrandMemoryService = z.object({
  name: z.string().describe('Service name'),
  description: z.string().nullable().describe('Service description'),
  category: z.string().nullable().describe('Service category (Consulting, Design, etc.)'),
  priceRange: z.string().nullable().describe('Price range or pricing model'),
  url: z.string().nullable().describe('Service page URL'),
  images: z.array(ScrapedImage).describe('Portfolio, case study, or service images'),
});

export const BrandMemoryAudience = BrandMemoryBase.extend({
  idealCustomer: z.string().nullable().describe('Target customer description'),
  motivators: z.array(z.string()).describe('Audience motivators'),
  painPoints: z.array(z.string()).describe('Customer pain points'),
  niches: z.array(z.string()).describe('Industry categories'),
  whatYouSell: WhatYouSellEnum.describe('Physical Products, SaaS, or Services'),
  // Business-type specific (only one populated based on whatYouSell)
  products: z.array(BrandMemoryProduct).describe('Scraped products (Physical Products only)'),
  features: z.array(BrandMemoryFeature).describe('Product features (SaaS only)'),
  services: z.array(BrandMemoryService).describe('Service offerings (Services only)'),
});

export const BrandMemoryCompetitive = BrandMemoryBase.extend({
  competitors: z.array(z.string()).describe('Competitor brand names'),
  competitorStrengths: z.string().nullable(),
  competitorWeaknesses: z.string().nullable(),
  emergingTrends: z.string().nullable(),
});

export const BrandMemoryContent = BrandMemoryBase.extend({
  keywords: z.array(z.string()).describe('Keywords to include'),
  keywordsToAvoid: z.array(z.string()).describe('Keywords to avoid'),
  websiteLanguage: z.string().describe('Primary language code'),
});

// --- Main Brand Memory Data ---
export const BrandMemoryCoreData = z.object({
  name: BrandMemoryName,
  mission: BrandMemoryMission,
  logo: BrandMemoryLogo,
  tagline: BrandMemoryTagline,
  colors: BrandMemoryColors,
  fonts: BrandMemoryFonts,
  values: BrandMemoryValues,
  audience: BrandMemoryAudience,
  competitive: BrandMemoryCompetitive,
  content: BrandMemoryContent,
});

// --- Scraper State ---
export const ScraperStateSchema = z.object({
  urlToCrawl: z.string().nullable(),
  visitedUrls: z.array(z.string()),
  htmlContent: z.string().nullable(),
  brandMemory: BrandMemoryCoreData.nullable(),
  currentDepth: z.number(),
  maxDepth: z.number(),
});

export type TScraperState = z.infer<typeof ScraperStateSchema>;

// --- LLM Extractor Output ---
export const ExtractorOutputSchema = z.object({
  brandMemory: BrandMemoryCoreData,
  urlToCrawl: z.string().nullable().describe('The next URL to crawl, or null if done'),
});
```


### HTML Cleaning Utility (`lib/brands/scraping.ts`)

```typescript
import * as cheerio from 'cheerio';

/**
 * Aggressively clean HTML to reduce token count while preserving
 * brand-relevant information.
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // 1. Remove noise elements
  $('script, iframe, embed, object, noscript, canvas, video, audio').remove();

  // 2. Keep only font-related stylesheets
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr('href') || '';
    const isFont = href.includes('fonts') || href.endsWith('.woff2');
    if (!isFont) $(el).remove();
  });

  // 3. Remove base64 data URIs (huge tokens)
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) $(el).remove();
  });

  // 4. Strip non-essential attributes
  const preservedAttrs = new Set(['class', 'id', 'src', 'href', 'alt', 'title', 'style']);
  $('*').each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const attr of Object.keys(attribs)) {
      if (!preservedAttrs.has(attr)) $(el).removeAttr(attr);
    }
  });

  // 5. Minify whitespace
  return $.html()
    .replace(/[\n\r\t]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Fetch page content via Oxylabs Realtime Scraper API.
 * Uses 'universal' source for generic websites and enables JS rendering.
 * @see https://developers.oxylabs.io/scraping-solutions/web-scraper-api
 */
export async function getPageContent(url: string): Promise<string> {
  const response = await fetch(`${process.env.SCRAPER_PROXY_ENDPOINT}/v1/queries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SCRAPER_PROXY_USERNAME}:${process.env.SCRAPER_PROXY_PASSWORD}`
      ).toString('base64')}`,
    },
    body: JSON.stringify({ 
      source: 'universal', 
      url,
      render: 'html', // Enable JS rendering for modern SPAs
    }),
  });

  if (!response.ok) {
    throw new Error(`Oxylabs API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.results?.[0];

  if (!result) {
    throw new Error('Oxylabs returned no results');
  }

  // Oxylabs returns target site errors in status_code
  if (result.status_code && result.status_code >= 400) {
    throw new Error(`Target site error (${result.status_code}) for ${url}`);
  }

  return cleanHtml(result.content);
}
```

### Extractor Prompt (`lib/brands/prompts.ts`)

```typescript
export const brandExtractorPrompt = `
You are a web scraper that specializes in extracting BRAND MEMORY from a URL's HTML content.

CURRENT URL: {urlToCrawl}

## Rules
1. Parse the HTML carefully. If all brand information is found, return the data and set urlToCrawl to null.
2. If information is missing, pick a NEW internal URL to crawl from the content (not in {visitedUrls}).
3. If max depth is reached, set urlToCrawl to null and return best-effort data.
4. Look for About, Mission, Values, and Team pages for richer brand information.

## Scraping Instructions

**Brand Name:**
- Look for logo alt text, title tags, footer copyright, Open Graph meta tags
- Choose the most authoritative source

**Mission:**
- Look for "About Us", "Our Mission", "Our Story" sections
- Extract the core purpose/mission statement
- This is the brand's "why"

**Logo:**
- Find logo images (usually in header, often has "logo" in class/id/src)
- Validate URLs are complete and accessible
- Extract dominant colors from logo if visible

**Tagline:**
- Look for hero section, meta description, about page headers
- Distinguish brand tagline from promotional slogans (sales, discounts)
- Identify the tones (aspirational, playful, professional, etc.)

**Colors:**
- Primary: Dominant colors used in headers, CTAs, brand elements
- Secondary: Accent colors, backgrounds, supporting elements
- Extract from CSS custom properties, inline styles
- Note any color usage guidelines if mentioned

**Fonts:**
- Look for font-family declarations in CSS
- Check Google Fonts or custom font links
- Record font family name as a string
- Determine usage: heading (h1-h6, hero headers) vs paragraph (body, p, main content)

**Values & USPs:**
- Look for "Our Values", "Why Choose Us", "What Makes Us Different"
- Extract core values as a list
- Identify unique selling points
- Find the key differentiator

**Target Audience:**
- Look for customer testimonials, "Who We Serve", target market mentions
- Identify ideal customer profile
- Extract motivators and pain points addressed

**Competitors:**
- Look for comparison pages, "vs" content, industry mentions
- Identify named competitors
- Note any competitive positioning

**Keywords:**
- Extract recurring brand-specific terms
- Note any content guidelines or style guides
- Identify language/locale

**Business-Type Specific Scraping:**

First determine if brand sells Physical Products, SaaS, or Services.

**Phase 1: Identify Items**

*Physical Products:*
- Crawl product listing/shop pages
- Extract: product name, description, price, category, product URL
- Limit to 10-20 sample products

*SaaS:*
- Look for Features, Pricing, Product pages
- Extract: feature name, description, category, feature URL (if dedicated page exists)
- Limit to 15-25 key features

*Services:*
- Look for Services, What We Do, Our Work pages
- Extract: service name, description, category, price range, service URL
- Limit to 10-15 service offerings

**Phase 2: Deep Image Extraction**

For each item collected, visit its individual page and extract ALL relevant images:

*Physical Products:*
- Visit each product URL
- Extract: hero image, gallery images, variant images, lifestyle shots
- Skip: icons, logos, navigation elements, ads
- Classify each image: hero | gallery | thumbnail | other

*SaaS Features:*
- Visit feature page (if exists) or extract from feature section
- Extract: screenshots, UI mockups, icons, illustrations, diagrams
- Classify each image: hero | gallery | icon | other

*Services:*
- Visit service/portfolio page
- Extract: portfolio images, case study images, team photos, process diagrams
- Classify each image: hero | gallery | other

**Image Extraction Rules:**
- Skip images < 100x100 pixels (likely icons/decorations)
- Skip base64 data URIs
- Skip common patterns: social icons, payment badges, trust seals
- Prefer high-resolution versions when available
- Extract alt text for context
- Deduplicate by URL
- Max 10 images per item

## Confidence Scoring
- 0.8-1.0: Multiple sources confirm, clear match
- 0.5-0.79: Present but not repeated/confirmed
- 0.1-0.49: Weak signals, inferred

## Input Data

**HTML CONTENT:**
{htmlContent}

**VISITED URLS:**
{visitedUrls}

**CURRENT DEPTH:** {currentDepth}
**MAX DEPTH:** {maxDepth}

**PREVIOUS BRAND MEMORY (merge with new findings):**
{brandMemory}
`;
```

### Brand Scraper Service (`lib/brands/scraper-service.ts`)

```typescript
import { generateObject } from 'ai';
import { 
  ScraperStateSchema, 
  ExtractorOutputSchema, 
  type TScraperState 
} from './schemas';
import { brandExtractorPrompt } from './prompts';
import { getPageContent } from './scraping';
import { deepScrapeImages } from './image-extractor';

const model = `google/gemini-2.5-flash`;

/**
 * Main entry point for brand scraping
 * Simple iterative loop using Vercel AI SDK
 */
export async function scrapeBrandFromUrl(url: string, maxDepth = 3) {
  let state: TScraperState = {
    urlToCrawl: url,
    visitedUrls: [],
    htmlContent: null,
    brandMemory: null,
    currentDepth: 0,
    maxDepth,
  };

  while (state.urlToCrawl && state.currentDepth < state.maxDepth) {
    // 1. Crawl
    state = await crawler(state);
    
    // 2. Extract
    if (state.htmlContent) {
      state = await extractor(state);
    } else {
      break;
    }
  }

  // Phase 2: Deep image extraction
  const brandWithImages = await deepScrapeImages(state.brandMemory);

  return brandWithImages;
}

/**
 * Crawler: fetches and cleans HTML from URL
 */
async function crawler(state: TScraperState): Promise<TScraperState> {
  if (!state.urlToCrawl) return state;

  try {
    const html = await getPageContent(state.urlToCrawl);
    
    // Truncate if too large (token limit protection)
    const maxChars = 100000;
    const truncatedHtml = html.length > maxChars 
      ? html.slice(0, maxChars) + '<!-- truncated -->' 
      : html;

    return {
      ...state,
      htmlContent: truncatedHtml,
      currentDepth: state.currentDepth + 1,
      visitedUrls: [...state.visitedUrls, state.urlToCrawl],
    };
  } catch (error) {
    console.error(`Failed to crawl ${state.urlToCrawl}:`, error);
    return {
      ...state,
      htmlContent: null,
      urlToCrawl: null,
    };
  }
}

/**
 * Extractor: uses AI SDK to extract brand data from HTML
 */
async function extractor(state: TScraperState): Promise<TScraperState> {
  if (!state.htmlContent) return state;

  const { object } = await generateObject({
    model,
    schema: ExtractorOutputSchema,
    system: brandExtractorPrompt,
    prompt: `
      CURRENT URL: ${state.urlToCrawl}
      VISITED URLS: ${JSON.stringify(state.visitedUrls)}
      HTML CONTENT: ${state.htmlContent}
      CURRENT DEPTH: ${state.currentDepth}
      MAX DEPTH: ${state.maxDepth}
      PREVIOUS BRAND MEMORY: ${JSON.stringify(state.brandMemory)}
    `,
  });

  return {
    ...state,
    brandMemory: object.brandMemory,
    urlToCrawl: object.urlToCrawl,
  };
}
```

### Deep Image Extraction (`lib/brands/image-extractor.ts`)

```typescript
import * as cheerio from 'cheerio';
import { getPageContent } from './scraping';
import type { ScrapedImage, BrandProduct, BrandFeature, BrandService } from './schemas';

/**
 * Extract all relevant images from a page
 */
async function extractImagesFromPage(url: string): Promise<ScrapedImage[]> {
  const html = await getPageContent(url);
  const $ = cheerio.load(html);
  const images: ScrapedImage[] = [];
  const seenUrls = new Set<string>();

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!src || src.startsWith('data:')) return;
    
    // Resolve relative URLs
    const imageUrl = new URL(src, url).href;
    if (seenUrls.has(imageUrl)) return;
    seenUrls.add(imageUrl);

    // Skip small images (likely icons/decorations)
    const width = parseInt($(el).attr('width') || '0');
    const height = parseInt($(el).attr('height') || '0');
    if (width > 0 && width < 100) return;
    if (height > 0 && height < 100) return;

    // Skip common non-content patterns
    const skipPatterns = [
      /payment|visa|mastercard|paypal|amex/i,
      /social|facebook|twitter|instagram|linkedin/i,
      /trust|badge|seal|verified/i,
      /spinner|loader|loading/i,
      /placeholder/i,
    ];
    if (skipPatterns.some(p => p.test(imageUrl) || p.test($(el).attr('alt') || ''))) {
      return;
    }

    // Determine image type
    const type = determineImageType($, el);

    images.push({
      url: imageUrl,
      alt: $(el).attr('alt') || null,
      type,
      width: width || null,
      height: height || null,
    });
  });

  // Limit to 10 images per page
  return images.slice(0, 10);
}

/**
 * Determine the type of image based on context
 */
function determineImageType($: cheerio.CheerioAPI, el: cheerio.Element): ScrapedImage['type'] {
  const parent = $(el).parent();
  const grandparent = parent.parent();
  
  // Check for hero patterns
  if (
    $(el).hasClass('hero') ||
    parent.hasClass('hero') ||
    grandparent.hasClass('hero') ||
    $(el).closest('[class*="hero"]').length > 0 ||
    $(el).closest('[class*="banner"]').length > 0
  ) {
    return 'hero';
  }

  // Check for gallery patterns
  if (
    $(el).closest('[class*="gallery"]').length > 0 ||
    $(el).closest('[class*="carousel"]').length > 0 ||
    $(el).closest('[class*="slider"]').length > 0 ||
    $(el).closest('[class*="swiper"]').length > 0
  ) {
    return 'gallery';
  }

  // Check for thumbnail patterns
  if (
    $(el).hasClass('thumbnail') ||
    $(el).closest('[class*="thumb"]').length > 0 ||
    ($(el).attr('width') && parseInt($(el).attr('width')!) < 200)
  ) {
    return 'thumbnail';
  }

  // Check for icon patterns
  if (
    $(el).hasClass('icon') ||
    $(el).closest('[class*="icon"]').length > 0 ||
    $(el).closest('svg').length > 0 ||
    ($(el).attr('width') && parseInt($(el).attr('width')!) < 64)
  ) {
    return 'icon';
  }

  return 'other';
}

/**
 * Deep scrape images for all products/features/services
 */
export async function deepScrapeImages(brandMemory: any) {
  const whatYouSell = brandMemory.audience.whatYouSell;

  if (whatYouSell === 'Physical Products' && brandMemory.audience.products) {
    // Scrape images for each product in parallel
    const productsWithImages = await Promise.all(
      brandMemory.audience.products.map(async (product: BrandProduct) => {
        if (!product.url) return product;
        const images = await extractImagesFromPage(product.url);
        return { ...product, images };
      })
    );
    brandMemory.audience.products = productsWithImages;
  }

  if (whatYouSell === 'SaaS' && brandMemory.audience.features) {
    // Scrape images for features with dedicated pages
    const featuresWithImages = await Promise.all(
      brandMemory.audience.features.map(async (feature: BrandFeature) => {
        if (!feature.url) return { ...feature, images: [] };
        const images = await extractImagesFromPage(feature.url);
        return { ...feature, images };
      })
    );
    brandMemory.audience.features = featuresWithImages;
  }

  if (whatYouSell === 'Services' && brandMemory.audience.services) {
    // Scrape images for each service
    const servicesWithImages = await Promise.all(
      brandMemory.audience.services.map(async (service: BrandService) => {
        if (!service.url) return { ...service, images: [] };
        const images = await extractImagesFromPage(service.url);
        return { ...service, images };
      })
    );
    brandMemory.audience.services = servicesWithImages;
  }

  return brandMemory;
}
```

### Converting Scraped Data to Brand (`lib/brands/converter.ts`)

```typescript
import { z } from 'zod';
import { BrandMemoryCoreData } from './schemas';
import type { NewBrand } from '@/lib/db/schema';

type ScrapedBrandMemory = z.infer<typeof BrandMemoryCoreData>;

/**
 * Convert scraped brand memory to database brand format
 */
export function scrapedMemoryToBrand(
  teamId: number,
  sourceUrl: string,
  memory: ScrapedBrandMemory
): NewBrand {
  return {
    teamId,
    sourceUrl,
    lastScrapedAt: new Date(),

    // Core Identity
    name: memory.name.value,
    mission: memory.mission.value || null,
    tagline: memory.tagline.value || null,
    taglineTones: memory.tagline.tones,
    values: memory.values.values,
    uniqueSellingPoints: memory.values.uniqueSellingPoints,
    differentiator: memory.values.differentiator,

    // Colors
    primaryColors: memory.colors.primary,
    secondaryColors: memory.colors.secondary,
    colorsUsage: memory.colors.usage,

    // Fonts
    fonts: memory.fonts.values,

    // Logo
    logoUrl: memory.logo.url,
    logoUrls: memory.logo.urls,
    logoDominantColors: memory.logo.dominantColors,

    // Target Audience
    idealCustomer: memory.audience.idealCustomer,
    motivators: memory.audience.motivators,
    painPoints: memory.audience.painPoints,
    niches: memory.audience.niches,
    whatYouSell: memory.audience.whatYouSell,
    
    // Business-type specific (only one populated)
    products: memory.audience.whatYouSell === 'Physical Products' 
      ? memory.audience.products 
      : [],
    features: memory.audience.whatYouSell === 'SaaS' 
      ? memory.audience.features 
      : [],
    services: memory.audience.whatYouSell === 'Services' 
      ? memory.audience.services 
      : [],

    // Competitive Context
    competitors: memory.competitive.competitors,
    competitorStrengths: memory.competitive.competitorStrengths,
    competitorWeaknesses: memory.competitive.competitorWeaknesses,
    emergingTrends: memory.competitive.emergingTrends,

    // Content
    keywords: memory.content.keywords,
    keywordsToAvoid: memory.content.keywordsToAvoid,
    websiteLanguage: memory.content.websiteLanguage,

    // Confidence scores
    scrapeConfidence: {
      name: { confidence: memory.name.confidence, evidence: memory.name.evidence },
      mission: { confidence: memory.mission.confidence, evidence: memory.mission.evidence },
      logo: { confidence: memory.logo.confidence, evidence: memory.logo.evidence },
      tagline: { confidence: memory.tagline.confidence, evidence: memory.tagline.evidence },
      colors: { confidence: memory.colors.confidence, evidence: memory.colors.evidence },
      fonts: { confidence: memory.fonts.confidence, evidence: memory.fonts.evidence },
      values: { confidence: memory.values.confidence, evidence: memory.values.evidence },
    },
  };
}
```

---

## API Routes

### `GET /api/brands`

List all brands for the current team.

**Response:**
```json
{
  "brands": [
    {
      "id": 1,
      "name": "Acme Co",
      "mission": "Making performance beautiful...",
      "tagline": "Style that lasts",
      "values": ["Sustainability", "Quality"],
      "uniqueSellingPoints": ["Make Performance Beautiful"],
      "competitors": ["Nike", "Adidas"],
      "niches": ["Fashion & Apparel"],
      "logoUrl": "/api/files/123",
      "moodboardCount": 3,
      "status": "active"
    }
  ]
}
```

### `POST /api/brands`

Create a new brand (manual).

**Request:**
```json
{
  "name": "Acme Co",
  "mission": "Making performance beautiful for athletes worldwide",
  "tagline": "Style that lasts",
  "values": ["Sustainability", "Quality", "Innovation"],
  "uniqueSellingPoints": ["Make Performance Beautiful"],
  "differentiator": "Only brand using 100% recycled materials",
  "voice": "Friendly, approachable",
  "tone": "Warm, optimistic",
  "toneOfVoice": "Encouraging and inclusive, never preachy...",
  "useEmojis": false,
  "websiteLanguage": "EN",
  "idealCustomer": "Health-conscious urban professionals aged 28-45...",
  "motivators": ["Status", "Sustainability"],
  "painPoints": ["Fast fashion guilt", "Finding quality basics"],
  "niches": ["Fashion & Apparel", "Sustainable"],
  "whatYouSell": "Products",
  "primaryColors": [{ "value": "#1A5F7A", "label": "Ocean Blue" }],
  "secondaryColors": [{ "value": "#F4D03F", "label": "Sunset Gold" }],
  "colorsUsage": "Primary for CTAs, secondary for accents",
  "competitors": ["Nike", "Adidas", "Puma"],
  "competitorStrengths": "Strong athlete endorsements",
  "competitorWeaknesses": "Lack of sustainability focus",
  "emergingTrends": "Rise of athleisure wear",
  "keywords": ["sustainable", "performance", "quality"],
  "keywordsToAvoid": ["cheap", "discount", "budget"],
  "copyExamplesGood": ["Crafted to last, designed to inspire"],
  "copyExamplesBad": ["Buy now! Limited time only!"],
  "extraGuidelines": "Always lead with sustainability message",
  "logoFileId": 123
}
```

### `POST /api/brands/scrape`

Create a brand by scraping a URL.

**Request:**
```json
{
  "url": "https://acme.com",
  "maxDepth": 3
}
```

**Response:**
```json
{
  "brand": {
    "id": 1,
    "name": "Acme Co",
    "mission": "Making performance beautiful...",
    "sourceUrl": "https://acme.com",
    "scrapeConfidence": {
      "name": { "confidence": 0.95, "evidence": "Found in title tag and footer" },
      "mission": { "confidence": 0.85, "evidence": "Extracted from About page" },
      "colors": { "confidence": 0.8, "evidence": "Extracted from CSS variables" }
    }
  }
}
```

### `POST /api/brands/[brandId]/rescrape`

Re-scrape brand from source URL.

### `GET /api/brands/[brandId]`

Get a single brand by ID.

### `PATCH /api/brands/[brandId]`

Update a brand. All fields optional.

### `DELETE /api/brands/[brandId]`

Soft delete a brand. Sets `deleted_at` timestamp.

### `GET /api/brands/[brandId]/moodboards`

List all moodboards for a brand.

---

## Database Helpers

**File: `lib/db/brands.ts`**

```typescript
import { db } from './drizzle';
import { brands } from './schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function listBrands(teamId: number) {
  return db
    .select()
    .from(brands)
    .where(and(
      eq(brands.teamId, teamId),
      isNull(brands.deletedAt),
      eq(brands.status, 'active')
    ))
    .orderBy(brands.name);
}

export async function getBrandById(teamId: number, id: number) {
  const result = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, id), eq(brands.teamId, teamId), isNull(brands.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function createBrand(
  teamId: number,
  input: {
    // Core Identity
    name: string;
    mission?: string | null;
    tagline?: string | null;
    taglineTones?: string[];
    values?: string[];
    uniqueSellingPoints?: string[];
    differentiator?: string | null;
    
    // Voice & Communication
    voice?: string | null;
    tone?: string | null;
    toneOfVoice?: string | null;
    useEmojis?: boolean;
    websiteLanguage?: string;
    
    // Target Audience
    idealCustomer?: string | null;
    motivators?: string[];
    painPoints?: string[];
    niches?: string[];
    whatYouSell?: string;
    // Business-type specific (with images)
    products?: {
      name: string;
      description: string | null;
      price: string | null;
      currency: string | null;
      category: string | null;
      url: string;
      images: {
        url: string;
        alt: string | null;
        type: 'hero' | 'gallery' | 'thumbnail' | 'icon' | 'other';
        width: number | null;
        height: number | null;
      }[];
    }[];
    features?: {
      name: string;
      description: string | null;
      category: string | null;
      url: string | null;
      images: {
        url: string;
        alt: string | null;
        type: 'hero' | 'gallery' | 'thumbnail' | 'icon' | 'other';
        width: number | null;
        height: number | null;
      }[];
    }[];
    services?: {
      name: string;
      description: string | null;
      category: string | null;
      priceRange: string | null;
      url: string | null;
      images: {
        url: string;
        alt: string | null;
        type: 'hero' | 'gallery' | 'thumbnail' | 'icon' | 'other';
        width: number | null;
        height: number | null;
      }[];
    }[];
    
    // Visual Identity
    primaryColors?: { value: string; label: string }[];
    secondaryColors?: { value: string; label: string }[];
    colorsUsage?: string | null;
    fonts?: object[];
    
    // Logo
    logoUrl?: string | null;
    logoUrls?: string[];
    logoDominantColors?: string[];
    logoFileId?: number | null;
    
    // Competitive Context
    competitors?: string[];
    competitorStrengths?: string | null;
    competitorWeaknesses?: string | null;
    emergingTrends?: string | null;
    
    // Content Guidelines
    keywords?: string[];
    keywordsToAvoid?: string[];
    copyExamplesGood?: string[];
    copyExamplesBad?: string[];
    extraGuidelines?: string | null;
    
    // Scraper
    sourceUrl?: string | null;
    scrapeConfidence?: object | null;
    lastScrapedAt?: Date | null;
  }
) {
  const result = await db
    .insert(brands)
    .values({
      teamId,
      // Core Identity
      name: input.name,
      mission: input.mission,
      tagline: input.tagline,
      taglineTones: input.taglineTones ?? [],
      values: input.values ?? [],
      uniqueSellingPoints: input.uniqueSellingPoints ?? [],
      differentiator: input.differentiator,
      
      // Voice & Communication
      voice: input.voice,
      tone: input.tone,
      toneOfVoice: input.toneOfVoice,
      useEmojis: input.useEmojis ?? false,
      websiteLanguage: input.websiteLanguage ?? 'EN',
      
      // Target Audience
      idealCustomer: input.idealCustomer,
      motivators: input.motivators ?? [],
      painPoints: input.painPoints ?? [],
      niches: input.niches ?? [],
      whatYouSell: input.whatYouSell ?? 'Physical Products',
      products: input.products ?? [],
      features: input.features ?? [],
      services: input.services ?? [],
      
      // Visual Identity
      primaryColors: input.primaryColors ?? [],
      secondaryColors: input.secondaryColors ?? [],
      colorsUsage: input.colorsUsage,
      fonts: input.fonts ?? [],
      
      // Logo
      logoUrl: input.logoUrl,
      logoUrls: input.logoUrls ?? [],
      logoDominantColors: input.logoDominantColors ?? [],
      logoFileId: input.logoFileId,
      
      // Competitive Context
      competitors: input.competitors ?? [],
      competitorStrengths: input.competitorStrengths,
      competitorWeaknesses: input.competitorWeaknesses,
      emergingTrends: input.emergingTrends,
      
      // Content Guidelines
      keywords: input.keywords ?? [],
      keywordsToAvoid: input.keywordsToAvoid ?? [],
      copyExamplesGood: input.copyExamplesGood ?? [],
      copyExamplesBad: input.copyExamplesBad ?? [],
      extraGuidelines: input.extraGuidelines,
      
      // Scraper
      sourceUrl: input.sourceUrl,
      scrapeConfidence: input.scrapeConfidence,
      lastScrapedAt: input.lastScrapedAt,
    })
    .returning();
  return result[0];
}

export async function updateBrand(
  teamId: number,
  id: number,
  input: Partial<Parameters<typeof createBrand>[1]>
) {
  const result = await db
    .update(brands)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(brands.id, id), eq(brands.teamId, teamId)))
    .returning();
  return result[0];
}

export async function deleteBrand(teamId: number, id: number) {
  await db
    .update(brands)
    .set({ deletedAt: new Date() })
    .where(and(eq(brands.id, id), eq(brands.teamId, teamId)));
}

export async function archiveBrand(teamId: number, id: number) {
  await db
    .update(brands)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(brands.id, id), eq(brands.teamId, teamId)));
}
```

---

## Dashboard Pages

### Brands List (`/dashboard/brands`)

- Display all brands as cards
- Each card shows: name, logo thumbnail, tagline, completion %, moodboard count
- "New Brand" button
- Filter by status (active/archived)
- Click card → navigate to brand detail

### Create Brand — Onboarding (`/dashboard/brands/new`)

**PLG Approach: Minimal friction, maximum value**

The onboarding flow is optimized for speed:

```
┌─────────────────────────────────────────────────────────┐
│                    CREATE BRAND                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Enter your website URL                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │ https://                                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  [Import Brand]                                          │
│                                                          │
│  ─────────────── or ───────────────                     │
│                                                          │
│  [Create Manually] (just name required)                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**URL Import Flow (Primary)**
1. User enters URL
2. Show loading state with progress indicators
3. Display extracted brand preview:
   - Name, logo, tagline (editable)
   - Color palette preview
   - "We found X products/features/services"
4. Single CTA: **Create Brand**
5. Redirect to brand detail page

**Manual Flow (Secondary)**
1. User clicks "Create Manually"
2. Simple form: Name (required) + optional logo upload
3. Single CTA: **Create Brand**
4. Redirect to brand detail page

**No other fields during onboarding** — everything else is added from the dashboard.

### Brand Detail (`/dashboard/brands/[brandId]`)

Full brand editing with all fields organized in collapsible sections:

**Header**
- Brand name (editable inline)
- Logo preview
- "Re-scan from URL" button (if sourceUrl exists)
- Completion indicator (e.g., "65% complete")
- Delete/Archive actions

**Sections (collapsible)**

1. **Core Identity**
   - Name, Mission, Tagline, Values, USPs, Differentiator
   - Show scraped values with confidence badges

2. **Voice & Communication** ⭐ (highlight as high-impact)
   - Voice, Tone, Tone of Voice, Use Emojis, Language
   - Empty state: "Add voice guidelines to improve copy quality"

3. **Target Audience** ⭐ (highlight as high-impact)
   - Ideal Customer, Motivators, Pain Points, Niches
   - Empty state: "Define your audience for better targeting"

4. **Products / Features / Services**
   - Based on whatYouSell
   - Grid view with images
   - Add/remove/edit items
   - "Rescan" to refresh from website

5. **Visual Identity**
   - Colors with usage guidelines
   - Fonts
   - Additional logos

6. **Competitive Context**
   - Competitors, Strengths, Weaknesses, Trends

7. **Content Guidelines** ⭐ (highlight as high-impact)
   - Keywords, Keywords to Avoid, Copy Examples, Extra Rules
   - Empty state: "Add keywords to avoid off-brand language"

8. **Moodboards**
   - List of brand's moodboards
   - "New Moodboard" CTA

**Completion Indicator**

Show progress to encourage enhancement:
```
Brand Profile: 65% complete
━━━━━━━━━━━━━━━━━━━━░░░░░░░░

Quick wins to improve generations:
• Add Voice & Tone (+10%)
• Add Ideal Customer (+10%)
• Add Keywords to Avoid (+5%)
```

---

## Prompt Injection

When generating images and copy, brand context is injected:

```typescript
function buildBrandPromptSection(brand: Brand): string {
  let prompt = `
## BRAND CONTEXT

BRAND: ${brand.name}
`;

  if (brand.mission) {
    prompt += `\nMISSION: ${brand.mission}`;
  }

  if (brand.tagline) {
    prompt += `\nTAGLINE: "${brand.tagline}"`;
  }

  if (brand.values && brand.values.length > 0) {
    prompt += `\nVALUES: ${brand.values.join(', ')}`;
  }

  if (brand.uniqueSellingPoints && brand.uniqueSellingPoints.length > 0) {
    prompt += `\nUSPs: ${brand.uniqueSellingPoints.join(', ')}`;
  }

  if (brand.differentiator) {
    prompt += `\nDIFFERENTIATOR: ${brand.differentiator}`;
  }

  if (brand.voice) {
    prompt += `\nVOICE: ${brand.voice}`;
  }

  if (brand.toneOfVoice) {
    prompt += `\nTONE OF VOICE: ${brand.toneOfVoice}`;
  } else if (brand.tone) {
    prompt += `\nTONE: ${brand.tone}`;
  }

  if (brand.idealCustomer) {
    prompt += `\nTARGET CUSTOMER: ${brand.idealCustomer}`;
  }

  // Colors
  const allColors = [...(brand.primaryColors || []), ...(brand.secondaryColors || [])];
  if (allColors.length > 0) {
    const colorList = allColors.map(c => `${c.value} (${c.label})`).join(', ');
    prompt += `

## VISUAL GUIDELINES
**Color Palette**: ${colorList}
- Primary: ${brand.primaryColors?.map(c => c.value).join(', ') || 'N/A'}
- Secondary: ${brand.secondaryColors?.map(c => c.value).join(', ') || 'N/A'}
${brand.colorsUsage ? `- Usage: ${brand.colorsUsage}` : ''}

IMPORTANT: Use these hex colors for the visual palette only.
CRITICAL: Do NOT render hex codes as visible text.
`;
  }

  // Typography
  if (brand.fonts && brand.fonts.length > 0) {
    const headingFonts = brand.fonts.filter(f => f.usage === 'heading').map(f => f.family);
    const paragraphFonts = brand.fonts.filter(f => f.usage === 'paragraph').map(f => f.family);
    
    if (headingFonts.length > 0) {
      prompt += `\n**Heading Fonts**: Use ${headingFonts.join(', ')} or similar.`;
    }
    if (paragraphFonts.length > 0) {
      prompt += `\n**Paragraph Fonts**: Use ${paragraphFonts.join(', ')} or similar.`;
    }
    if (headingFonts.length === 0 && paragraphFonts.length === 0) {
      const fontList = brand.fonts.map(f => f.family).join(', ');
      prompt += `\n**Typography**: Use ${fontList} or similar.`;
    }
  }

  // Content Guidelines
  if (brand.keywords && brand.keywords.length > 0) {
    prompt += `\n\n## CONTENT GUIDELINES`;
    prompt += `\n**Include keywords**: ${brand.keywords.join(', ')}`;
  }

  if (brand.keywordsToAvoid && brand.keywordsToAvoid.length > 0) {
    prompt += `\n**Avoid keywords**: ${brand.keywordsToAvoid.join(', ')}`;
  }

  if (brand.useEmojis === false) {
    prompt += `\n**Emojis**: Do NOT use emojis in any text.`;
  }

  if (brand.copyExamplesGood && brand.copyExamplesGood.length > 0) {
    prompt += `\n**Good copy examples**: "${brand.copyExamplesGood[0]}"`;
  }

  if (brand.extraGuidelines) {
    prompt += `\n**Additional guidelines**: ${brand.extraGuidelines}`;
  }

  return prompt;
}
```

---

## Files to Create/Modify

| File | Type | Description |
|------|------|-------------|
| `lib/db/schema.ts` | Modify | Add `brands` table with all fields |
| `lib/db/brands.ts` | New | Brand CRUD operations |
| `lib/brands/schemas.ts` | New | Zod schemas for brand memory |
| `lib/brands/scraping.ts` | New | HTML fetching and cleaning |
| `lib/brands/prompts.ts` | New | LLM extraction prompts |
| `lib/brands/scraper-service.ts` | New | AI SDK iterative workflow |
| `lib/brands/image-extractor.ts` | New | Deep image extraction from item pages |
| `lib/brands/converter.ts` | New | Convert scraped data to brand |
| `app/api/brands/route.ts` | New | GET (list), POST (create) |
| `app/api/brands/scrape/route.ts` | New | POST (scrape from URL) |
| `app/api/brands/[brandId]/route.ts` | New | GET, PATCH, DELETE |
| `app/api/brands/[brandId]/rescrape/route.ts` | New | POST (re-scrape) |
| `app/api/brands/[brandId]/moodboards/route.ts` | New | GET moodboards |
| `app/(dashboard)/dashboard/brands/page.tsx` | New | Brands list page |
| `app/(dashboard)/dashboard/brands/new/page.tsx` | New | Create brand form |
| `app/(dashboard)/dashboard/brands/[brandId]/page.tsx` | New | Brand detail/edit |
| `lib/workflows/generation/brand-prompt.ts` | New | Brand prompt injection |
| Dashboard sidebar | Modify | Add Brands navigation |

---

## Implementation Todos

### Phase 1: Schema & Types

- [ ] **1.1** Add `brands` table to schema with all fields
  - File: `lib/db/schema.ts`
  - Include all new fields: mission, values, USPs, ideal customer, competitors, keywords, etc.

- [ ] **1.2** Create brand Zod schemas and state type
  - File: `lib/brands/schemas.ts`
  - All memory types including audience, competitive, content, and scraper state

- [ ] **1.3** Generate and run migration
  - `npx drizzle-kit generate`
  - `npx drizzle-kit push`

### Phase 2: Brand Scraper

- [ ] **2.1** Create HTML scraping utility using Oxylabs
  - File: `lib/brands/scraping.ts`
  - Implement `getPageContent()` with `render: 'html'`
  - Handle result status codes and API errors

- [ ] **2.2** Create extraction prompt
  - File: `lib/brands/prompts.ts`
  - Updated for all new fields

- [ ] **2.3** Create AI SDK scraper service
  - File: `lib/brands/scraper-service.ts`

- [ ] **2.4** Create scraped data converter
  - File: `lib/brands/converter.ts`

- [ ] **2.5** Create deep image extractor
  - File: `lib/brands/image-extractor.ts`
  - extractImagesFromPage() - fetch page and extract all images
  - determineImageType() - classify as hero/gallery/thumbnail/icon/other
  - deepScrapeImages() - iterate over products/features/services and extract images
  - Parallel processing for performance
  - Skip patterns for non-content images

### Phase 3: Database Helpers

- [ ] **3.1** Create `lib/db/brands.ts`
  - All CRUD operations with new fields

- [ ] **3.2** Update moodboard helpers
  - Add: `listMoodboardsByBrand(teamId, brandId)`

### Phase 4: API Routes

- [ ] **4.1** Create `/api/brands` route
- [ ] **4.2** Create `/api/brands/scrape` route
- [ ] **4.3** Create `/api/brands/[brandId]` route
- [ ] **4.4** Create `/api/brands/[brandId]/rescrape` route
- [ ] **4.5** Create `/api/brands/[brandId]/moodboards` route

### Phase 5: Dashboard UI (PLG-Optimized)

- [ ] **5.1** Create brands list page
  - Brand cards with logo, name, completion %
  - "New Brand" button

- [ ] **5.2** Create brand onboarding page (minimal friction)
  - File: `app/(dashboard)/dashboard/brands/new/page.tsx`
  - Primary: URL input → Import → Preview → Create
  - Secondary: "Create Manually" → Name only → Create
  - No extra fields during onboarding

- [ ] **5.3** Create brand detail page (full editing)
  - File: `app/(dashboard)/dashboard/brands/[brandId]/page.tsx`
  - Collapsible sections for all field groups
  - Completion indicator with quick wins
  - Products/Features/Services grid with images

- [ ] **5.4** Update sidebar navigation

### Phase 6: Prompt Integration

- [ ] **6.1** Create brand prompt helper with all fields
- [ ] **6.2** Update workflow to include full brand context

---

## Environment Variables

Add to `.env`:

```env
# Brand Scraper
GEMINI_API_KEY=
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/YOUR_GATEWAY_ID
SCRAPER_PROXY_ENDPOINT=https://realtime.oxylabs.io
SCRAPER_PROXY_USERNAME=your_oxylabs_username
SCRAPER_PROXY_PASSWORD=your_oxylabs_password
SCRAPER_MAX_DEPTH=3
```

---

## Validation Rules

### Required Fields
- `name`: Required, max 255 characters

### Optional Text Fields
- `mission`: Max 5000 characters
- `tagline`: Max 500 characters
- `differentiator`: Max 2000 characters
- `toneOfVoice`: Max 2000 characters
- `idealCustomer`: Max 2000 characters
- `colorsUsage`: Max 1000 characters
- `extraGuidelines`: Max 2000 characters

### Array Fields
- `values`: Max 10 items
- `uniqueSellingPoints`: Max 10 items
- `competitors`: Max 20 items
- `niches`: Max 10 items
- `keywords`: Max 50 items
- `keywordsToAvoid`: Max 50 items
- `copyExamplesGood`: Max 10 items
- `copyExamplesBad`: Max 10 items
- `products`: Max 20 items (Physical Products only)
- `features`: Max 25 items (SaaS only)
- `services`: Max 15 items (Services only)

### Colors
- Valid hex format: `#RRGGBB` or `#RGB`
- Max 5 primary, 10 secondary
- Label max 50 characters

### Logo
- Supported formats: PNG, JPEG, SVG, WebP
- Max file size: 5MB

---

## Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "ai": "^4.0.x",
    "@ai-sdk/google": "^1.0.x",
    "cheerio": "^1.0.x",
    "zod": "^3.x"
  }
}
```

---

## Relationship with Moodboards

When brands are implemented, moodboards need:

1. **Schema update**: Add `brand_id` FK to moodboards table
2. **Creation flow**: Moodboards created from brand context
3. **Queries**: Filter moodboards by brand
4. **Deletion**: Cascade soft-delete when brand is deleted

See [Moodboard Implementation](./moodboard_v2_comprehensive.md) for moodboard-specific details.

---

## Related Documentation

- [Brands V2: Ad Accounts Integration](./brands_v2.md) — Future feature for connecting Google/Meta ad accounts and learning from top-performing ads
