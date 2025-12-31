# Brands V2: Ad Accounts Integration

> **Status:** Planned for future release

## Overview

Extend Brands with the ability to connect Google Ads and Meta (Facebook/Instagram) ad accounts. Once connected, the system can:

1. **Analyze high-performing ads** — Identify ads with best engagement, CTR, ROAS
2. **Extract winning patterns** — Learn visual styles, copy patterns, CTAs that work
3. **Inform new generations** — Use insights to guide AI generation for better results
4. **Rinse and repeat** — Continuously improve based on real performance data

This creates a feedback loop: generate ads → run campaigns → analyze performance → generate better ads.

---

## Data Model

### `ad_accounts` table

Stores connected advertising platform accounts.

```sql
CREATE TABLE ad_accounts (
  id serial PRIMARY KEY,
  brand_id integer NOT NULL REFERENCES brands(id),
  
  -- Platform info
  platform varchar(50) NOT NULL,          -- 'google_ads', 'meta_ads'
  account_id varchar(255) NOT NULL,       -- External platform account ID
  account_name varchar(255),              -- Display name
  
  -- OAuth tokens (encrypted)
  access_token text,
  refresh_token text,
  token_expires_at timestamp,
  
  -- Sync status
  last_synced_at timestamp,
  sync_status varchar(50) DEFAULT 'pending',  -- 'pending', 'syncing', 'synced', 'error'
  sync_error text,
  
  -- Settings
  auto_sync_enabled boolean DEFAULT true,
  sync_frequency_hours integer DEFAULT 24,
  
  -- System fields
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  
  UNIQUE(brand_id, platform, account_id)
);

CREATE INDEX ad_accounts_brand_id_idx ON ad_accounts(brand_id);
CREATE INDEX ad_accounts_platform_idx ON ad_accounts(platform);
```

### `ad_insights` table

Stores individual ad performance data and AI-extracted patterns.

```sql
CREATE TABLE ad_insights (
  id serial PRIMARY KEY,
  ad_account_id integer NOT NULL REFERENCES ad_accounts(id),
  brand_id integer NOT NULL REFERENCES brands(id),
  
  -- Ad identification
  external_ad_id varchar(255) NOT NULL,
  ad_name varchar(500),
  campaign_name varchar(500),
  ad_set_name varchar(500),
  
  -- Ad content
  headline text,
  primary_text text,
  description text,
  call_to_action varchar(100),
  image_urls jsonb DEFAULT '[]',          -- array of image URLs
  video_urls jsonb DEFAULT '[]',          -- array of video URLs
  landing_page_url varchar(2048),
  
  -- Performance metrics
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  ctr numeric(10, 4),                     -- click-through rate
  spend numeric(12, 2),
  conversions integer DEFAULT 0,
  conversion_rate numeric(10, 4),
  roas numeric(10, 2),                    -- return on ad spend
  cpc numeric(10, 2),                     -- cost per click
  cpm numeric(10, 2),                     -- cost per mille
  engagement_rate numeric(10, 4),
  
  -- Performance tier (calculated)
  performance_tier varchar(20),           -- 'top', 'above_average', 'average', 'below_average'
  performance_score numeric(5, 2),        -- 0-100 score
  
  -- AI-extracted insights
  extracted_style jsonb,                  -- visual style analysis
  extracted_copy_patterns jsonb,          -- copy patterns that work
  extracted_cta_style varchar(100),
  extracted_audience_signals jsonb,
  
  -- Date range for metrics
  metrics_start_date date,
  metrics_end_date date,
  
  -- System fields
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  
  UNIQUE(ad_account_id, external_ad_id)
);

CREATE INDEX ad_insights_brand_id_idx ON ad_insights(brand_id);
CREATE INDEX ad_insights_performance_tier_idx ON ad_insights(performance_tier);
CREATE INDEX ad_insights_performance_score_idx ON ad_insights(performance_score DESC);
```

### `brand_ad_learnings` table

Aggregated learnings from top-performing ads for each brand.

