"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AssetPickerField } from "@/components/asset-picker";
import { Copy } from "lucide-react";

export type BatchGenerationPurpose = "catalog" | "ads" | "infographics";
export type BatchGenerationAspectRatio = "1:1" | "4:5" | "3:4" | "16:9";
export type BatchGenerationOutputFormat = "png" | "jpg" | "webp";

export type MoodboardOption = { id: number; name: string };

export function BatchGenerationSettingsForm(props: {
  numberOfVariations: number;
  onNumberOfVariationsChange: (n: number) => void;

  aspectRatio: BatchGenerationAspectRatio;
  onAspectRatioChange: (v: BatchGenerationAspectRatio) => void;

  purpose: BatchGenerationPurpose;
  onPurposeChange: (v: BatchGenerationPurpose) => void;

  outputFormat: BatchGenerationOutputFormat;
  onOutputFormatChange: (v: BatchGenerationOutputFormat) => void;

  moodboardId: number | null;
  onMoodboardIdChange: (v: number | null) => void;
  moodboards: MoodboardOption[];

  modelImageUrl: string;
  onModelImageUrlChange: (v: string) => void;

  backgroundImageUrl: string;
  onBackgroundImageUrlChange: (v: string) => void;

  customInstructions: string[];
  onCustomInstructionsChange: (next: string[]) => void;
}) {
  const n = Math.max(1, Math.min(10, Math.floor(props.numberOfVariations || 1)));

  const instructions = React.useMemo(() => {
    const next = Array.from({ length: n }, (_, i) => props.customInstructions[i] ?? "");
    return next;
  }, [n, props.customInstructions]);

  function updateInstruction(idx: number, value: string) {
    const next = Array.from({ length: n }, (_, i) => instructions[i] ?? "");
    next[idx] = value;
    props.onCustomInstructionsChange(next);
  }

  function copyToAll(idx: number) {
    const v = String(instructions[idx] ?? "");
    const next = Array.from({ length: n }, () => v);
    props.onCustomInstructionsChange(next);
  }

  return (
    <FieldGroup>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4 pr-4 border-r">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AssetPickerField
              label="Model image"
              value={props.modelImageUrl}
              onChange={props.onModelImageUrlChange}
              kind="model"
              allowTemplates
              templateKind="model"
              description="Optional"
            />
            <AssetPickerField
              label="Background image"
              value={props.backgroundImageUrl}
              onChange={props.onBackgroundImageUrlChange}
              kind="background"
              allowTemplates
              templateKind="background"
              description="Optional"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="batch-variations">Number of variations</FieldLabel>
              <Input
                id="batch-variations"
                type="number"
                min={1}
                max={10}
                value={String(n)}
                onChange={(e) => props.onNumberOfVariationsChange(Number(e.target.value))}
              />
              <FieldDescription>Used for every selected variant.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="batch-ratio">Aspect ratio</FieldLabel>
              <select
                id="batch-ratio"
                value={props.aspectRatio}
                onChange={(e) => props.onAspectRatioChange(e.target.value as any)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="3:4">3:4</option>
                <option value="16:9">16:9</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="batch-purpose">Purpose</FieldLabel>
              <select
                id="batch-purpose"
                value={props.purpose}
                onChange={(e) => props.onPurposeChange(e.target.value as any)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="catalog">Catalog</option>
                <option value="ads">Ads</option>
                <option value="infographics">Infographics</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="batch-format">Output format</FieldLabel>
              <select
                id="batch-format"
                value={props.outputFormat}
                onChange={(e) => props.onOutputFormatChange(e.target.value as any)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WEBP</option>
              </select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="batch-moodboard">Moodboard (optional)</FieldLabel>
            <select
              id="batch-moodboard"
              value={props.moodboardId ? String(props.moodboardId) : ""}
              onChange={(e) => props.onMoodboardIdChange(e.target.value ? Number(e.target.value) : null)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">None</option>
              {props.moodboards.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
            <FieldDescription>Applies a saved style profile + reference images to all variants.</FieldDescription>
          </Field>
        </div>

        <div className="space-y-3">
          <div>
            <FieldLabel>Custom instructions</FieldLabel>
            <FieldDescription>Add per-variation instructions (applies to every variant).</FieldDescription>
          </div>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <FieldLabel
                htmlFor={`batch-instructions-${i}`}
                className="text-sm font-medium whitespace-nowrap min-w-fit"
              >
                Variation {i + 1}:
              </FieldLabel>
              <Input
                id={`batch-instructions-${i}`}
                value={instructions[i] || ""}
                onChange={(e) => updateInstruction(i, e.target.value)}
                placeholder="e.g., studio background, soft shadows"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToAll(i)}
                className="shrink-0 h-9 w-9 p-0"
                title="Copy to all variations"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </FieldGroup>
  );
}


