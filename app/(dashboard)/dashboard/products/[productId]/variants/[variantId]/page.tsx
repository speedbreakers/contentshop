'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { FakeVariantAsset } from '@/lib/fake/variant-assets';
import { getMockSets, type FakeSet } from '@/lib/fake/sets';
import { getMockSetItems, type FakeSetItem } from '@/lib/fake/set-items';

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

function safeFilename(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'download';
}

async function downloadFromUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    // Fallback: open the URL (download attribute may be ignored cross-origin).
    window.open(url, '_blank', 'noopener,noreferrer');
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
  const [sets, setSets] = useState<FakeSet[]>(() => getMockSets(variantId));
  const [activeFolderId, setActiveFolderId] = useState<number | null>(() => {
    const seeded = getMockSets(variantId);
    return seeded.find((s) => s.isDefault)?.id ?? seeded[0]?.id ?? null;
  });
  const [itemsBySetId, setItemsBySetId] = useState<Record<number, FakeSetItem[]>>(() => {
    const seeded = getMockSets(variantId);
    const map: Record<number, FakeSetItem[]> = {};
    for (const s of seeded) {
      map[s.id] = getMockSetItems(s.id);
    }
    return map;
  });

  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ kind: 'asset' | 'setItem'; id: number; setId?: number } | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [renameSetId, setRenameSetId] = useState<number | null>(null);
  const [renameSetName, setRenameSetName] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [searchFolders, setSearchFolders] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<{ kind: 'asset' | 'set' | 'setItem'; id: number; setId?: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [details, setDetails] = useState<{ setId: number; itemId: number } | null>(null);

  const lightboxAsset =
    lightbox?.kind === 'asset' ? assets.find((a) => a.id === lightbox.id) ?? null : null;
  const lightboxSetItem =
    lightbox?.kind === 'setItem'
      ? (itemsBySetId[lightbox.setId ?? -1] ?? []).find((i) => i.id === lightbox.id) ?? null
      : null;

  const deleteAsset =
    deleteId?.kind === 'asset' ? assets.find((a) => a.id === deleteId.id) ?? null : null;
  const deleteSet =
    deleteId?.kind === 'set' ? sets.find((s) => s.id === deleteId.id) ?? null : null;
  const deleteSetItem =
    deleteId?.kind === 'setItem'
      ? (itemsBySetId[deleteId.setId ?? -1] ?? []).find((i) => i.id === deleteId.id) ?? null
      : null;
  const detailsItem = details
    ? (itemsBySetId[details.setId] ?? []).find((i) => i.id === details.itemId) ?? null
    : null;
  const detailsFolder = details?.setId
    ? sets.find((s) => s.id === details.setId) ?? null
    : null;

  const selectedCount = assets.filter((a) => a.isSelected).length;
  const hasShopifyLink = !!product?.shopifyProductGid;
  const defaultSetId = useMemo(() => sets.find((s) => s.isDefault)?.id ?? null, [sets]);
  const selectedGenerationCount = useMemo(
    () => Object.values(itemsBySetId).flat().filter((i) => i.isSelected).length,
    [itemsBySetId]
  );
  const selectedGenerationCountBySetId = useMemo(() => {
    const out: Record<number, number> = {};
    for (const [setIdStr, items] of Object.entries(itemsBySetId)) {
      const setId = Number(setIdStr);
      out[setId] = (items ?? []).filter((i) => i.isSelected).length;
    }
    return out;
  }, [itemsBySetId]);
  const selectedGenerationCountInActiveFolder = useMemo(() => {
    if (!activeFolderId) return 0;
    return selectedGenerationCountBySetId[activeFolderId] ?? 0;
  }, [activeFolderId, selectedGenerationCountBySetId]);

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

  function toggleSetItemSelected(setId: number, itemId: number) {
    setItemsBySetId((prev) => ({
      ...prev,
      [setId]: (prev[setId] ?? []).map((i) =>
        i.id === itemId ? { ...i, isSelected: !i.isSelected } : i
      ),
    }));
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
    if (!defaultSetId) {
      setSyncMessage('Default folder is missing (unexpected).');
      return;
    }
    setIsGenerating(true);
    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();
    const draft: FakeSetItem = {
      id,
      setId: defaultSetId,
      createdAt: now,
      label,
      status: 'generating',
      url: placeholderUrl('Generating…', id, 640),
      prompt: editInstructions.trim() || 'Generate a clean, high-quality product image.',
      isSelected: false,
    };

    setItemsBySetId((prev) => ({
      ...prev,
      [defaultSetId]: [draft, ...(prev[defaultSetId] ?? [])],
    }));

    setTimeout(() => {
      setItemsBySetId((prev) => ({
        ...prev,
        [defaultSetId]: (prev[defaultSetId] ?? []).map((i) =>
          i.id === id
            ? { ...i, status: 'ready', url: placeholderUrl(label, id, 640) }
            : i
        ),
      }));
      setIsGenerating(false);
    }, 900);
  }

  function openLightbox(assetId: number) {
    setEditInstructions('');
    setLightbox({ kind: 'asset', id: assetId });
  }

  function mockGenerateFromEdit() {
    // This should create a new generated item under the default folder (not current assets).
    if (!defaultSetId) {
      setSyncMessage('Default folder is missing (unexpected).');
      return;
    }
    const base = lightboxSetItem ?? lightboxAsset;
    if (!base) return;
    setIsGenerating(true);
    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();
    const label = editInstructions.trim()
      ? 'edited-variation'
      : 'variation';
    const draft: FakeSetItem = {
      id,
      setId: defaultSetId,
      createdAt: now,
      label,
      status: 'generating',
      url: placeholderUrl('Generating…', id, 640),
      prompt: editInstructions.trim() || 'Generate a variation based on the selected image.',
      isSelected: false,
    };

    setItemsBySetId((prev) => ({
      ...prev,
      [defaultSetId]: [draft, ...(prev[defaultSetId] ?? [])],
    }));

    setTimeout(() => {
      setItemsBySetId((prev) => ({
        ...prev,
        [defaultSetId]: (prev[defaultSetId] ?? []).map((i) =>
          i.id === id
            ? { ...i, status: 'ready', url: placeholderUrl(label, id, 640) }
            : i
        ),
      }));
      setIsGenerating(false);
      setLightbox(null);
    }, 900);
  }

  function mockSyncFolder(setId: number) {
    if (!hasShopifyLink) {
      setSyncMessage('Link a Shopify product to sync.');
      return;
    }
    const count = selectedGenerationCountBySetId[setId] ?? 0;
    if (count === 0) {
      setSyncMessage('Select at least one item in this folder to sync.');
      return;
    }
    setSyncMessage('Syncing selected folder items to Shopify…');
    setTimeout(() => {
      setSyncMessage(`Synced ${count} item(s) from the folder to Shopify (mock).`);
    }, 650);
  }

  function removeAsset(assetId: number) {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setDeleteId(null);
    setLightbox((prev) =>
      prev?.kind === 'asset' && prev.id === assetId ? null : prev
    );
  }

  function removeSetItem(setId: number, itemId: number) {
    setItemsBySetId((prev) => ({
      ...prev,
      [setId]: (prev[setId] ?? []).filter((i) => i.id !== itemId),
    }));
    setDeleteId(null);
    setLightbox((prev) =>
      prev?.kind === 'setItem' && prev.id === itemId ? null : prev
    );
  }

  function createSet(name: string) {
    const now = new Date().toISOString();
    const id = Math.floor(Date.now() / 1000);
    const s: FakeSet = {
      id,
      variantId,
      isDefault: false,
      name,
      description: null,
      createdAt: now,
      updatedAt: now,
    };
    setSets((prev) => [s, ...prev]);
    setItemsBySetId((prev) => ({ ...prev, [id]: [] }));
    setActiveFolderId(id);
  }

  function renameSet(setId: number, name: string) {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, name, updatedAt: new Date().toISOString() } : s))
    );
  }

  function deleteSetById(setId: number) {
    if (sets.find((s) => s.id === setId)?.isDefault) {
      setSyncMessage('Cannot delete the default folder.');
      setDeleteId(null);
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== setId));
    setItemsBySetId((prev) => {
      const copy = { ...prev };
      delete copy[setId];
      return copy;
    });
    setActiveFolderId((prev) => {
      if (prev !== setId) return prev;
      return defaultSetId ?? sets.find((s) => s.id !== setId)?.id ?? null;
    });
    setDeleteId(null);
  }

  function moveSelectedItemsFromFolder(sourceSetId: number, targetSetId: number) {
    setItemsBySetId((prev) => {
      const next: Record<number, FakeSetItem[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[Number(k)] = [...v];
      }

      const moved: FakeSetItem[] = [];
      const remaining: FakeSetItem[] = [];
      for (const item of next[sourceSetId] ?? []) {
        if (item.isSelected) moved.push({ ...item, setId: targetSetId, isSelected: false });
        else remaining.push(item);
      }
      next[sourceSetId] = remaining;

      next[targetSetId] = [...moved, ...(next[targetSetId] ?? [])];
      return next;
    });
    setMoveOpen(false);
  }

  async function downloadImage(item: FakeSetItem) {
    const folder = sets.find((s) => s.id === item.setId)?.name ?? 'folder';
    const file = `${safeFilename(folder)}-${safeFilename(item.label)}-${item.id}.png`;
    await downloadFromUrl(item.url, file);
  }

  async function downloadFolder(folderId: number) {
    const folderName = sets.find((s) => s.id === folderId)?.name ?? 'folder';
    const items = (itemsBySetId[folderId] ?? [])
      .filter((i) => i.status === 'ready')
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (items.length === 0) {
      setSyncMessage('No ready images in this folder to download.');
      return;
    }

    setSyncMessage(`Downloading ${items.length} image(s)…`);
    for (const item of items) {
      const file = `${safeFilename(folderName)}-${safeFilename(item.label)}-${item.id}.png`;
      await downloadFromUrl(item.url, file);
    }
    setSyncMessage(`Download started for ${items.length} image(s).`);
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
              <Button variant="outline" onClick={mockFetchLatest} disabled={isGenerating}>
              Fetch latest
              </Button>
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
                    No assets yet. Generate your first folder.
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
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Generations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Folders help you organize generations. The default folder is always present, and new generations land there by default.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedGenerationCount} selected
              </p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setNewSetOpen(true)}>
                New folder
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMoveOpen(true)}
                disabled={!activeFolderId || selectedGenerationCountInActiveFolder === 0}
              >
                Move
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left pane: folders */}
              <div className="lg:col-span-4 rounded-md border p-3 space-y-3">
                <Input
                  value={searchFolders}
                  onChange={(e) => setSearchFolders(e.target.value)}
                  placeholder="Search folders…"
                />

                <div className="space-y-2">
                  {sets
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(b.isDefault) - Number(a.isDefault) ||
                        b.updatedAt.localeCompare(a.updatedAt)
                    )
                    .filter((s) =>
                      s.name.toLowerCase().includes(searchFolders.trim().toLowerCase())
                    )
                    .map((s) => {
                      const isActive = activeFolderId === s.id;
                      const selectedInFolder = selectedGenerationCountBySetId[s.id] ?? 0;
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                            isActive ? 'bg-muted' : 'hover:bg-muted/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveFolderId(s.id)}
                            className="min-w-0 text-left flex-1"
                            title="Open folder"
                          >
                            <div className="font-medium truncate">
                              {s.name}
                              {s.isDefault ? ' (Default)' : ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {itemsBySetId[s.id]?.length ?? 0} item(s)
                              {selectedInFolder > 0 ? ` · ${selectedInFolder} selected` : ''}
                            </div>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 px-2">
                                ⋯
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => downloadFolder(s.id)}
                                disabled={(itemsBySetId[s.id] ?? []).every((i) => i.status !== 'ready')}
                              >
                                Download folder
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => mockSyncFolder(s.id)}
                                disabled={
                                  isGenerating ||
                                  !hasShopifyLink ||
                                  (selectedGenerationCountBySetId[s.id] ?? 0) === 0
                                }
                              >
                                Sync folder
                              </DropdownMenuItem>

                              {!s.isDefault ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setRenameSetId(s.id);
                                      setRenameSetName(s.name);
                                    }}
                                  >
                                    Rename folder
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setDeleteId({ kind: 'set', id: s.id })}
                                  >
                                    Delete folder
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}

                  {sets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No folders yet.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right pane: active folder contents */}
              <div className="lg:col-span-8 rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {activeFolderId ? sets.find((s) => s.id === activeFolderId)?.name ?? 'Folder' : 'Folder'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeFolderId ? `${selectedGenerationCountInActiveFolder} selected in this folder` : 'Select a folder to view items'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!activeFolderId) return;
                        mockSyncFolder(activeFolderId);
                      }}
                      disabled={!activeFolderId || isGenerating || !hasShopifyLink || selectedGenerationCountInActiveFolder === 0}
                      title={hasShopifyLink ? undefined : 'Link Shopify to sync'}
                    >
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!activeFolderId) return;
                        downloadFolder(activeFolderId);
                      }}
                      disabled={!activeFolderId}
                    >
                      Download folder
                    </Button>
                  </div>
                </div>

                <Input
                  value={searchItems}
                  onChange={(e) => setSearchItems(e.target.value)}
                  placeholder="Search items in this folder…"
                  disabled={!activeFolderId}
                />

                {!activeFolderId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a folder on the left to view its items.
                  </p>
                ) : (itemsBySetId[activeFolderId] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items in this folder yet.
                    {activeFolderId === defaultSetId ? ' Click Generate to create new outputs (they will land in Default).' : ' Use Move to organize items here.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(itemsBySetId[activeFolderId] ?? [])
                      .filter((i) => i.label.toLowerCase().includes(searchItems.trim().toLowerCase()))
                      .slice()
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditInstructions('');
                              setLightbox({ kind: 'setItem', id: i.id, setId: i.setId });
                            }}
                            className="flex items-center gap-3 min-w-0 text-left"
                            title="Open"
                          >
                            <img src={i.url} alt="" className="h-10 w-10 rounded-md object-cover border" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{i.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatWhen(i.createdAt)} · {i.status}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={i.isSelected ? 'default' : 'outline'}
                              onClick={() => toggleSetItemSelected(i.setId, i.id)}
                            >
                              {i.isSelected ? '✓' : 'Select'}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 px-2">
                                  ⋯
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDetails({ setId: i.setId, itemId: i.id });
                                  }}
                                >
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => downloadImage(i)}
                                  disabled={i.status !== 'ready'}
                                >
                                  Download image
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() =>
                                    (() => {
                                      setDeleteId({ kind: 'setItem', id: i.id, setId: i.setId });
                                    })()
                                  }
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
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
            <DialogTitle>Generate new outputs (into default folder)</DialogTitle>
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

      {/* View details dialog */}
      <Dialog
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generation details</DialogTitle>
          </DialogHeader>

          {!detailsItem ? (
            <div className="text-sm text-muted-foreground">Item not found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border overflow-hidden">
                <img src={detailsItem.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{detailsItem.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Folder: {detailsFolder?.name ?? '—'}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant={detailsItem.status === 'ready' ? 'secondary' : 'outline'}>
                      {detailsItem.status}
                    </Badge>
                    <Badge variant="outline">{formatWhen(detailsItem.createdAt)}</Badge>
                  </div>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel>Prompt</FieldLabel>
                    <Textarea
                      value={detailsItem.prompt}
                      readOnly
                      className="min-h-[160px] resize-none"
                    />
                    <FieldDescription>
                      This is mock data for now; later this will come from stored generation metadata.
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadImage(detailsItem)}
                    disabled={detailsItem.status !== 'ready'}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await copyToClipboard(detailsItem.prompt);
                    }}
                  >
                    Copy prompt
                  </Button>
                  <Button variant="outline" onClick={() => setDetails(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox + edit instructions */}
      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Asset</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border overflow-hidden">
              {lightboxSetItem ? (
                <img src={lightboxSetItem.url} alt="" className="w-full h-full object-cover" />
              ) : lightboxAsset ? (
                <img src={lightboxAsset.url} alt="" className="w-full h-full object-cover" />
              ) : null}
              <div className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lightboxSetItem ? (
                    <>
                      <Badge variant={lightboxSetItem.status === 'ready' ? 'secondary' : 'outline'}>
                        {lightboxSetItem.status}
                      </Badge>
                      <Badge variant="outline">folder</Badge>
                    </>
                  ) : lightboxAsset ? (
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
                    variant={
                      lightboxSetItem?.isSelected || lightboxAsset?.isSelected
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => {
                      if (lightboxSetItem) {
                        toggleSetItemSelected(lightboxSetItem.setId, lightboxSetItem.id);
                        return;
                      }
                      if (lightboxAsset) {
                        toggleSelected(lightboxAsset.id);
                      }
                    }}
                    disabled={!lightboxSetItem && !lightboxAsset}
                  >
                    {lightboxSetItem?.isSelected || lightboxAsset?.isSelected
                      ? 'Selected'
                      : 'Select'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (lightboxSetItem) {
                        await copyToClipboard(lightboxSetItem.url);
                        return;
                      }
                      if (lightboxAsset) {
                        await copyToClipboard(lightboxAsset.url);
                      }
                    }}
                    disabled={!lightboxSetItem && !lightboxAsset}
                  >
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (lightboxSetItem) {
                        setDeleteId({ kind: 'setItem', id: lightboxSetItem.id, setId: lightboxSetItem.setId });
                        return;
                      }
                      if (lightboxAsset) {
                        setDeleteId({ kind: 'asset', id: lightboxAsset.id });
                      }
                    }}
                    disabled={!lightboxSetItem && !lightboxAsset}
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
                <Button variant="outline" onClick={() => setLightbox(null)} disabled={isGenerating}>
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
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteId?.kind === 'set'
                ? 'Delete folder?'
                : deleteId?.kind === 'setItem'
                  ? 'Remove item?'
                  : 'Delete asset?'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteId?.kind === 'set' && deleteSet
              ? `This will delete the folder “${deleteSet.name}”. Items will not be deleted.`
              : deleteId?.kind === 'setItem' && deleteSetItem
                ? 'This will remove the item from the folder.'
                : deleteAsset
                  ? 'This will remove the selected asset from current assets.'
                  : 'This will remove the item.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                if (deleteId.kind === 'asset') removeAsset(deleteId.id);
                if (deleteId.kind === 'setItem') {
                  const sid = deleteId.setId;
                  if (!sid) return;
                  removeSetItem(sid, deleteId.id);
                }
                if (deleteId.kind === 'set') deleteSetById(deleteId.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move selected dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move selected items</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Choose a destination folder. Moving to <span className="font-medium text-foreground">Default</span> puts items back at the root.
          </div>
          <div className="space-y-2">
            {sets
              .slice()
              .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt))
              .map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    if (!activeFolderId) return;
                    moveSelectedItemsFromFolder(activeFolderId, s.id);
                  }}
                  disabled={!activeFolderId || selectedGenerationCountInActiveFolder === 0 || s.id === activeFolderId}
                >
                  <span className="truncate">{s.name}{s.isDefault ? ' (Default)' : ''}</span>
                  <span className="text-xs text-muted-foreground">{itemsBySetId[s.id]?.length ?? 0}</span>
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New set dialog */}
      <Dialog open={newSetOpen} onOpenChange={setNewSetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-set-name">Name</FieldLabel>
              <Input
                id="new-set-name"
                value={renameSetName}
                onChange={(e) => setRenameSetName(e.target.value)}
                placeholder="e.g. Homepage winners"
              />
              <FieldDescription>Folders help you group and sync the best outputs.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name = renameSetName.trim();
                if (!name) return;
                createSet(name);
                setRenameSetName('');
                setNewSetOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename set dialog */}
      <Dialog
        open={renameSetId !== null}
        onOpenChange={(open) => !open && setRenameSetId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-set-name">Name</FieldLabel>
              <Input
                id="rename-set-name"
                value={renameSetName}
                onChange={(e) => setRenameSetName(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSetId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!renameSetId) return;
                const name = renameSetName.trim();
                if (!name) return;
                renameSet(renameSetId, name);
                setRenameSetId(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


