# Brands

Brands represent your company or product line identity. Each brand captures voice, tone, visual identity, and other brand-specific attributes that guide content generation.

---

## What is a Brand?

A brand is a container for all the identity elements that make your content recognizable and consistent:

### Core Identity

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Name** | Brand name | "Acme Co" |
| **Mission** | Brand mission statement | "Making performance beautiful..." |
| **Tagline** | Brand tagline/slogan | "Style that doesn't cost the earth" |
| **Values** | Core brand values | ["Sustainability", "Quality", "Innovation"] |
| **Unique Selling Points** | What makes you different | ["Make Performance Beautiful"] |
| **Differentiator** | Key competitive advantage | "Only brand using 100% recycled materials" |

### Voice & Communication

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Voice** | How the brand speaks | "Friendly, approachable, conversational" |
| **Tone of Voice** | Detailed tone guidance | "Warm and encouraging, never preachy..." |
| **Use Emojis** | Whether to use emojis in copy | Yes / No |
| **Website Language** | Primary content language | "EN", "ES", "FR" |

### Target Audience

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Ideal Customer** | Target customer profile | "Eco-conscious millennials aged 25-40..." |
| **Motivators** | What motivates your audience | ["Status", "Sustainability", "Value"] |
| **Pain Points** | Problems your brand solves | ["Fast fashion guilt", "Finding quality basics"] |
| **Niches** | Industry categories | ["Fashion & Apparel", "Sustainable"] |
| **What You Sell** | Business type | "Physical Products", "SaaS", or "Services" |
| **Products** | Sample products (Physical Products only) | Scraped from product catalog |
| **Features** | Product features (SaaS only) | Scraped from features/pricing pages |
| **Services** | Service offerings (Services only) | Scraped from services pages |

### Visual Identity

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Colors** | Primary & secondary palettes | Primary: `#1A5F7A`, Secondary: `#F4D03F` |
| **Colors Usage** | How to apply the color palette | "Primary for CTAs, secondary for accents" |
| **Fonts** | Brand typography | Family, size, weight, color |
| **Logo** | Brand logo image(s) | Uploaded logo file with dominant colors |

### Competitive Context

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Competitors** | Key competitor brands | ["Nike", "Adidas", "Puma"] |
| **Competitor Strengths** | What competitors do well | "Strong athlete endorsements" |
| **Competitor Weaknesses** | Where competitors fall short | "Lack of sustainability focus" |
| **Emerging Trends** | Industry trends to leverage | "Rise of athleisure wear" |

### Content Guidelines

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Keywords** | Brand keywords to include | ["sustainable", "timeless", "quality"] |
| **Keywords to Avoid** | Words/phrases to never use | ["cheap", "discount", "budget"] |
| **Copy Examples (Good)** | Reference copy that works | "Crafted to last, designed to inspire" |
| **Copy Examples (Bad)** | Copy styles to avoid | "Buy now! Limited time only!" |
| **Extra Guidelines** | Additional brand rules | "Always lead with sustainability message" |

---

### Brands Own Moodboards

Each brand can have multiple moodboards that define different visual styles:

```
Team
└── Brand: "Acme Co"
    ├── Moodboard: "Summer 2024 - Beach"
    ├── Moodboard: "Holiday - Cozy"
    └── Moodboard: "Everyday - Minimal"
└── Brand: "Acme Kids"
    ├── Moodboard: "Playful Primary"
    └── Moodboard: "Soft Pastels"
```

This hierarchy allows you to:
- Manage multiple brands from one account
- Keep moodboards organized by brand
- Ensure generated content uses the right brand identity

---

## Creating a Brand

### Quick Start (Recommended)

Get started in seconds with URL import:

1. Click **New Brand**
2. Paste your website URL (e.g., `https://acme.com`)
3. Click **Import**
4. Review the extracted brand profile
5. Click **Create Brand**

That's it! You can start generating content immediately.

> **Pro tip:** Enhance your brand profile anytime from the dashboard to get better, more on-brand generations.

### What Gets Auto-Extracted

The scraper analyzes your website and extracts:

| Extracted | Description |
|-----------|-------------|
| ✅ **Name & Mission** | From title, about pages |
| ✅ **Tagline** | From hero sections, meta tags |
| ✅ **Logo(s)** | With dominant colors extracted |
| ✅ **Color Palette** | Primary & secondary from CSS |
| ✅ **Fonts** | Typography from your site |
| ✅ **Values & USPs** | From about/mission pages |
| ✅ **Keywords** | From content patterns |
| ✅ **Products / Features / Services** | Based on business type, with images |

> **How it works:** The scraper crawls your website (up to 3 pages deep) using AI. It visits individual product/feature/service pages to collect all relevant images.

### Enhance Later (Dashboard)

After onboarding, add strategic context from your brand dashboard to improve generations:

| Optional Fields | Why It Helps |
|-----------------|--------------|
| Voice & Tone guidance | More consistent copy style |
| Ideal Customer profile | Audience-appropriate messaging |
| Competitors | Better differentiation |
| Keywords to Avoid | Protect brand voice |
| Copy Examples | Reference for AI to match |

**You don't need these to start** — they just make generations more tailored over time.

---

If you prefer to create a brand without a website, or want to manually enter all details:

1. Click **New Brand** → **Create Manually**
2. Enter brand name (required)
3. Add any other details you have
4. Click **Create Brand**

You can add more details anytime from the brand dashboard.

---

## Enhancing Your Brand (Dashboard)

After creating your brand, visit **Dashboard → Brands → [Your Brand]** to add strategic context that improves generation quality.

### Quick Wins

These fields have the biggest impact on generation quality:

| Field | Impact |
|-------|--------|
| **Voice & Tone** | Makes copy sound like your brand |
| **Ideal Customer** | Tailors messaging to your audience |
| **Keywords to Avoid** | Prevents off-brand language |

### Full Enhancement Options

From the brand dashboard, you can edit or add:

**Core Identity**
- Mission, tagline, values, USPs, differentiator

**Voice & Communication**
- Voice, tone of voice, emoji preference

**Target Audience**
- Ideal customer, motivators, pain points

**Visual Identity**
- Colors (with usage guidelines), fonts, additional logos

**Competitive Context**
- Competitors, their strengths/weaknesses, market trends

**Content Guidelines**
- Keywords to include/avoid, copy examples, extra rules

**Products / Features / Services**
- Add, remove, or edit scraped items
- Upload additional images

> **Tip:** You don't need to fill everything. Start generating content right away, then enhance your brand profile based on what you need.

---

## Brand Attributes in Generation

When generating images and copy, the brand provides:

| From Brand | Used For |
|------------|----------|
| Name | Brand mentions in copy |
| Mission | Context for AI to understand brand purpose |
| Tagline | Headlines, CTAs, brand messaging |
| Values & USPs | Messaging themes and angles |
| Voice & Tone | Text generation style |
| Ideal Customer | Audience-appropriate language |
| Primary Colors | Dominant visual elements, backgrounds |
| Secondary Colors | Accents, highlights, supporting elements |
| Fonts | Typography in generated graphics |
| Logo | Logo placement when requested |
| Keywords | Terms to weave into copy |
| Keywords to Avoid | Terms to exclude from copy |
| Copy Examples | Reference for style and tone |

Combined with a moodboard's visual style, this creates fully on-brand content.

---

## Managing Brands

### Editing a Brand

- Update any brand attribute at any time
- Re-scrape from URL to refresh brand data
- Changes apply to future generations
- Existing generated content is not affected

### Brand and Moodboard Relationship

- A moodboard belongs to exactly one brand
- Deleting a brand will delete all its moodboards
- Moodboards inherit brand context automatically during generation

### Switching Brands

When generating content:
1. Select the brand
2. Select a moodboard from that brand
3. The system combines brand identity + moodboard style

---

## Best Practices

### Mission Statement

Write a compelling mission statement that includes:
- What the brand does
- Who it serves
- The impact or change it creates

**Good example:**
> "FILA SG brings performance-driven athletic products to Singapore, inspiring athletes and fitness enthusiasts to push their limits. Through our products and community engagement, we foster a culture of excellence and style, making performance beautiful."

### Brand Values

- Keep to 3-5 core values
- Make them actionable, not generic
- Ensure they differentiate you

| Generic | Specific |
|---------|----------|
| "Quality" | "Obsessive attention to craft" |
| "Customer-first" | "We design with our customers, not for them" |
| "Innovation" | "Pioneering sustainable materials" |

### Voice and Tone

Be specific about your brand voice:

| Instead of | Write |
|------------|-------|
| "Professional" | "Professional but approachable, like a knowledgeable friend" |
| "Fun" | "Playful and witty, uses casual language and occasional puns" |
| "Luxury" | "Refined and understated, never shouts, implies exclusivity" |

### Ideal Customer

Go beyond demographics:
- Include psychographics (values, attitudes)
- Describe behaviors and preferences
- Mention where they spend time

**Good example:**
> "Health-conscious urban professionals aged 28-45 who prioritize quality over quantity. They research before buying, value sustainability, and prefer brands that align with their values. Active on Instagram and LinkedIn."

### Keywords Strategy

**Keywords to Include:**
- Brand-specific terms
- Value propositions
- Emotional triggers

**Keywords to Avoid:**
- Competitor names
- Off-brand language
- Overused industry clichés

### Color Palette

- Include 2-3 primary colors (dominant)
- Include 2-5 secondary colors (accents)
- Add usage guidelines for consistency

---

## FAQ

**How many brands can I create?**
You can create multiple brands. This is useful for agencies managing multiple clients or companies with sub-brands.

**Can I import a brand from my website?**
Yes! Enter your website URL when creating a brand, and we'll automatically extract your brand identity including name, logo, colors, fonts, tagline, USPs, and more.

**Do I need to fill in all the fields?**
No! Just import from your URL and start generating. The scraper extracts everything needed to get started. You can enhance your brand profile later from the dashboard if you want more tailored results.

**What's the completion percentage?**
It shows how much of your brand profile is filled out. Higher completion = better generations, but you can start at any level. Focus on "quick wins" like Voice & Tone for the biggest impact.

**Can I move a moodboard to a different brand?**
Currently, moodboards are tied to a brand. To use a moodboard's style with a different brand, create a new moodboard under that brand with similar reference images.

**What if I don't have a logo?**
Logo is optional. Generations will simply not include a logo unless one is provided.

**Are brand colors required?**
No, but providing them helps ensure generated content matches your visual identity. Without them, colors come from the moodboard's extracted palette.

**How do keywords affect generation?**
Keywords are woven into generated copy naturally. Keywords to avoid are filtered out. This helps maintain consistent brand messaging.

**Should I add competitors?**
Adding competitors helps the AI understand your market positioning and create content that differentiates you. It's optional but recommended.

**What's the difference between Voice and Tone of Voice?**
Voice is a brief description (e.g., "Friendly, professional"). Tone of Voice is detailed guidance with examples and nuances for how to apply that voice.

**How deep does the scraper crawl?**
By default, the scraper crawls up to 3 pages deep from your homepage, looking for brand-relevant pages (About, Mission, Contact, etc.).