```sql
CREATE TABLE brand_ad_learnings (
  id serial PRIMARY KEY,
  brand_id integer NOT NULL REFERENCES brands(id),
  
  -- Aggregated learnings from top-performing ads
  top_performing_headlines jsonb DEFAULT '[]',
  top_performing_ctas jsonb DEFAULT '[]',
  winning_copy_patterns jsonb DEFAULT '[]',
  winning_visual_styles jsonb DEFAULT '[]',
  
  -- Audience insights
  best_performing_audiences jsonb DEFAULT '[]',
  peak_engagement_times jsonb DEFAULT '[]',
  
  -- Platform-specific insights
  google_insights jsonb,
  meta_insights jsonb,
  
  -- AI-generated recommendations
  recommendations jsonb DEFAULT '[]',
  
  -- Freshness
  last_analyzed_at timestamp,
  ads_analyzed_count integer DEFAULT 0,
  
  -- System fields
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  
  UNIQUE(brand_id)
);
```

---

## TypeScript Types

```typescript
// Platform enum
type AdPlatform = 'google_ads' | 'meta_ads';

// Ad account connection
type AdAccount = {
  id: number;
  brandId: number;
  platform: AdPlatform;
  accountId: string;
  accountName: string | null;
  lastSyncedAt: Date | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  autoSyncEnabled: boolean;
  syncFrequencyHours: number;
};

// Performance tier
type PerformanceTier = 'top' | 'above_average' | 'average' | 'below_average';

// Individual ad insight
type AdInsight = {
  id: number;
  adAccountId: number;
  brandId: number;
  externalAdId: string;
  adName: string | null;
  campaignName: string | null;
  
  // Content
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  imageUrls: string[];
  videoUrls: string[];
  landingPageUrl: string | null;
  
  // Metrics
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
  conversionRate: number;
  roas: number;
  cpc: number;
  cpm: number;
  engagementRate: number;
  
  // Performance
  performanceTier: PerformanceTier;
  performanceScore: number;
  
  // AI analysis
  extractedStyle: ExtractedAdStyle | null;
  extractedCopyPatterns: CopyPattern[] | null;
  extractedCtaStyle: string | null;
};

// AI-extracted visual style from ad
type ExtractedAdStyle = {
  colorPalette: string[];
  visualTheme: string;           // 'minimal', 'bold', 'lifestyle', etc.
  imageComposition: string;
  textOverlayStyle: string;
  dominantElements: string[];
};

// Copy pattern from successful ads
type CopyPattern = {
  pattern: string;               // e.g., "problem-agitation-solution"
  example: string;
  frequency: number;             // how often this appears in top ads
};

// Aggregated learnings for a brand
type BrandAdLearnings = {
  id: number;
  brandId: number;
  
  topPerformingHeadlines: { text: string; ctr: number; source: string }[];
  topPerformingCtas: { cta: string; conversionRate: number }[];
  winningCopyPatterns: CopyPattern[];
  winningVisualStyles: ExtractedAdStyle[];
  
  bestPerformingAudiences: { name: string; roas: number }[];
  peakEngagementTimes: { dayOfWeek: number; hour: number; engagement: number }[];
  
  recommendations: {
    type: 'copy' | 'visual' | 'targeting';
    recommendation: string;
    basedOn: string;
    confidence: number;
  }[];
  
  lastAnalyzedAt: Date | null;
  adsAnalyzedCount: number;
};
```

---

## OAuth Integration

### Google Ads

- Requires Google Ads API access
- OAuth 2.0 with offline access for refresh tokens
- Scopes: `https://www.googleapis.com/auth/adwords`
- Store customer ID (MCC or individual account)

### Meta Ads

- Requires Facebook Marketing API access
- OAuth 2.0 with `ads_read` permission
- Long-lived tokens via token exchange
- Store ad account ID

---

## Sync Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Ad Sync Pipeline                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐  │
│   │  Fetch   │────►│  Store   │────►│  Analyze │────►│  Learn   │  │
│   │   Ads    │     │ Insights │     │  w/ AI   │     │ Patterns │  │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘  │
│       │                                                      │       │
│       │                                                      ▼       │
│       │                                            ┌──────────────┐ │
│       └──────── Scheduled (daily) ◄────────────────│ Update Brand │ │
│                                                    │  Learnings   │ │
│                                                    └──────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sync Steps

1. **Fetch Ads** — Pull ad data from connected platforms via API
2. **Store Insights** — Save ad content and performance metrics
3. **Analyze with AI** — Extract visual styles, copy patterns using vision + text models
4. **Learn Patterns** — Aggregate insights into brand-level learnings
5. **Update Brand Learnings** — Refresh recommendations for generation

---

