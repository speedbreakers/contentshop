'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fakeProducts } from '@/lib/fake/products';
import { getMockVariantAssets } from '@/lib/fake/variant-assets';
import type { FakeVariantAsset, FakeVariantGeneration } from '@/lib/fake/variant-assets';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function placeholderUrl(label: string, seed: number, size = 640) {
  const safe = encodeURIComponent(label);
  return `https://placehold.co/${size}x${size}/png?text=${safe}&seed=${seed}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function VariantAssetsPage() {
  const params = useParams<{ productId: string; variantId: string }>();
  const router = useRouter();
  const productId = Number(params.productId);
  const variantId = Number(params.variantId);

  const product = useMemo(() => fakeProducts.find((p) => p.id === productId) ?? null, [productId]);
  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? null,
    [product, variantId]
  );

  const seed = useMemo(() => getMockVariantAssets(variantId), [variantId]);

  const [assets, setAssets] = useState<FakeVariantAsset[]>(() => structuredClone(seed.assets));
  const [generations, setGenerations] = useState<FakeVariantGeneration[]>(() =>
    structuredClone(seed.generations)
  );

  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const lightboxAsset = lightboxId ? assets.find((a) => a.id === lightboxId) ?? null : null;
  const deleteAsset = deleteId ? assets.find((a) => a.id === deleteId) ?? null : null;

  const selectedCount = assets.filter((a) => a.isSelected).length;
  const hasShopifyLink = !!product?.shopifyProductGid;

  const currentAssets = assets
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const previewAssets = currentAssets.slice(0, 3);
  const hasMoreThanThree = currentAssets.length > 3;

  function optionSummary() {
    if (!product || !variant) return '—';
    if (!variant.optionValues.length) return '—';
    const optById = new Map(product.options.map((o) => [o.id, o.name]));
    return variant.optionValues
      .map((x) => `${optById.get(x.productOptionId) ?? 'Option'}=${x.value}`)
      .join(', ');
  }

  function toggleSelected(assetId: number) {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, isSelected: !a.isSelected } : a))
    );
  }

  function mockFetchLatest() {
    if (!hasShopifyLink) {
      setFetchMessage('Link a Shopify product to fetch latest assets.');
      return;
    }
    setFetchMessage('Fetching latest assets from Shopify…');
    setTimeout(() => {
      const now = new Date().toISOString();
      const id1 = Math.floor(Date.now() / 1000);
      const id2 = id1 + 1;
      setAssets((prev) => [
        {
          id: id1,
          variantId,
          createdAt: now,
          kind: 'generated',
          status: 'ready',
          source: 'shopify',
          url: placeholderUrl('Shopify latest', id1, 640),
          isSelected: false,
        },
        {
          id: id2,
          variantId,
          createdAt: now,
          kind: 'generated',
          status: 'ready',
          source: 'shopify',
          url: placeholderUrl('Shopify latest 2', id2, 640),
          isSelected: false,
        },
        ...prev,
      ]);
      setFetchMessage(`Fetched latest from Shopify (mock) at ${new Date().toLocaleString()}`);
    }, 650);
  }

  function mockGenerateNewAssets(label = 'generated-image') {
    setIsGenerating(true);
    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();
    const draft: FakeVariantGeneration = {
      id,
      variantId,
      createdAt: now,
      label,
      status: 'running',
    };
    setGenerations((prev) => [draft, ...prev]);

    setTimeout(() => {
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: 'ready' } : g))
      );
      setIsGenerating(false);
    }, 900);
  }

  function openLightbox(assetId: number) {
    setEditInstructions('');
    setLightboxId(assetId);
  }

  function mockGenerateFromEdit() {
    if (!lightboxAsset) return;
    setIsGenerating(true);
    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();
    const label = editInstructions.trim()
      ? 'edited-variation'
      : 'variation';

    const draft: FakeVariantGeneration = {
      id,
      variantId,
      createdAt: now,
      label,
      status: 'running',
    };
    setGenerations((prev) => [draft, ...prev]);

    setTimeout(() => {
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: 'ready' } : g))
      );
      setIsGenerating(false);
      setLightboxId(null);
    }, 900);
  }

  function mockSyncSelected() {
    if (!hasShopifyLink) {
      setSyncMessage('Link a Shopify product to sync.');
      return;
    }
    if (selectedCount === 0) {
      setSyncMessage('Select at least one asset to sync.');
      return;
    }
    setSyncMessage('Syncing selected assets to Shopify…');
    setTimeout(() => {
      setSyncMessage(`Synced ${selectedCount} asset(s) to Shopify (mock).`);
    }, 650);
  }

  function removeAsset(assetId: number) {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setDeleteId(null);
    setLightboxId((prev) => (prev === assetId ? null : prev));
  }

  if (!product || !variant) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-muted-foreground">Variant not found.</div>
        <Button className="mt-4" variant="outline" onClick={() => router.push(`/dashboard/products/${productId}`)}>
          Back
        </Button>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-2">
          <Link href={`/dashboard/products/${product.id}`} className="hover:underline">
            Products / {product.title}
          </Link>{' '}
          / Variant
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg lg:text-2xl font-medium">Variant</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{variant.title}</span>
              {variant.sku ? <span> · SKU: {variant.sku}</span> : null}
              <span> · {optionSummary()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={mockFetchLatest} disabled={isGenerating}>
              Fetch latest
            </Button>
            <Button
              variant="outline"
              onClick={mockSyncSelected}
              disabled={isGenerating || selectedCount === 0}
              title={hasShopifyLink ? undefined : 'Link Shopify to sync'}
            >
              Sync
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => setGenerateOpen(true)}
              disabled={isGenerating}
            >
              Generate
            </Button>
          </div>
        </div>

        {fetchMessage ? <p className="text-xs text-muted-foreground mt-2">{fetchMessage}</p> : null}
        {syncMessage ? <p className="text-xs text-muted-foreground mt-1">{syncMessage}</p> : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Current assets</CardTitle>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">{selectedCount} selected</p>
              {hasMoreThanThree ? (
                <Button variant="outline" onClick={() => setViewAllOpen(true)}>
                  View all
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {previewAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assets yet. Generate your first set.
              </p>
            ) : (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {previewAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openLightbox(a.id)}
                    className="relative h-16 w-16 shrink-0 rounded-md border overflow-hidden"
                    title="Click to open"
                  >
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                    {a.isSelected ? (
                      <span className="absolute top-1 right-1 text-[9px] rounded-full bg-black/70 text-white px-1.5 py-0.5">
                        ✓
                      </span>
                    ) : null}
                    <span className="absolute bottom-1 left-1 text-[9px] rounded-full bg-black/70 text-white px-1.5 py-0.5">
                      {a.source}
                    </span>
                  </button>
                ))}

                {hasMoreThanThree ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setViewAllOpen(true)}
                  >
                    View all ({currentAssets.length})
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Generations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                WIP — this will expand into a full history explorer.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No generations yet.</p>
            ) : (
              <div className="space-y-3">
                {generations
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md border bg-muted" />
                        <div>
                          <div className="font-medium">{g.label}</div>
                          <div className="text-xs text-muted-foreground">{g.status}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{formatWhen(g.createdAt)}</div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View all assets dialog */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All assets</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentAssets.map((a) => (
              <div key={a.id} className="relative rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => openLightbox(a.id)}
                  className="block w-full"
                  title="Open"
                >
                  <img src={a.url} alt="" className="h-28 w-full object-cover" />
                </button>
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'ready' ? 'secondary' : 'outline'}>
                      {a.status}
                    </Badge>
                    <Badge variant="outline">{a.source}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={a.isSelected ? 'default' : 'outline'}
                    onClick={() => toggleSelected(a.id)}
                  >
                    {a.isSelected ? 'Selected' : 'Select'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAllOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate new assets</DialogTitle>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="gen-notes">Notes (optional)</FieldLabel>
              <Textarea
                id="gen-notes"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="e.g., brighter background, more premium lighting, centered framing"
                className="min-h-[120px] resize-none"
              />
              <FieldDescription>
                Mock generator for now — later this will call Vertex AI.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                mockGenerateNewAssets('generated-image');
                setGenerateOpen(false);
              }}
              disabled={isGenerating}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox + edit instructions */}
      <Dialog
        open={lightboxId !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Asset</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border overflow-hidden">
              {lightboxAsset ? (
                <img src={lightboxAsset.url} alt="" className="w-full h-full object-cover" />
              ) : null}
              <div className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lightboxAsset ? (
                    <>
                      <Badge variant={lightboxAsset.status === 'ready' ? 'secondary' : 'outline'}>
                        {lightboxAsset.status}
                      </Badge>
                      <Badge variant="outline">{lightboxAsset.source}</Badge>
                    </>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={lightboxAsset?.isSelected ? 'default' : 'outline'}
                    onClick={() => {
                      if (!lightboxAsset) return;
                      toggleSelected(lightboxAsset.id);
                    }}
                    disabled={!lightboxAsset}
                  >
                    {lightboxAsset?.isSelected ? 'Selected' : 'Select'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!lightboxAsset) return;
                      await copyToClipboard(lightboxAsset.url);
                    }}
                    disabled={!lightboxAsset}
                  >
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (!lightboxAsset) return;
                      setDeleteId(lightboxAsset.id);
                    }}
                    disabled={!lightboxAsset}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-instructions">Edit instructions</FieldLabel>
                  <Textarea
                    id="edit-instructions"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="e.g., remove background clutter, brighter lighting, add studio shadow"
                    className="min-h-[140px] resize-none"
                  />
                  <FieldDescription>
                    Submitting will generate a new variation (mock) based on this asset.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setLightboxId(null)} disabled={isGenerating}>
                  Close
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={mockGenerateFromEdit}
                  disabled={isGenerating}
                >
                  Generate variation
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteAsset ? 'This will remove the selected asset from the variant.' : 'This will remove the asset.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) removeAsset(deleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}


