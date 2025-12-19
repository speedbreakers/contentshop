"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import {
  BatchGenerationSettingsForm,
  type BatchGenerationAspectRatio,
  type BatchGenerationOutputFormat,
  type BatchGenerationPurpose,
  type MoodboardOption,
} from "@/components/batches/batch-generation-settings-form";
import { FieldDescription, Field, FieldLabel } from "@/components/ui/field";

type ProductListItem = {
  id: number;
  title: string;
  category: string;
  variantsCount?: number;
};

type VariantListItem = {
  id: number;
  productId: number;
  productTitle?: string;
  title: string;
  sku?: string | null;
  imageUrl?: string | null;
};

type ImageCandidatesResponse = {
  variants: Array<{
    variantId: number;
    productId: number;
    variantTitle: string;
    variantImageUrl: string | null;
    generatedImages: Array<{ id: number; url: string; createdAt: string }>;
  }>;
  uploads: Array<{ id: number; url: string; originalName?: string | null; createdAt: string }>;
};

type WizardStep = "variants" | "images" | "settings" | "review";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function clampMax<T>(arr: T[], max: number) {
  return arr.length > max ? arr.slice(0, max) : arr;
}

function ImageTile(props: {
  url: string;
  selected: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="relative rounded-md border overflow-hidden bg-muted hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={props.label ?? ""}
    >
      <div className="aspect-square relative w-full">
        <Image src={props.url} alt="" fill sizes="120px" className="object-cover" />
      </div>
      <div className="absolute left-2 top-2">
        <div
          className={[
            "h-5 w-5 rounded-full border bg-background/80 flex items-center justify-center",
            props.selected ? "border-primary" : "border-muted-foreground/30",
          ].join(" ")}
        >
          {props.selected ? <div className="h-3 w-3 rounded-full bg-primary" /> : null}
        </div>
      </div>
    </button>
  );
}