## Using Ad Insights in Generation

When generating new ads, the system can reference brand ad learnings:

```typescript
function buildAdLearningsPromptSection(learnings: BrandAdLearnings): string {
  let prompt = `
## PERFORMANCE INSIGHTS (from your top-performing ads)

`;

  if (learnings.topPerformingHeadlines.length > 0) {
    prompt += `**Headlines that work:**\n`;
    learnings.topPerformingHeadlines.slice(0, 3).forEach(h => {
      prompt += `- "${h.text}" (${(h.ctr * 100).toFixed(1)}% CTR)\n`;
    });
  }

  if (learnings.winningCopyPatterns.length > 0) {
    prompt += `\n**Copy patterns to follow:**\n`;
    learnings.winningCopyPatterns.slice(0, 3).forEach(p => {
      prompt += `- ${p.pattern}: "${p.example}"\n`;
    });
  }

  if (learnings.topPerformingCtas.length > 0) {
    prompt += `\n**CTAs that convert:**\n`;
    learnings.topPerformingCtas.slice(0, 3).forEach(c => {
      prompt += `- "${c.cta}"\n`;
    });
  }

  if (learnings.recommendations.length > 0) {
    prompt += `\n**AI Recommendations:**\n`;
    learnings.recommendations.slice(0, 3).forEach(r => {
      prompt += `- ${r.recommendation}\n`;
    });
  }

  return prompt;
}
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/brands/[brandId]/ad-accounts` | GET | List connected ad accounts |
| `/api/brands/[brandId]/ad-accounts` | POST | Connect new ad account (initiate OAuth) |
| `/api/brands/[brandId]/ad-accounts/[accountId]` | DELETE | Disconnect ad account |
| `/api/brands/[brandId]/ad-accounts/[accountId]/sync` | POST | Trigger manual sync |
| `/api/brands/[brandId]/ad-insights` | GET | List ad insights (with filters) |
| `/api/brands/[brandId]/ad-insights/top-performers` | GET | Get top performing ads |
| `/api/brands/[brandId]/ad-learnings` | GET | Get aggregated learnings |
| `/api/oauth/google-ads/callback` | GET | Google OAuth callback |
| `/api/oauth/meta-ads/callback` | GET | Meta OAuth callback |

---

## Dashboard UI

### Ad Accounts Section (`/dashboard/brands/[brandId]/ad-accounts`)

- Connect Google Ads button → OAuth flow
- Connect Meta Ads button → OAuth flow
- List connected accounts with sync status
- Manual "Sync Now" button
- Disconnect account

### Ad Insights Section (`/dashboard/brands/[brandId]/ad-insights`)

- Filter by platform, performance tier, date range
- Grid of ad cards showing:
  - Ad creative thumbnail
  - Key metrics (CTR, ROAS, spend)
  - Performance tier badge
- Click to expand for full details

### Learnings Dashboard (`/dashboard/brands/[brandId]/learnings`)

- Top performing headlines (with CTR)
- Winning copy patterns
- Visual style analysis
- AI recommendations for next campaign
- "Apply to New Generation" button

---

## Environment Variables

```env
# Google Ads
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=

# Meta Ads
META_APP_ID=
META_APP_SECRET=
```

---

## Implementation Todos

- [ ] **1.** Create `ad_accounts` table schema
- [ ] **2.** Create `ad_insights` table schema  
- [ ] **3.** Create `brand_ad_learnings` table schema
- [ ] **4.** Implement Google Ads OAuth flow
- [ ] **5.** Implement Meta Ads OAuth flow
- [ ] **6.** Build ad sync pipeline (fetch → store → analyze)
- [ ] **7.** Create AI analysis for ad performance patterns
- [ ] **8.** Build aggregated learnings computation
- [ ] **9.** Integrate ad learnings into generation prompts
- [ ] **10.** Create ad accounts management UI
- [ ] **11.** Create ad insights dashboard
- [ ] **12.** Create learnings dashboard with recommendations

---

## Implementation Notes

- OAuth tokens should be encrypted at rest
- Implement token refresh logic before API calls
- Rate limiting per platform API requirements
- Background job for scheduled syncs (cron)
- Performance scoring algorithm considers multiple metrics
- AI analysis runs on images using vision model
- Copy analysis uses text extraction from ad content
- Consider privacy: only sync aggregate metrics, not audience PII
