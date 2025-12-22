# Implementation Plan: Ad Workflow (Apparel & Non-Apparel)

This document outlines the plan to implement the Ad Workflow for both Apparel and Non-Apparel products, adapting the "Planner -> Executor" pattern to the existing project structure and incorporating moodboard-driven creative direction.

## 1. Architecture Overview

The Ad Workflow will introduce a two-step process to ensure high-quality, creatively aligned outputs:

1.  **The Planner (Brain)**: Analyzes the user's inputs (images, custom instructions, moodboard) and generates a structured `PromptPlan`. This step uses an LLM to reason about the best way to achieve the user's goal while adhering to the brand style defined in the moodboard.
2.  **The Executor (Hand)**: Takes the `PromptPlan` and executes the image generation using the generative model.

## 2. Directory Structure & New Files

We will integrate the new logic into the existing `lib/` structure:

```text
lib/
├── ai/
│   ├── planner.ts               # (NEW) Shared Planner logic (generateObject)
│   ├── ad-generator.ts          # (NEW) Shared Ad Generation logic
│   └── ...
├── workflows/
│   └── generation/
│       ├── apparel/
│       │   ├── ad-execute.ts    # (NEW) Apparel Ad Orchestrator
│       │   └── ...
│       ├── non-apparel/
│       │   ├── ad-execute.ts    # (NEW) Non-Apparel Ad Orchestrator
│       │   └── ...
│       └── workflows.ts         # (UPDATE) Register new execute functions
```

## 3. Implementation Details

### Step 1: Implement the Planner (`lib/ai/planner.ts`)

Create a shared planner module that uses `generateObject` (from Vercel AI SDK) to convert unstructured inputs and moodboard context into a structured plan.

**Key Responsibilities:**
-   Analyze `custom_instructions` and `moodboard`.
-   **Moodboard Integration**:
    -   Extract style summaries (`styleProfile.reference_positive_summary`, `reference_negative_summary`).
    -   Extract component-specific summaries (`styleProfile.backgrounds_analysis_summary`, `styleProfile.models_analysis_summary`).
    -   Use these summaries to inform the creative direction, ensuring the generated prompts align with the brand's visual identity.
    -   Respect `moodboardStrength` ('strict' vs 'inspired').
-   Determine the creative direction (lighting, composition, background).
-   Output a `PromptPlan` object containing prompts for each variation.

**Proposed Interface:**
```typescript
export type AdPromptPlan = {
  prompts: string[];
  rationale: string;
};

export async function planAdCampaign(args: {
  productTitle: string;
  category: 'apparel' | 'non_apparel';
  customInstructions: string;
  moodboard?: {
    styleProfile: Record<string, unknown>;
    positiveSummary: string;
    negativeSummary: string;
    styleAppendix: string;
    // ... asset URLs if needed for multi-modal planning
  } | null;
  moodboardStrength?: 'strict' | 'inspired';
  numberOfVariations: number;
}): Promise<AdPromptPlan>;
```

### Step 2: Implement the Ad Generator (`lib/ai/ad-generator.ts`)

Create a shared generator module for ads. This will be similar to `generateApparelCatalogImages` but optimized for ads.

**Key Responsibilities:**
-   Accept a list of prompts (from the Planner).
-   **Moodboard Integration**:
    -   While the Planner handles the *creative direction*, the Generator can optionally use moodboard images as direct style references (image-to-image or style-transfer inputs) if the model supports it or if required by the workflow (e.g., using `positiveAssetUrls` as style references).
    -   In the prompt construction, inject `positiveReferenceSummary`, `negativeReferenceSummary`, and `styleAppendix` as textual guidance (similar to catalog workflows) to reinforce the style.
-   Call the image generation model (e.g., `google/gemini-2.5-flash-image`).
-   Handle image uploads to Blob storage.
-   Return generated image URLs.

**Proposed Interface:**
```typescript
export async function generateAdImages(args: {
  prompts: string[];
  productImages: string[]; // URLs
  modelImage?: string; // URL
  // Optional: Pass style references directly to the model if supported/needed
  styleReferenceImages?: string[];
  aspectRatio: string;
  teamId: number;
  // ... other context
});
```

### Step 3: Implement Apparel Ad Orchestrator (`lib/workflows/generation/apparel/ad-execute.ts`)

This function will be the entry point for `apparel.ads.v1`.

**Flow:**
1.  **Resolve Inputs**: specific to apparel (garment analysis, masking if needed).
2.  **Plan**: Call `planAdCampaign` with apparel-specific context AND the full moodboard object.
3.  **Execute**: Call `generateAdImages` with the generated prompts. Pass relevant moodboard images as `styleReferenceImages` if the plan dictates.
4.  **Save**: Persist results to the database (similar to catalog workflows).

### Step 4: Implement Non-Apparel Ad Orchestrator (`lib/workflows/generation/non-apparel/ad-execute.ts`)

This function will be the entry point for `non_apparel.ads.v1`.

**Flow:**
1.  **Resolve Inputs**: specific to non-apparel (product images, background removal if needed).
2.  **Plan**: Call `planAdCampaign` with non-apparel context AND the full moodboard object.
3.  **Execute**: Call `generateAdImages`.
4.  **Save**: Persist results.

### Step 5: Update Workflow Registry (`lib/workflows/generation/workflows.ts`)

Wire up the new execute functions to the workflow definitions.

```typescript
'apparel.ads.v1': {
  ...makeWorkflow('apparel.ads.v1', 'apparel', 'ads'),
  execute: executeApparelAdWorkflow,
},
'non_apparel.ads.v1': {
  ...makeWorkflow('non_apparel.ads.v1', 'non_apparel', 'ads'),
  execute: executeNonApparelAdWorkflow,
},
```

## 4. Dependencies & Prerequisites

-   Ensure `ai` package (Vercel AI SDK) is up to date to support `generateObject`.
-   Verify access to the "Planner" model (e.g., `google/gemini-2.5-flash` or `gpt-4o`).
-   Reuse existing `google/gemini-2.5-flash-image` for the "Executor" phase.

## 5. Future Considerations (Hybrid Patterns)

The current plan covers "Agentic" (Planning) and "Direct" (if Planning returns a simple prompt) patterns. "Hybrid" patterns (requiring intermediate image processing like slicing) can be added later as specialized steps in the orchestrators.
