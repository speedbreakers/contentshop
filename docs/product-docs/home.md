# Home

The Home page is the launchpad for ContentShop — a single-focus dashboard designed to get users generating ads immediately. Designed for product-led growth, it prioritizes time-to-value with one clear action.

---

## Purpose

The Home page has one job: **get users generating ads fast.**

| Goal | Description |
|------|-------------|
| **Immediate Action** | One hero CTA that starts ad generation instantly |
| **Zero Friction** | No navigation, no decisions — just generate |
| **Momentum** | Show recent work to keep users coming back |

For PLG success, users should generate their first ad within 60 seconds of landing on Home.

---

## Page Layout

### Hero Section: Generate Ad

The entire above-the-fold area is dedicated to a single, prominent call-to-action:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                                                     │
│                     🎨                                              │
│                                                                     │
│              Create scroll-stopping ads                             │
│                   in seconds                                        │
│                                                                     │
│          ┌─────────────────────────────────┐                        │
│          │                                 │                        │
│          │      Generate Ad Creative       │                        │
│          │                                 │                        │
│          └─────────────────────────────────┘                        │
│                                                                     │
│              Have a specific product?                               │
│              [Select from catalog →]                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Hero Elements:**
- Large, visually striking icon or animation
- Clear headline: "Create scroll-stopping ads in seconds"
- Primary CTA button: **"Generate Ad Creative"**
- Secondary link: "Have a specific product? Select from catalog →"

### Recent Generations

Below the fold, show the user's recent ad generations:

```
┌─────────────────────────────────────────────────────────────────────┐
│   Recent Ads                                            [View All →]│
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│   │          │  │          │  │          │  │          │           │
│   │  [img]   │  │  [img]   │  │  [img]   │  │  [img]   │           │
│   │          │  │          │  │          │  │          │           │
│   ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤           │
│   │ Summer   │  │ Launch   │  │ Promo    │  │ Holiday  │           │
│   │ 2h ago   │  │ 1d ago   │  │ 3d ago   │  │ 1w ago   │           │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Recent Generations:**
- Visual grid of recent ad thumbnails
- Click to view, download, or regenerate
- Horizontal scroll on mobile

---

## Ad Generation Flow

### Primary Flow: Quick Generate

When user clicks **"Generate Ad Creative"**:

```
Home → Click "Generate Ad Creative"
  → Modal opens with minimal required inputs
  → Upload image OR describe what to visualize
  → Select format (optional, defaults to 1:1)
  → Generate
  → View results inline
```

**Goal:** First ad generated in under 60 seconds.

### Secondary Flow: Product-Specific

When user clicks **"Select from catalog"**:

```
Home → Click "Select from catalog"
  → Product picker modal opens
  → User selects a product
  → Pre-filled ad generation modal with product images
  → Adjust settings if needed
  → Generate
```

**Goal:** Generate ads for existing products without re-uploading.

---

## Ad Generation Modal

A focused modal optimized for speed:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✕                        Generate Ad                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  What are you promoting?                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │     📷 Drop images here or click to upload                  │   │
│  │                                                             │   │
│  │     ─── or ───                                              │   │
│  │                                                             │   │
│  │     📝 Describe your product or service                     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Format                                    ▼ Square (1:1)           │
│                                                                     │
│  ┌─ Advanced ──────────────────────────────────────────────────┐   │
│  │  Moodboard          ▼ Default                               │   │
│  │  Platform           ▼ All platforms                         │   │
│  │  Number of variants ▼ 4                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│          ┌─────────────────────────────────┐                        │
│          │         Generate Ads            │                        │
│          └─────────────────────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Modal Fields

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| **Image/Description** | Yes (one or other) | — | Upload images OR enter text description |
| **Format** | No | Square (1:1) | Dropdown: Square, Story (9:16), Landscape (16:9) |
| **Moodboard** | No | Team default | Collapsed in "Advanced" |
| **Platform** | No | All platforms | Collapsed in "Advanced" |
| **Number of variants** | No | 4 | Collapsed in "Advanced" |

### Product-Specific Modal

When accessed via "Select from catalog", the modal is pre-filled:

- Product images already loaded
- Product name shown as context
- User can add/remove images
- All other fields work the same

---

## User Journeys

### First-Time User

```
Sign up → Land on Home
  → See hero: "Create scroll-stopping ads in seconds"
  → Click "Generate Ad Creative"
  → Upload a product photo from phone
  → Click Generate
  → See 4 ad variations in 30 seconds
  → Download or share
