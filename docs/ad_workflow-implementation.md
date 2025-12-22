# Unified Implementation Plan: Social Static Ad Workflow
## Project: Next.js + Vercel (Social Ad Generator)

This document outlines the unified architecture for porting the `social_static_ad` Python workflows to a Next.js application.

---

## 1. Core Architecture

The system is designed around a **Two-Layer Pipeline**:
1.  **The Planner (Brain)**: Analyzes inputs and determines *what* to generate.
2.  **The Executor (Hand)**: Generates the actual assets based on the plan.

### **Tech Stack**
*   **Runtime**: Next.js App Router (Vercel Serverless/Edge)
*   **AI Orchestration**: Vercel AI SDK (`ai` package) + Zod for structured outputs.
*   **Planner Models**: `gpt-4o` (OpenAI) OR `gemini-2.5-flash` (Google).
*   **Executor Model**: `gemini-3-pro` (via Vertex AI / Google AI Studio) for high-fidelity text rendering.
*   **Storage**: `@vercel/blob` for asset persistence.
*   **Logging**: `@sentry/nextjs`.

---

## 2. Directory Structure

Recommended structure for the Next.js project:

```text
src/
├── app/
│   ├── api/
│   │   ├── generate/
│   │   │   ├── route.ts             # Main orchestration endpoint
│   │   │   └── [usecase]/route.ts   # (Optional) specific routes if needed
├── lib/
│   ├── workflows/                   # Core Logic
│   │   ├── agentic/                 # Pattern 1: Plan -> Execute
│   │   │   ├── seasonal-campaign.ts
│   │   │   ├── store-display.ts
│   │   │   ├── bundle-offer.ts
│   │   │   ├── logo-generator.ts
│   │   │   ├── ugc-content.ts
│   │   │   └── festive-visual.ts
│   │   ├── direct/                  # Pattern 2: Template -> Execute
│   │   │   ├── static-ad.ts
│   │   │   ├── testimonial-ad.ts
│   │   │   └── hero-banner.ts
│   │   └── hybrid/                  # Pattern 3: Vision -> Template -> Execute
│   │       └── carousel-ad.ts
│   ├── ai/
│   │   ├── planner.ts               # Shared LLM Client (OpenAI/Gemini)
│   │   ├── generator.ts             # Shared Image Gen Client (Gemini 3 Pro)
│   │   └── vision.ts                # Shared Vision Analysis Client
│   ├── utils/
│   │   ├── image-processing.ts      # Slicing, resizing, base64 conversion
│   │   └── prompt-templates.ts      # Shared system prompts
│   └── storage/
│       └── blob.ts                  # Vercel Blob wrapper
```

---

## 3. Workflow Patterns

### **Pattern 1: The "Agentic" Workflow**
*Used for complex tasks requiring creative reasoning before generation.*

**Flow:**
1.  **Input**: Images + User Context.
2.  **Plan**: Call LLM to output a `PromptPlan` (JSON).
3.  **Execute**: Pass generated prompt to Image Model.

**Use Cases:**
*   **Seasonal Campaign**: Analyzes product colors & season to ensure harmony.
*   **Store Display**: Creates cinematic, world-building prompts.
*   **Bundle Offer**: Orchestrates multiple products into a "visual universe".
*   **Logo Generator**: Concept first, then symbol generation.
*   **UGC Product Holder**: "Video screengrab" aesthetic planning.
*   **Festive Visual**: Cultural/Seasonal analysis before generation.

**Implementation (Pseudo-code):**
```typescript
// lib/workflows/agentic/seasonal-campaign.ts
import { planCampaign } from '@/lib/ai/planner';
import { generateImage } from '@/lib/ai/generator';

export async function createSeasonalCampaign(params: WorkflowParams) {
  // Step 1: Plan
  const plan = await planCampaign({
    type: 'seasonal',
    images: params.productImages,
    context: params.userQuery
  });

  // Step 2: Execute (Parallel Variations)
  const results = await Promise.all(plan.prompts.map(prompt => 
    generateImage({
      prompt: prompt,
      referenceImages: params.productImages,
      aspectRatio: params.aspectRatio
    })
  ));

  return results;
}
```

### **Pattern 2: The "Direct" Workflow**
*Used for strict, template-based generation where the Image Model does the heavy lifting.*

