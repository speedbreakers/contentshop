┌─────────────────────────────────────────────────────────────────────────────┐
│                                   INPUT                                      │
│  • Product images (required)                                                 │
│  • Model image (optional)                                                    │
│  • Background image/description (optional)                                   │
│  • Custom description (optional)                                             │
│  • num_variations, aspect_ratio, output_format                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
              ┌──────────────────────┐   ┌──────────────────────┐
              │  LIFESTYLE Workflow  │   │   STUDIO Workflow    │
              │  (Gemini for prompts)│   │ (OpenAI for prompts) │
              └──────────────────────┘   └──────────────────────┘
                          │                         │
                          ▼                         ▼
              ┌──────────────────────────────────────────────────┐
              │           Step 1: Background Analysis            │
              │  If background is URL → Analyze with Gemini      │
              └──────────────────────────────────────────────────┘
                                       │
                                       ▼
              ┌──────────────────────────────────────────────────┐
              │        Step 2: Generate Creative Prompts         │
              │  Lifestyle: Gemini 2.5 Pro                       │
              │  Studio: OpenAI GPT-5.1 (or GPT-4o)              │
              └──────────────────────────────────────────────────┘
                                       │
                                       ▼
              ┌──────────────────────────────────────────────────┐
              │           Step 3: Generate Images                │
              │  First: Product + Model images                   │
              │  Subsequent: First result + Product images       │
              │  Model: Gemini 3 Pro Image Preview               │
              └──────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  OUTPUT                                      │
│  { success: boolean, outputAssets: GeneratedImage[] }                        │
└─────────────────────────────────────────────────────────────────────────────┘