```

**Outcome:** Value delivered in first session.

### Returning User

```
Open app → Land on Home
  → See recent ads grid
  → Click "Generate Ad Creative" for new campaign
  → OR click recent ad to regenerate with tweaks
```

**Outcome:** Continue momentum from previous work.

### Power User with Catalog

```
Open app → Land on Home
  → Click "Select from catalog"
  → Choose product from library
  → Generate ads with product images pre-loaded
  → Batch generate for multiple products via sidebar
```

**Outcome:** Efficient workflow for users with existing catalogs.

---

## Design Principles

### 1. Single Focus

- One primary action above the fold
- No competing CTAs or distractions
- Secondary options clearly subordinate

### 2. Instant Gratification

- Generation starts with minimal input
- Smart defaults eliminate decisions
- Results appear fast (< 30 seconds)

### 3. Progressive Complexity

- Basic flow: upload → generate
- Advanced options collapsed by default
- Product selection optional, not required

### 4. Visual Momentum

- Recent ads create sense of progress
- Thumbnails inspire "what's next"
- Success builds on success

---

## Integration Points

### Products (Optional)

- "Select from catalog" link opens product picker
- Pre-loads product images into generation modal
- Users without products can still generate ads

### Moodboards

- Default moodboard applied automatically
- "Advanced" section allows override
- Link to create moodboard if none exists

### Brand Settings

- Ad copy pulls from brand voice
- Colors and fonts from brand identity
- Works without brand setup (uses defaults)

---

## Empty States

### No Recent Generations

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Your ads will appear here                                         │
│                                                                     │
│   Generate your first ad to get started!                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

- Hero CTA remains prominent
- Empty state is minimal, not instructional
- Focus stays on the action

---

## Success Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Time to First Ad | < 60 sec | From landing on Home to first ad generated |
| Hero CTA Click Rate | > 70% | Users who click "Generate Ad Creative" |
| Generation Completion Rate | > 80% | Users who complete generation after starting |
| Return Visit Rate | > 50% | Users returning within 7 days |

---

## Mobile Considerations

- Hero section fills viewport
- Single large CTA button (full width)
- Recent ads: horizontal scroll cards
- Modal: full-screen sheet
- Touch-friendly: 48px minimum tap targets

---

## Secondary Features (Accessible via Sidebar)

The following features are available but not promoted on Home:

| Feature | Access | Description |
|---------|--------|-------------|
| **Catalog Images** | Sidebar → Products | Generate product photography |
| **Marketing Copy** | Sidebar → Copy | Generate text content |
| **Batches** | Sidebar → Batches | Bulk generation |
| **Moodboards** | Sidebar → Moodboards | Visual style management |
| **Brand Settings** | Sidebar → Settings | Brand identity configuration |

These are power-user features that don't need to compete with the primary ad generation flow.

---

## Future Enhancements

### Phase 2

- **Recent Ads Intelligence:** "Your beach ads perform 2x better — generate more?"
- **Quick Templates:** "Black Friday Sale", "Product Launch", "Seasonal Promo"
- **One-Click Regenerate:** Regenerate any recent ad with one click

### Phase 3

- **Performance Integration:** Connect ad accounts, show which ads perform best
- **Smart Suggestions:** AI recommends what to generate next based on patterns
- **Scheduled Generation:** Set up recurring ad generation for campaigns

---

## FAQ

**Why only one CTA on Home?**
Simplicity drives action. Multiple options create decision paralysis. One clear path means more users complete their first generation, which is critical for PLG.

**What about Catalog Images and Marketing Copy?**
These are valuable features, but ads are the primary use case. Catalog and Copy are accessible via sidebar for users who need them. Home stays focused on the highest-value action.

**What if a user wants to select a product first?**
The "Select from catalog" link is visible below the hero CTA. Users with existing products can easily access their catalog without cluttering the primary flow.

**Does this work for users without products?**
Yes. The primary flow works with uploaded images or text descriptions. No product catalog required. This makes it accessible to all business types.

**How do credits work?**
Credits are shown in the sidebar. If credits are low, a subtle banner appears. Generation is never blocked without clear messaging about credits.
