"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AssetPickerField } from "@/components/asset-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy } from "lucide-react";

export type BatchGenerationPurpose = "catalog" | "ads" | "infographics";
export type BatchGenerationAspectRatio = "1:1" | "4:5" | "3:4" | "16:9";
export type BatchGenerationOutputFormat = "png" | "jpg" | "webp";

export type MoodboardOption = { id: number; name: string };
export type MoodboardStrength = "strict" | "inspired";

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
  moodboardStrength: MoodboardStrength;
  onMoodboardStrengthChange: (v: MoodboardStrength) => void;
  moodboards: MoodboardOption[];

  modelEnabled: boolean;
  onModelEnabledChange: (v: boolean) => void;
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
            <Field>
              <FieldLabel>Model</FieldLabel>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={props.modelEnabled}
                  onCheckedChange={(v) => {
                    const enabled = Boolean(v);
                    props.onModelEnabledChange(enabled);
                    if (!enabled) props.onModelImageUrlChange("");
                  }}
                />
                <span>Include model</span>
              </label>
              <FieldDescription>Optional. Uncheck to generate without a model.</FieldDescription>
            </Field>
            {props.modelEnabled ? (
              <AssetPickerField
                label="Model image"
                value={props.modelImageUrl}
                onChange={props.onModelImageUrlChange}
                kind="model"
                allowTemplates
                templateKind="model"
                description="Optional"
              />
            ) : null}
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
              <Select value={props.aspectRatio} onValueChange={(v) => props.onAspectRatioChange(v as any)}>
                <SelectTrigger id="batch-ratio" className="w-full">
                  <SelectValue placeholder="Select ratio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                  <SelectItem value="3:4">3:4</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="batch-purpose">Purpose</FieldLabel>
              <Select value={props.purpose} onValueChange={(v) => props.onPurposeChange(v as any)}>
                <SelectTrigger id="batch-purpose" className="w-full">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalog">Catalog</SelectItem>
                  <SelectItem value="ads">Ads</SelectItem>
                  <SelectItem value="infographics">Infographics</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="batch-format">Output format</FieldLabel>
              <Select value={props.outputFormat} onValueChange={(v) => props.onOutputFormatChange(v as any)}>
                <SelectTrigger id="batch-format" className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpg">JPG</SelectItem>
                  <SelectItem value="webp">WEBP</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="batch-moodboard">Moodboard (optional)</FieldLabel>
            <Select
              value={props.moodboardId ? String(props.moodboardId) : ""}
              onValueChange={(v) => props.onMoodboardIdChange(v ? Number(v) : null)}
            >
              <SelectTrigger id="batch-moodboard" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                {props.moodboards.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Applies a saved style profile + reference images to all variants.</FieldDescription>
          </Field>

          {props.moodboardId ? (
            <Field>
              <FieldLabel htmlFor="batch-moodboard-strength">Moodboard usage</FieldLabel>
              <Select
                value={props.moodboardStrength}
                onValueChange={(v) => props.onMoodboardStrengthChange(v as MoodboardStrength)}
              >
                <SelectTrigger id="batch-moodboard-strength" className="w-full">
                  <SelectValue placeholder="Select usage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inspired">Inspired (use style only)</SelectItem>
                  <SelectItem value="strict">Strict (use moodboard images)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Custom instructions override moodboard guidance.</FieldDescription>
            </Field>
          ) : null}
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


