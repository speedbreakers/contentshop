"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AssetPickerField } from "@/components/asset-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  // Important UX detail: allow selecting "Use my model image" even before an image is chosen.
  // If we derive the mode from modelEnabled+modelImageUrl, the selection would snap back to "auto".
  const [modelMode, setModelMode] = React.useState<"none" | "auto" | "image">(() => {
    if (!props.modelEnabled) return "none";
    return props.modelImageUrl.trim() ? "image" : "auto";
  });

  React.useEffect(() => {
    if (!props.modelEnabled) {
      setModelMode("none");
      return;
    }
    if (props.modelImageUrl.trim()) {
      setModelMode("image");
      return;
    }
    // If the user already chose "image" but hasn't picked a file yet, keep it.
    setModelMode((prev) => (prev === "image" ? "image" : "auto"));
  }, [props.modelEnabled, props.modelImageUrl]);

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
        {/* Step 1 (left): scene inputs */}
        <div className="space-y-4 pr-4 border-r">
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <Field>
                <FieldLabel>Model</FieldLabel>
                <FieldDescription className="text-xs">
                  Choose whether to include a model. If you upload a model photo, we’ll try to match that exact model.
                </FieldDescription>
                <RadioGroup
                  value={modelMode}
                  onValueChange={(v) => {
                    const mode = (v as "none" | "auto" | "image") ?? "auto";
                    setModelMode(mode);
                    if (mode === "none") {
                      props.onModelEnabledChange(false);
                      props.onModelImageUrlChange("");
                    } else if (mode === "auto") {
                      props.onModelEnabledChange(true);
                      props.onModelImageUrlChange("");
                    } else {
                      props.onModelEnabledChange(true);
                    }
                  }}
                  className="mt-2 gap-3"
                >
                  <label className="flex items-start gap-2 text-sm">
                    <RadioGroupItem value="none" className="mt-0.5" />
                    <span className="font-medium">No model</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <RadioGroupItem value="auto" className="mt-0.5" />
                    <span className="font-medium">Auto model</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <RadioGroupItem value="image" className="mt-0.5" />
                    <span className="font-medium">Use my model image</span>
                  </label>
                </RadioGroup>
              </Field>

              <div className="space-y-2">
                {modelMode === "image" ? (
                  <>
                    <AssetPickerField
                      label="Upload a model image"
                      value={props.modelImageUrl}
                      onChange={props.onModelImageUrlChange}
                      kind="model"
                      allowTemplates
                      templateKind="model"
                      description="Optional"
                    />
                    <FieldDescription className="text-xs">Tip: Full-body photos transfer pose/framing best.</FieldDescription>
                  </>
                ) : (
                  <div className="text-center rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {modelMode === "none"
                      ? "No model will be used."
                      : "We’ll choose a model automatically."}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <AssetPickerField
              label="Background image"
              value={props.backgroundImageUrl}
              onChange={props.onBackgroundImageUrlChange}
              kind="background"
              allowTemplates
              templateKind="background"
              description="Optional"
            />
            <div className="text-xs text-muted-foreground">
              If provided, we’ll match this exact background. Otherwise, background is inferred from your moodboard and instructions.
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <Field>
                <FieldLabel htmlFor="batch-moodboard-strength">Moodboard usage</FieldLabel>
                <Select
                  value={props.moodboardStrength}
                  onValueChange={(v) => props.onMoodboardStrengthChange(v as MoodboardStrength)}
                  disabled={!props.moodboardId}
                >
                  <SelectTrigger id="batch-moodboard-strength" className="w-full">
                    <SelectValue
                      placeholder={props.moodboardId ? "Select usage" : "Select a moodboard first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspired">Inspired (use style only)</SelectItem>
                    <SelectItem value="strict">Strict (use moodboard images)</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {props.moodboardId
                    ? "Custom instructions override moodboard guidance."
                    : "Select a moodboard to enable this setting."}
                </FieldDescription>
              </Field>
            </div>
          </div>
        </div>

        {/* Step 2 (right): output settings */}
        <div className="space-y-4">

          <div className="rounded-lg border p-4 space-y-4">
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
          </div>

          <div className="rounded-lg border p-4 space-y-4">
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
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <FieldLabel>Custom instructions</FieldLabel>
              <FieldDescription>Add per-variation instructions</FieldDescription>
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
      </div>
    </FieldGroup>
  );
}


