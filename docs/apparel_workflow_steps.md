┌─────────────┐
│  INPUT      │
│ Garment     │
│ Images      │
│ (URLs)      │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CLASSIFY GARMENTS                                                │
│  ─────────────────────────                                                │
│  Input: Array of image URLs                                               │
│  Process: Gemini analyzes each image to determine view type               │
│  Output: { front, back, front_close?, back_close?, need_masking }         │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼ (if need_masking = true)
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 2: MASK GARMENTS (Optional)                                         │
│  ────────────────────────────────                                         │
│  Input: Classified garment images                                         │
│  Process: Gemini removes background, extracts pure garment                │
│  Output: Clean flatlay images with transparent/white background           │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 3: ANALYZE GARMENT                                                  │
│  ───────────────────────                                                  │
│  Input: Front garment image                                               │
│  Process: Gemini extracts garment attributes using structured output      │
│  Output: {                                                                │
│    gender: "male" | "female",                                             │
│    garment_category: "top" | "bottom" | "fullbody",                       │
│    garment_type: "shirt" | "jeans" | "dress" | ...,                       │
│    occasion: "casual" | "formal" | ...,                                   │
│    styling_suggestions: { topwear, bottomwear, footwear, notes },         │
│    is_bottom_jeans: boolean                                               │
│  }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 4: GENERATE BACKGROUND DESCRIPTION                                  │
│  ───────────────────────────────────────                                  │
│  Input: Garment analysis data + optional user preferences                 │
│  Process: Gemini generates creative background description                │
│  Output: "Sunlit Mediterranean courtyard with terracotta tiles..."        │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 5: GENERATE IMAGE                                                   │
│  ──────────────────────                                                   │
│  Input: Garment images + model description + background + pose prompt     │
│  Process: Gemini Image model generates model wearing garment              │
│  Output: { url, path, prompt, source }                                    │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  OUTPUT     │
│ Generated   │
│ Image URL   │
└─────────────┘