**Flow:**
1.  **Input**: Images + Config.
2.  **Construct**: Fill a detailed System Prompt Template.
3.  **Execute**: Send directly to Image Model.

**Use Cases:**
*   **Static Ad**: Uses "Phase 1: Analysis... Phase 2: Execution" template.
*   **Testimonial Ad**: Regex parses input -> "Magazine Overlay" template.
*   **Hero Banner**: "Wearability" logic template (Garment vs Object).

**Implementation (Pseudo-code):**
```typescript
// lib/workflows/direct/static-ad.ts
import { STATIC_AD_TEMPLATE } from '@/lib/utils/prompt-templates';
import { generateImage } from '@/lib/ai/generator';

export async function createStaticAd(params: WorkflowParams) {
  // Step 1: Construct Prompt
  const prompt = STATIC_AD_TEMPLATE
    .replace('{context}', params.userQuery)
    .replace('{aspect_ratio}', params.aspectRatio);

  // Step 2: Execute
  return await generateImage({
    prompt: prompt,
    referenceImages: params.productImages,
    aspectRatio: params.aspectRatio
  });
}
```

### **Pattern 3: The "Hybrid" Workflow**
*Used when a specific pre-check is needed before templating.*

**Use Cases:**
*   **Carousel Ad**: 
    1.  **Vision Check**: Identify Brand Name & Product Type (Garment vs Object).
    2.  **Generate**: Create 21:9 Panoramic Image.
    3.  **Post-Process**: Slice into 3 distinct images (1080x1350 or similar).

**Implementation (Pseudo-code):**
```typescript
// lib/workflows/hybrid/carousel-ad.ts
import { identifyProduct } from '@/lib/ai/vision';
import { generateImage } from '@/lib/ai/generator';
import { sliceImage } from '@/lib/utils/image-processing';

export async function createCarouselAd(params: WorkflowParams) {
  // Step 1: Vision
  const identity = await identifyProduct(params.productImages[0]);
  
  // Step 2: Generate Wide Image
  const wideImage = await generateImage({
    prompt: `Panoramic 21:9 ad for ${identity.brand}...`,
    aspectRatio: '21:9'
  });

  // Step 3: Slice
  const slides = await sliceImage(wideImage.buffer, 3);
  
  // Step 4: Upload Slides
  return await uploadSlidesToBlob(slides);
}
```

---

## 4. Shared Utilities Checklist

1.  **`lib/ai/planner.ts`**:
    *   Should export functions like `analyzeProduct`, `generatePromptPlan`.
    *   Use `generateObject` from Vercel AI SDK for type-safe JSON.

2.  **`lib/ai/generator.ts`**:
    *   Wrapper around Google Vertex AI / Gemini API.
    *   Must handle `aspect_ratio` mapping (Next.js enums to Model params).
    *   Must handle image inputs (Base64 or URL).

3.  **`lib/utils/image-processing.ts`**:
    *   **Image Slicing**: Essential for Carousel Ad. Use `sharp` or a similar Node.js library.
    *   **Base64 Conversion**: Helper to fetch URLs and convert to Base64 for model ingestion.

4.  **`lib/storage/blob.ts`**:
    *   Wrapper for `@vercel/blob`.
    *   Should return public URLs.

---

## 5. Environment Variables

Required for Vercel deployment:

```env
# AI Providers
OPENAI_API_KEY=...       # For Agentic Planners
GOOGLE_API_KEY=...       # For Gemini Generator / Vision
# OR
VERTEX_PROJECT_ID=...    # If using Vertex AI
VERTEX_LOCATION=...

# Storage
BLOB_READ_WRITE_TOKEN=...

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=...
```

## 6. Implementation Strategy

1.  **Setup Core Libs**: Implement the AI clients (`planner.ts`, `generator.ts`) first.
2.  **Port "Direct" Workflows**: Start with `Static Ad` and `Hero Banner` as they are simplest (no intermediate LLM call).
3.  **Port "Agentic" Workflows**: Implement `Seasonal`, `Bundle`, and `Store Display`. These share a very similar "Planner" logic, so you can likely create a shared `createMarketingCampaign` abstraction.
4.  **Port "Hybrid" Workflows**: Implement `Carousel Ad` last, as it requires image processing (slicing) logic.