export default function NewBatchPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<WizardStep>("variants");
  const [variantQuery, setVariantQuery] = React.useState("");
  const [batchName, setBatchName] = React.useState(() => {
    const d = new Date();
    return `Batch ${d.toLocaleDateString()}`;
  });

  const variantsQueryKey = React.useMemo(() => {
    const q = variantQuery.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "1000");
    return `/api/variants?${params.toString()}`;
  }, [variantQuery]);
  const { data: variantsData, isLoading: variantsLoading } = useSWR<{ items: VariantListItem[] }>(
    step === "variants" ? variantsQueryKey : null
  );
  const allVariants = Array.isArray(variantsData?.items) ? variantsData!.items : [];

  const [selectedVariants, setSelectedVariants] = React.useState<Map<number, VariantListItem>>(
    () => new Map()
  );
  const [lastClickedIndex, setLastClickedIndex] = React.useState<number | null>(null);
  const [variantSelectError, setVariantSelectError] = React.useState<string | null>(null);

  function applySelection(nextSelectedIds: Set<number>) {
    setSelectedVariants((prev) => {
      const next = new Map<number, VariantListItem>();
      for (const v of allVariants) {
        if (nextSelectedIds.has(v.id)) next.set(v.id, v);
      }
      // Preserve any selected variants that might not be in current list (rare, but keep safe)
      for (const [id, v] of prev.entries()) {
        if (nextSelectedIds.has(id) && !next.has(id)) next.set(id, v);
      }
      return next;
    });
  }

  const selectedVariantIds = React.useMemo(
    () => Array.from(selectedVariants.keys()),
    [selectedVariants]
  );

  // Step 2: candidates + per-variant selected image urls (1..4)
  const [candidates, setCandidates] = React.useState<ImageCandidatesResponse | null>(null);
  const [selectedImageUrlsByVariantId, setSelectedImageUrlsByVariantId] = React.useState<
    Record<number, string[]>
  >({});
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [candidatesError, setCandidatesError] = React.useState<string | null>(null);

  async function loadCandidates() {
    setLoadingCandidates(true);
    setCandidatesError(null);
    try {
      const res = await fetch("/api/batches/image-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIds: selectedVariantIds }),
      });
      const data = (await res.json().catch(() => null)) as ImageCandidatesResponse | null;
      if (!res.ok) throw new Error((data as any)?.error ?? "Failed to load image candidates");
      if (!data) throw new Error("Failed to load image candidates");
      setCandidates(data);

      // Initialize defaults: [variant.imageUrl] if present, else empty.
      setSelectedImageUrlsByVariantId((prev) => {
        const next: Record<number, string[]> = { ...prev };
        for (const v of data.variants) {
          if (Array.isArray(next[v.variantId]) && next[v.variantId].length > 0) continue;
          const initial = v.variantImageUrl ? [v.variantImageUrl] : [];
          next[v.variantId] = initial;
        }
        return next;
      });
    } catch (e: any) {
      setCandidatesError(e?.message ? String(e.message) : "Failed to load image candidates");
    } finally {
      setLoadingCandidates(false);
    }
  }

  // Image-picker dialog per variant
  const [imagePickerVariantId, setImagePickerVariantId] = React.useState<number | null>(null);
  const [imagePickerTab, setImagePickerTab] = React.useState<
    "variant" | "generated" | "uploads" | "upload_new"
  >("variant");
  const [uploading, setUploading] = React.useState(false);
  const [purpose, setPurpose] = React.useState<BatchGenerationPurpose>("catalog");
  const [aspectRatio, setAspectRatio] = React.useState<BatchGenerationAspectRatio>("1:1");
  const [outputFormat, setOutputFormat] = React.useState<BatchGenerationOutputFormat>("png");
  const [numberOfVariations, setNumberOfVariations] = React.useState(1);
  const [moodboardId, setMoodboardId] = React.useState<number | null>(null);
  const [moodboardStrength, setMoodboardStrength] = React.useState<"strict" | "inspired">(
    "inspired"
  );
  const [modelEnabled, setModelEnabled] = React.useState(true);
  const [modelImageUrl, setModelImageUrl] = React.useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = React.useState("");
  const [customInstructions, setCustomInstructions] = React.useState<string[]>([""]);

  const { data: moodboardsData } = useSWR<{ items: MoodboardOption[] }>(
    step === "settings" ? "/api/moodboards" : null
  );
  const moodboards = React.useMemo(() => {
    const list = Array.isArray(moodboardsData?.items) ? moodboardsData!.items : [];
    return list.map((m: any) => ({ id: Number(m.id), name: String(m.name ?? "") })).filter((m) => m.id);
  }, [moodboardsData]);

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [createdBatchId, setCreatedBatchId] = React.useState<number | null>(null);

  const pickerVariant = React.useMemo(() => {
    if (!candidates || !imagePickerVariantId) return null;
    return candidates.variants.find((v) => v.variantId === imagePickerVariantId) ?? null;
  }, [candidates, imagePickerVariantId]);

  const currentSelectedForPicker = React.useMemo(() => {
    if (!imagePickerVariantId) return [];
    return selectedImageUrlsByVariantId[imagePickerVariantId] ?? [];
  }, [imagePickerVariantId, selectedImageUrlsByVariantId]);

  function togglePickerUrl(url: string) {
    if (!imagePickerVariantId) return;
    setSelectedImageUrlsByVariantId((prev) => {
      const existing = prev[imagePickerVariantId] ?? [];
      const has = existing.includes(url);
      const nextForVariant = has ? existing.filter((u) => u !== url) : clampMax([...existing, url], 4);
      return { ...prev, [imagePickerVariantId]: uniq(nextForVariant) };
    });
  }

  async function uploadNew(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", "product");
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      const url = data?.file?.url;
      if (typeof url !== "string" || url.length === 0) throw new Error("Upload failed");
      // Add to local uploads list (top) and auto-select for current variant if possible
      setCandidates((prev) => {
        if (!prev) return prev;
        const nextUploads = [{ id: data.file.id, url, originalName: data.file.originalName, createdAt: data.file.createdAt }, ...prev.uploads];
        return { ...prev, uploads: nextUploads };
      });
      togglePickerUrl(url);
      setImagePickerTab("uploads");
    } finally {
      setUploading(false);
    }
  }

  const canContinueToImages = selectedVariantIds.length > 0 && selectedVariantIds.length <= 100;
  const canContinueToSettings = React.useMemo(() => {
    if (!candidates) return false;
    for (const v of candidates.variants) {
      const urls = selectedImageUrlsByVariantId[v.variantId] ?? [];
      if (urls.length < 1 || urls.length > 4) return false;
    }
    return true;
  }, [candidates, selectedImageUrlsByVariantId]);

  // Render
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">New batch</div>
          <div className="text-sm text-muted-foreground">
            Step {step === "variants" ? "1" : step === "images" ? "2" : step === "settings" ? "3" : "4"} of 4
          </div>
        </div>
      </div>

      {step === "variants" ? (
        <Card className="h-[calc(100dvh-150px)] min-h-0 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Select variants</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <Input
              value={variantQuery}
              onChange={(e) => setVariantQuery(e.target.value)}
              placeholder="Search variants (product name, variant title, SKU)…"
            />
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {selectedVariantIds.length} selected
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Select all visible up to the cap (100)
                const ids = allVariants.slice(0, 100).map((v) => v.id);
                applySelection(new Set(ids));
              }}
              disabled={allVariants.length === 0}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              onClick={() => applySelection(new Set())}
              disabled={selectedVariantIds.length === 0}
            >
              Clear
            </Button>
          </div>

          {variantsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading variants…
            </div>
          ) : allVariants.length === 0 ? (
            <div className="text-sm text-muted-foreground">No products found.</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
              {variantSelectError ? (
                <div className="text-sm text-red-600">{variantSelectError}</div>
              ) : null}
              {allVariants.map((v, idx) => {
                const checked = selectedVariants.has(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="w-full text-left rounded-md border p-2 hover:bg-muted/40"
                    onClick={(e) => {
                      const isCtrl = e.metaKey || e.ctrlKey;
                      const isShift = e.shiftKey;

                      // Current selected set
                      const current = new Set(selectedVariantIds);
                      setVariantSelectError(null);

                      if (isShift && lastClickedIndex !== null) {
                        const a = Math.min(lastClickedIndex, idx);
                        const b = Math.max(lastClickedIndex, idx);
                        const rangeIds = allVariants.slice(a, b + 1).map((x) => x.id);

                        // If ctrl/cmd is also held, add range to current; else replace with range
                        const next = isCtrl ? new Set([...current, ...rangeIds]) : new Set(rangeIds);
                        if (next.size > 100) {
                          setVariantSelectError("You can select up to 100 variants per batch.");
                          return;
                        }
                        applySelection(next);
                      } else if (isCtrl) {
                        if (current.has(v.id)) current.delete(v.id);
                        else {
                          if (current.size >= 100) {
                            setVariantSelectError("You can select up to 100 variants per batch.");
                            return;
                          }
                          current.add(v.id);
                        }
                        applySelection(current);
                      } else {
                        // Plain click: toggle while preserving existing selection
                        if (current.has(v.id)) {
                          current.delete(v.id);
                          applySelection(current);
                        } else {
                          if (current.size >= 100) {
                            setVariantSelectError("You can select up to 100 variants per batch.");
                            return;
                          }
                          current.add(v.id);
                          applySelection(current);
                        }
                      }

                      setLastClickedIndex(idx);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* <Checkbox checked={checked} /> */}
                        <input type="checkbox" checked={checked} readOnly className="w-4 h-4" />
                        <div className="relative h-10 w-10 rounded-md border overflow-hidden bg-muted shrink-0">
                          {v.imageUrl ? (
                            <Image src={v.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {v.productTitle ? `${v.productTitle} — ` : ""}
                            {v.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {v.sku ? `SKU: ${v.sku}` : "—"} · Variant #{v.id}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {checked ? "Selected" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              onClick={async () => {
                setStep("images");
                await loadCandidates();
              }}
              disabled={!canContinueToImages}
            >
              Continue to image selection
            </Button>
          </div>
          </CardContent>
        </Card>
      ) : step === "images" ? (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Select images per variant</div>
              <div className="text-sm text-muted-foreground">
                Choose 1–4 images per variant. Sources: variant image, generated images, uploads, or upload new.
              </div>
            </div>
            <Button variant="outline" onClick={() => setStep("variants")}>
              Back
            </Button>
          </div>

          {loadingCandidates ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading candidates…
            </div>
          ) : candidatesError ? (
            <div className="text-sm text-red-600">{candidatesError}</div>
          ) : !candidates ? (
            <div className="text-sm text-muted-foreground">No candidates loaded.</div>
          ) : (
            <div className="space-y-3">
              {candidates.variants.map((v) => {
                const selectedUrls = selectedImageUrlsByVariantId[v.variantId] ?? [];
                const selectedOk = selectedUrls.length >= 1 && selectedUrls.length <= 4;
                return (
                  <div key={v.variantId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{v.variantTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedUrls.length} selected {selectedOk ? "" : "· select 1–4"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImagePickerVariantId(v.variantId);
                          setImagePickerTab("variant");
                        }}
                      >
                        Choose images
                      </Button>
                    </div>

                    {selectedUrls.length > 0 ? (
                      <div className="mt-3 grid grid-cols-6 gap-2">
                        {selectedUrls.slice(0, 4).map((url) => (
                          <div
                            key={url}
                            className="relative rounded-md border overflow-hidden bg-muted"
                            title="Selected"
                          >
                            <div className="aspect-square relative">
                              <Image src={url} alt="" fill sizes="90px" className="object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-muted-foreground">
                        No images selected yet. Click “Choose images”.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Dialog
            open={imagePickerVariantId !== null}
            onOpenChange={(open) => {
              if (!open) setImagePickerVariantId(null);
            }}
          >
            <DialogContent className="max-w-5xl max-h-[80dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Choose images (max 4){pickerVariant ? ` — ${pickerVariant.variantTitle}` : ""}
                </DialogTitle>
              </DialogHeader>

              <Tabs value={imagePickerTab} onValueChange={(v) => setImagePickerTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="variant">Variant</TabsTrigger>
                  <TabsTrigger value="generated">Generated</TabsTrigger>
                  <TabsTrigger value="uploads">Uploads</TabsTrigger>
                  <TabsTrigger value="upload_new">Upload new</TabsTrigger>
                </TabsList>

                <div className="mt-3 text-sm text-muted-foreground">
                  Selected: {currentSelectedForPicker.length}/4
                </div>

                <TabsContent value="variant" className="mt-4">
                  {!pickerVariant?.variantImageUrl ? (
                    <div className="text-sm text-muted-foreground">This variant has no imageUrl.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      <ImageTile
                        url={pickerVariant.variantImageUrl}
                        selected={currentSelectedForPicker.includes(pickerVariant.variantImageUrl)}
                        onToggle={() => togglePickerUrl(pickerVariant.variantImageUrl!)}
                        label="Variant image"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="generated" className="mt-4">
                  {pickerVariant && pickerVariant.generatedImages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No generated images yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {(pickerVariant?.generatedImages ?? []).map((img) => (
                        <ImageTile
                          key={img.id}
                          url={img.url}
                          selected={currentSelectedForPicker.includes(img.url)}
                          onToggle={() => togglePickerUrl(img.url)}
                          label={new Date(img.createdAt).toLocaleString()}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="uploads" className="mt-4">
                  {candidates && candidates.uploads.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No uploads yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {(candidates?.uploads ?? []).map((u) => (
                        <ImageTile
                          key={u.id}
                          url={u.url}
                          selected={currentSelectedForPicker.includes(u.url)}
                          onToggle={() => togglePickerUrl(u.url)}
                          label={u.originalName ?? `Upload ${u.id}`}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="upload_new" className="mt-4">
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Upload an image and it will be available in the Uploads tab and selectable immediately.
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0] ?? null;
                          if (!f) return;
                          void uploadNew(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button type="button" variant="outline" disabled>
                        <UploadIcon className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                    {uploading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void loadCandidates();
              }}
              disabled={loadingCandidates || selectedVariantIds.length === 0}
            >
              Refresh candidates
            </Button>
            <Button
              onClick={() => setStep("settings")}
              disabled={!canContinueToSettings || loadingCandidates || !candidates}
            >
              Continue to generation settings
            </Button>
          </div>
        </Card>
      ) : step === "settings" ? (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Generation settings</div>
              <div className="text-sm text-muted-foreground">
                These settings apply to every selected variant. Images are chosen per variant in Step 2.
              </div>
            </div>
            <Button variant="outline" onClick={() => setStep("images")}>
              Back
            </Button>
          </div>

          <BatchGenerationSettingsForm
            numberOfVariations={numberOfVariations}
            onNumberOfVariationsChange={setNumberOfVariations}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            purpose={purpose}
            onPurposeChange={setPurpose}
            outputFormat={outputFormat}
            onOutputFormatChange={setOutputFormat}
            moodboardId={moodboardId}
            onMoodboardIdChange={setMoodboardId}
            moodboardStrength={moodboardStrength}
            onMoodboardStrengthChange={setMoodboardStrength}
            moodboards={moodboards}
            modelEnabled={modelEnabled}
            onModelEnabledChange={setModelEnabled}
            modelImageUrl={modelImageUrl}
            onModelImageUrlChange={setModelImageUrl}
            backgroundImageUrl={backgroundImageUrl}
            onBackgroundImageUrlChange={setBackgroundImageUrl}
            customInstructions={customInstructions}
            onCustomInstructionsChange={setCustomInstructions}
          />

          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setStep("review")}>Continue to review</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Review & start</div>
              <div className="text-sm text-muted-foreground">
                {selectedVariantIds.length} variants × {Math.max(1, Math.min(10, numberOfVariations))} variations
              </div>
            </div>
            <Button variant="outline" onClick={() => setStep("settings")}>
              Back
            </Button>
          </div>

          <div className="space-y-1">
            <Field>
              <FieldLabel>Batch name</FieldLabel>
              <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} />
              <FieldDescription>Name is required before starting the batch.</FieldDescription>
            </Field>
          </div>

          {submitError ? <div className="text-sm text-red-600">{submitError}</div> : null}
          {createdBatchId ? (
            <div className="text-sm text-muted-foreground">
              Batch created: #{createdBatchId}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={async () => {
                if (!candidates) return;
                setSubmitting(true);
                setSubmitError(null);
                try {
                  if (!batchName.trim()) {
                    throw new Error("Batch name is required.");
                  }
                  const variants = candidates.variants.map((v) => ({
                    variantId: v.variantId,
                    productImageUrls: selectedImageUrlsByVariantId[v.variantId] ?? [],
                  }));
                  const res = await fetch("/api/batches", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: batchName.trim(),
                      variants,
                      settings: {
                        numberOfVariations: Math.max(1, Math.min(10, Math.floor(numberOfVariations || 1))),
                        input: {
                          purpose,
                          moodboard_id: moodboardId,
                          moodboard_strength: moodboardId ? moodboardStrength : undefined,
                          model_image: modelEnabled ? modelImageUrl.trim() : "",
                          background_image: backgroundImageUrl.trim(),
                          output_format: outputFormat,
                          aspect_ratio: aspectRatio,
                          custom_instructions: customInstructions,
                        },
                      },
                    }),
                  });
                  const data = await res.json().catch(() => null);
                  if (!res.ok) throw new Error(data?.error ?? `Failed to start batch (HTTP ${res.status})`);
                  const id = Number(data?.batch?.id);
                  if (Number.isFinite(id)) {
                    setCreatedBatchId(id);
                    // Send user back to the batches list (until we have a batch detail page).
                    router.push(`/dashboard/batches?created=${encodeURIComponent(String(id))}`);
                  }
                } catch (e: any) {
                  setSubmitError(e?.message ? String(e.message) : "Failed to start batch");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || !candidates || !batchName.trim()}
            >
              {submitting ? "Starting…" : "Start batch"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}


