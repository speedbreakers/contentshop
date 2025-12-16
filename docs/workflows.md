## Generation workflows (category × purpose)

We route each variant generation request to a **workflow** based on:
- **product category** (`product.category`)
- **purpose** (`input.purpose`: `catalog` | `ads`)

The resolved workflow key is persisted to:
- `variant_generations.schema_key`
- `variant_images.schema_key`

This makes the workflow used for an image auditable and enables future reporting/filters.

### Current workflows
- `apparel.catalog.v1`
- `apparel.ads.v1`
- `apparel.infographics.v1`
- `non_apparel.catalog.v1`
- `non_apparel.ads.v1`
- `non_apparel.infographics.v1`

### Where routing happens
- Router: `lib/workflows/generation/resolve-workflow.ts`
- Registry: `lib/workflows/generation/workflows.ts`
- API entry: `app/api/products/[productId]/variants/[variantId]/generations/route.ts`

### How to add a new workflow
See [`docs/how-to-add-a-workflow.md`](docs/how-to-add-a-workflow.md) for the full step-by-step guide.

1. **Add the workflow key**
   - Update the `GenerationWorkflowKey` union in `lib/workflows/generation/types.ts`.

2. **Add workflow implementation**
   - Add an entry in `generationWorkflows` in `lib/workflows/generation/workflows.ts`:
     - Provide an `inputSchema` (zod) for validation/normalization.
     - Provide a `buildPrompt()` implementation.

3. **Update routing**
   - Update `resolveGenerationWorkflowKey()` in `lib/workflows/generation/resolve-workflow.ts` to map the new category/purpose combination to your new workflow key.

4. **(Optional) UI changes**
   - If the workflow requires additional inputs, add them to the Generate modal and include them in `input`.

### Notes
- We currently define “non-apparel” as **any category other than `apparel`**.
- Folder behavior is unchanged: all generated images still go to the variant’s Default folder unless moved by the user.


