# Moodboards

Moodboards capture the visual style and aesthetic from reference images. Each moodboard belongs to a [Brand](./brands.md) and guides AI image generation to produce content that matches your desired look and feel.

---

## Moodboards and Brands

Moodboards exist within a brand hierarchy:

```
Team
└── Brand: "Acme Co"
    ├── Moodboard: "Summer 2024 - Beach"
    ├── Moodboard: "Holiday - Cozy"
    └── Moodboard: "Everyday - Minimal"
```

- Each moodboard belongs to exactly one brand
- A brand can have multiple moodboards for different campaigns or styles
- When generating, the brand provides identity (voice, tone, colors) while the moodboard provides visual style

See [Brands](./brands.md) for more on setting up brand identity.

---

## What is a Moodboard?

A moodboard is a collection of reference images that define your brand's visual style. When you upload images, the system analyzes them to extract:

- **Visual style** — Editorial, lifestyle, studio, or mixed
- **Lighting** — Natural, artificial, soft, dramatic, etc.
- **Color palette** — Dominant and accent colors, warm/cool temperature
- **Camera style** — Depth of field, framing, angles
- **Composition** — Layout, negative space, symmetry
- **Environment** — Settings, materials, surfaces
- **Model styling** — Clothing style, poses, expressions
- **Props and textures** — Objects, materials, textures
- **Motifs and shapes** — Recurring design elements
- **Overall vibe** — Mood keywords (cozy, bold, minimal, etc.)

This extracted style profile is then used to guide all image generations, ensuring consistency across your content.

---

## Creating a Moodboard

### Step 1: Select a Brand

1. Navigate to the brand you want to create a moodboard for
2. Click **New Moodboard**

### Step 2: Upload Reference Images

1. Upload images that represent your desired visual style
   - Drag and drop, or click to select files
   - Upload as many images as needed (more images = better style extraction)
2. Remove any images that don't fit by clicking the remove button

**Tips for choosing reference images:**
- Use images that represent the style you want in generated content
- Include a variety of shots (product, lifestyle, detail)
- All images should share a cohesive aesthetic
- Quality matters — use high-resolution images

### Step 3: Save and Analyze

1. Click **Save**
2. Enter a name for your moodboard
3. Wait for analysis to complete
   - The system analyzes all images in parallel
   - Extracts visual characteristics from each image
   - Combines findings into a unified style profile

### Step 4: Ready to Use

Once analysis completes, your moodboard is ready. You can:
- View the extracted style profile
- Use it for image generation
- Add more images later (only new images will be analyzed)

---

## How Moodboards Work

### Two-Pass Analysis

1. **Per-Image Extraction** — Each image is analyzed individually to extract detailed style observations
2. **Combine & Synthesize** — All per-image analyses are combined to create a consensus style profile

The system only promotes traits that appear consistently across multiple images. This ensures the style profile reflects the true essence of your brand, not one-off characteristics.

### Incremental Updates

When you add new images to an existing moodboard:
- Only the new images are analyzed (not the entire moodboard)
- The style profile is regenerated using all images
- This makes updates fast and efficient

When you remove images:
- The style profile is regenerated with remaining images
- No new analysis needed — just recombination

---

## Using Moodboards for Generation

When generating images, select a moodboard to apply its style. The system will:

1. Inject the moodboard's visual guidelines into the generation prompt
2. Guide the AI to match your brand's:
   - Lighting and color palette
   - Camera style and composition
   - Environment and props
   - Overall mood and aesthetic

### What Moodboards Control

| Aspect | Moodboard Provides |
|--------|-------------------|
| Visual style | Lighting, colors, camera, composition |
| Environment | Settings, materials, surfaces |
| Model styling | Clothing approach, poses |
| Design elements | Shapes, motifs, textures |
| Mood | Vibe keywords, aesthetic direction |

### What Moodboards Don't Control

These come from the **Brand** or the generation request:

| Aspect | Comes From |
|--------|-----------|
| Product details | Your product data |
| Brand name/description | Brand settings |
| Voice and tone | Brand settings |
| Hex colors | Brand settings |
| Logo | Brand settings |
| Language | Generation request |
| Aspect ratio | Generation request |

This separation keeps moodboards focused on visual style while brands handle identity.

---

## Best Practices

### Choosing Reference Images

**Do:**
- Include 5-15 images for best results
- Use images with consistent style
- Mix product shots, lifestyle images, and details
- Include images that show your desired lighting and composition

**Don't:**
- Mix drastically different aesthetics
- Use low-quality or blurry images
- Include images with styles you want to avoid

### Organizing Moodboards

- Create separate moodboards for different campaigns or seasons
- Name moodboards descriptively (e.g., "Summer 2024 - Coastal", "Holiday Campaign - Cozy")
- Update moodboards by adding new reference images as your style evolves

### Getting Better Results

- More reference images = more accurate style extraction
- Consistent images = clearer style profile
- Review the extracted style profile to ensure it matches your intent
- If results don't match expectations, try adding more representative images

---

## Moodboard States

| Status | Meaning |
|--------|---------|
| **Analyzing** | Analysis in progress — wait for completion |
| **Ready** | Analysis complete — moodboard can be used for generation |
| **Failed** | Analysis failed — retry or check images |

---

## FAQ

**How many images should I upload?**
We recommend 5-15 images. More images provide better style extraction, but even 3-5 quality images can produce good results.

**Can I edit the extracted style profile?**
The style profile is automatically generated from your images. To change it, add or remove reference images and the profile will update.

**How long does analysis take?**
Analysis typically completes in under a minute. All images are processed in parallel for speed.

**Can I use multiple moodboards?**
Yes, you can create multiple moodboards for different purposes. Select which moodboard to use when generating images.

**What image formats are supported?**
JPEG, PNG, and WebP are supported. Use high-resolution images for best results.
