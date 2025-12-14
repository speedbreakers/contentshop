'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { AssetPickerField } from '@/components/asset-picker';
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
import type { FakeProduct, FakeVariant } from '@/lib/fake/products';
import type { FakeVariantAsset } from '@/lib/fake/variant-assets';
import type { FakeSet } from '@/lib/fake/sets';
import type { FakeSetItem } from '@/lib/fake/set-items';

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

  const [product, setProduct] = useState<FakeProduct | null>(null);
  const [variant, setVariant] = useState<FakeVariant | null>(null);
  const [loading, setLoading] = useState(true);

  const productCategory = product?.category ?? 'apparel';

  const [assets, setAssets] = useState<FakeVariantAsset[]>([]);
  const [sets, setSets] = useState<FakeSet[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [itemsBySetId, setItemsBySetId] = useState<Record<number, FakeSetItem[]>>({});

  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ kind: 'asset' | 'setItem'; id: number; setId?: number } | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [editReferenceImageUrl, setEditReferenceImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [renameSetId, setRenameSetId] = useState<number | null>(null);
  const [renameSetName, setRenameSetName] = useState('');
  const [renameItem, setRenameItem] = useState<{ setId: number; itemId: number } | null>(null);
  const [renameItemName, setRenameItemName] = useState('');
  const [searchItems, setSearchItems] = useState('');
  const [searchFolders, setSearchFolders] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<{ kind: 'asset' | 'set' | 'setItem'; id: number; setId?: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [details, setDetails] = useState<{ setId: number; itemId: number } | null>(null);

  // Category-driven generation form state (mock for now)
  const [genNumberOfVariations, setGenNumberOfVariations] = useState(1);
  const [genOutputFormat, setGenOutputFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [genAspectRatio, setGenAspectRatio] = useState<'1:1' | '4:5' | '3:4' | '16:9'>('1:1');
  const [genCustomInstructions, setGenCustomInstructions] = useState('');
  const [genModelImageUrl, setGenModelImageUrl] = useState('');
  const [genBackgroundImageUrl, setGenBackgroundImageUrl] = useState('');
  const [genValidationError, setGenValidationError] = useState<string | null>(null);
  const [genSubmitError, setGenSubmitError] = useState<string | null>(null);

  // Product images input (array of file URLs)
  const [genProductImages, setGenProductImages] = useState<string[]>(['', '', '', '', '', '', '', '']);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const productRes = await fetch(`/api/products/${productId}`);
        const productJson = await productRes.json().catch(() => null);
        if (!productRes.ok) throw new Error(productJson?.error ?? `Failed to load product (HTTP ${productRes.status})`);
        const p = productJson?.product;
        if (!p) throw new Error('Product not found');

        const mappedProduct: FakeProduct = {
          id: Number(p.id),
          title: String(p.title),
          status: (p.status as any) ?? 'draft',
          category: (p.category as any) ?? 'apparel',
          vendor: p.vendor ?? null,
          productType: p.productType ?? null,
          handle: p.handle ?? null,
          tags: p.tags ?? null,
          shopifyProductGid: p.shopifyProductGid ?? null,
          defaultVariantId: Number(p.defaultVariantId ?? 0),
          options: Array.isArray(p.options) ? p.options : [],
          variants: Array.isArray(p.variants) ? p.variants : [],
          updatedAt: String(p.updatedAt ?? new Date().toISOString()),
        };

        const mappedVariant: FakeVariant | null =
          (mappedProduct.variants as any[]).find((v) => Number(v.id) === variantId) ?? null;
        if (!mappedVariant) throw new Error('Variant not found');

        const setsRes = await fetch(`/api/products/${productId}/variants/${variantId}/sets`);
        const setsJson = await setsRes.json().catch(() => null);
        if (!setsRes.ok) throw new Error(setsJson?.error ?? `Failed to load folders (HTTP ${setsRes.status})`);
        const setsList: FakeSet[] = Array.isArray(setsJson?.items) ? setsJson.items : [];

        const map: Record<number, FakeSetItem[]> = {};
        await Promise.all(
          setsList.map(async (s) => {
            const res = await fetch(`/api/sets/${s.id}/items`);
            const j = await res.json().catch(() => null);
            if (!res.ok) {
              map[s.id] = [];
              return;
            }
            const items = Array.isArray(j?.items) ? j.items : [];
            map[s.id] = items
              .filter((it: any) => it.itemType === 'variant_image' && it.data)
              .map((it: any) => {
                const img = it.data;
                const createdAt = String(img.createdAt ?? it.createdAt ?? new Date().toISOString());
                const outputLabel =
                  img?.input && typeof img.input === 'object' && (img.input as any).output_label
                    ? String((img.input as any).output_label)
                    : null;
                return {
                  id: Number(img.id),
                  setId: Number(it.setId ?? s.id),
                  createdAt,
                  label: outputLabel ?? (img.generationId ? `Gen ${img.generationId}` : `Image ${img.id}`),
                  status: (img.status as any) ?? 'ready',
                  url: String(img.url),
                  prompt: String(img.prompt ?? ''),
                  schemaKey: String(img.schemaKey ?? ''),
                  input: img.input ?? null,
                  isSelected: false,
                } as FakeSetItem;
              });
          })
        );

        if (cancelled) return;
        setProduct(mappedProduct);
        setVariant(mappedVariant);
        setSets(setsList);
        setItemsBySetId(map);
        const defaultId = setsList.find((s) => (s as any).isDefault)?.id ?? setsList[0]?.id ?? null;
        setActiveFolderId(defaultId);
      } catch (e: any) {
        if (cancelled) return;
        setFetchMessage(e?.message ? String(e.message) : 'Failed to load');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, variantId]);

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
  const renameSetItem = renameItem
    ? (itemsBySetId[renameItem.setId] ?? []).find((i) => i.id === renameItem.itemId) ?? null
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

  async function generateNewAssets(label = 'generated-image'): Promise<boolean> {
    if (!defaultSetId) {
      setSyncMessage('Default folder is missing (unexpected).');
      return false;
    }
    const n = Math.max(1, Math.min(10, Math.floor(genNumberOfVariations || 1)));
    const productImages = genProductImages.map((s) => s.trim()).filter(Boolean);

    if (productImages.length === 0) {
      // The modal should show the validation; keep this as a guard.
      setGenValidationError('At least one product image is required.');
      return false;
    }

    const input = {
      product_images: productImages,
      model_image: genModelImageUrl.trim(),
      background_image: genBackgroundImageUrl.trim(),
      number_of_variations: n,
      output_format: genOutputFormat,
      aspect_ratio: genAspectRatio,
      custom_instructions: genCustomInstructions.trim(),
    };

    setIsGenerating(true);
    setSyncMessage(null);

    const now = new Date().toISOString();
    const baseDraftId = -Date.now();
    const draftIds: number[] = [];
    const drafts: FakeSetItem[] = Array.from({ length: n }).map((_, idx) => {
      const id = baseDraftId - idx;
      draftIds.push(id);
      return {
        id,
        setId: defaultSetId,
        createdAt: now,
        label: `${label} ${idx + 1}`,
        status: 'generating',
        url: placeholderUrl('Generating…', Math.abs(id), 640),
        prompt: genCustomInstructions.trim() || 'Generate a hero product image.',
        schemaKey: 'hero_product.v1',
        input,
        isSelected: false,
      };
    });

    setItemsBySetId((prev) => ({
      ...prev,
      [defaultSetId]: [...drafts, ...(prev[defaultSetId] ?? [])],
    }));

    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaKey: 'hero_product.v1', input }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error ? String(data.error) : `Failed to generate (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const images: any[] = Array.isArray(data?.images) ? data.images : [];
      const created: FakeSetItem[] = images.map((img, idx) => ({
        id: Number(img.id),
        setId: defaultSetId,
        createdAt: String(img.createdAt ?? new Date().toISOString()),
        label: `${label} ${idx + 1}`,
        status: 'ready',
        url: String(img.url),
        prompt: String(img.prompt ?? genCustomInstructions.trim() ?? ''),
        schemaKey: String(img.schemaKey ?? 'hero_product.v1'),
        input: img.input ?? input,
        isSelected: false,
      }));

      setItemsBySetId((prev) => ({
        ...prev,
        [defaultSetId]: [
          ...created,
          ...(prev[defaultSetId] ?? []).filter((i) => !draftIds.includes(i.id)),
        ],
      }));
      setIsGenerating(false);
      setSyncMessage(`Generated ${created.length} image(s).`);
      return true;
    } catch (err: any) {
      setItemsBySetId((prev) => ({
        ...prev,
        [defaultSetId]: (prev[defaultSetId] ?? []).filter((i) => !draftIds.includes(i.id)),
      }));
      setIsGenerating(false);
      const raw = err?.message ? String(err.message) : 'Generation failed.';
      setGenSubmitError(`Generation failed. Please try again. (${raw})`);
      setSyncMessage(raw);
      return false;
    }
  }

  function openLightbox(assetId: number) {
    setEditInstructions('');
    setEditReferenceImageUrl('');
    setLightbox({ kind: 'asset', id: assetId });
  }

  async function generateFromEdit() {
    if (!defaultSetId) {
      setSyncMessage('Default folder is missing (unexpected).');
      return;
    }
    const base = lightboxSetItem ?? lightboxAsset;
    if (!base) return;

    setIsGenerating(true);
    setSyncMessage(null);

    const now = new Date().toISOString();
    const draftId = -Date.now();
    const baseLabel =
      lightboxSetItem?.label?.trim() ? lightboxSetItem.label.trim() : lightboxAsset ? 'asset' : 'image';
    const label = `edited-${baseLabel}`;
    const targetFolderId =
      lightbox?.kind === 'setItem' ? (lightbox.setId ?? defaultSetId) : defaultSetId;
    const draft: FakeSetItem = {
      id: draftId,
      setId: targetFolderId,
      createdAt: now,
      label,
      status: 'generating',
      url: placeholderUrl('Generating…', Math.abs(draftId), 640),
      prompt: editInstructions.trim(),
      schemaKey: 'edit.v1',
      input: {
        base_image_url: base.url,
        reference_image_url: editReferenceImageUrl.trim() || null,
        edit_instructions: editInstructions.trim(),
      },
      isSelected: false,
    };

    setItemsBySetId((prev) => ({
      ...prev,
      [targetFolderId]: [draft, ...(prev[targetFolderId] ?? [])],
    }));

    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_image_url: base.url,
          base_label: baseLabel,
          edit_instructions: editInstructions.trim(),
          reference_image_url: editReferenceImageUrl.trim() || null,
          target_set_id: lightbox?.kind === 'setItem' ? (lightbox.setId ?? null) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `Edit failed (HTTP ${res.status})`);
      }

      const img = data?.image;
      if (!img) throw new Error('Edit failed (missing image)');

      const folderId: number = Number(data?.folderId ?? targetFolderId);
      const created: FakeSetItem = {
        id: Number(img.id),
        setId: folderId,
        createdAt: String(img.createdAt ?? new Date().toISOString()),
        label,
        status: (img.status as any) ?? 'ready',
        url: String(img.url),
        prompt: String(img.prompt ?? editInstructions.trim() ?? ''),
        schemaKey: String(img.schemaKey ?? 'edit.v1'),
        input: img.input ?? draft.input,
        isSelected: false,
      };

      setItemsBySetId((prev) => ({
        ...prev,
        [folderId]: [created, ...(prev[folderId] ?? []).filter((i) => i.id !== draftId)],
      }));

      setIsGenerating(false);
      setLightbox(null);
    } catch (err: any) {
      setItemsBySetId((prev) => ({
        ...prev,
        [targetFolderId]: (prev[targetFolderId] ?? []).filter((i) => i.id !== draftId),
      }));
      setIsGenerating(false);
      setSyncMessage(err?.message ? String(err.message) : 'Edit failed.');
    }
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

  async function reloadFolderItems(setId: number) {
    const res = await fetch(`/api/sets/${setId}/items`);
    const j = await res.json().catch(() => null);
    if (!res.ok) return;
    const items = Array.isArray(j?.items) ? j.items : [];
    setItemsBySetId((prev) => ({
      ...prev,
      [setId]: items
        .filter((it: any) => it.itemType === 'variant_image' && it.data)
        .map((it: any) => {
          const img = it.data;
          const createdAt = String(img.createdAt ?? it.createdAt ?? new Date().toISOString());
          const outputLabel =
            img?.input && typeof img.input === 'object' && (img.input as any).output_label
              ? String((img.input as any).output_label)
              : null;
          return {
            id: Number(img.id),
            setId: Number(it.setId ?? setId),
            createdAt,
            label: outputLabel ?? (img.generationId ? `Gen ${img.generationId}` : `Image ${img.id}`),
            status: (img.status as any) ?? 'ready',
            url: String(img.url),
            prompt: String(img.prompt ?? ''),
            schemaKey: String(img.schemaKey ?? ''),
            input: img.input ?? null,
            isSelected: false,
          } as FakeSetItem;
        }),
    }));
  }

  async function removeSetItem(setId: number, itemId: number) {
    // itemId here is the underlying variant_image id
    const res = await fetch(`/api/sets/${setId}/items/variant_image/${itemId}`, { method: 'DELETE' });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSyncMessage(j?.error ? String(j.error) : `Failed to remove item (HTTP ${res.status})`);
      setDeleteId(null);
      return;
    }

    setItemsBySetId((prev) => ({
      ...prev,
      [setId]: (prev[setId] ?? []).filter((i) => i.id !== itemId),
    }));
    setDeleteId(null);
    setLightbox((prev) =>
      prev?.kind === 'setItem' && prev.id === itemId ? null : prev
    );
  }

  async function createSet(name: string) {
    const res = await fetch(`/api/products/${productId}/variants/${variantId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: null }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSyncMessage(j?.error ? String(j.error) : `Failed to create folder (HTTP ${res.status})`);
      return;
    }
    const s = j?.set as FakeSet | undefined;
    if (!s) return;
    setSets((prev) => [s, ...prev]);
    setItemsBySetId((prev) => ({ ...prev, [s.id]: [] }));
    setActiveFolderId(s.id);
  }

  async function renameSet(setId: number, name: string) {
    const res = await fetch(`/api/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSyncMessage(j?.error ? String(j.error) : `Failed to rename folder (HTTP ${res.status})`);
      return;
    }
    const updated = j?.set as FakeSet | undefined;
    if (!updated) return;
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, ...updated } : s)));
  }

  async function deleteSetById(setId: number) {
    if (sets.find((s) => s.id === setId)?.isDefault) {
      setSyncMessage('Cannot delete the default folder.');
      setDeleteId(null);
      return;
    }
    const res = await fetch(`/api/sets/${setId}`, { method: 'DELETE' });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setSyncMessage(j?.error ? String(j.error) : `Failed to delete folder (HTTP ${res.status})`);
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

  async function moveSelectedItemsFromFolder(sourceSetId: number, targetSetId: number) {
    const selected = (itemsBySetId[sourceSetId] ?? []).filter((i) => i.isSelected);
    if (selected.length === 0) {
      setMoveOpen(false);
      return;
    }
    setSyncMessage(`Moving ${selected.length} item(s)…`);
    try {
      for (const item of selected) {
        await fetch(`/api/sets/${sourceSetId}/items/variant_image/${item.id}`, { method: 'DELETE' });
        await fetch(`/api/sets/${targetSetId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'variant_image', itemId: item.id, sortOrder: 0 }),
        });
      }
      await Promise.all([reloadFolderItems(sourceSetId), reloadFolderItems(targetSetId)]);
      setSyncMessage(`Moved ${selected.length} item(s).`);
    } catch {
      setSyncMessage('Move failed.');
      await Promise.all([reloadFolderItems(sourceSetId), reloadFolderItems(targetSetId)]);
    } finally {
      setMoveOpen(false);
    }
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
        <div className="text-muted-foreground">
          {loading ? 'Loading…' : 'Variant not found.'}
        </div>
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
                          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${isActive ? 'bg-muted' : 'hover:bg-muted/50'
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
                              setEditReferenceImageUrl('');
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
                                    setRenameItem({ setId: i.setId, itemId: i.id });
                                    setRenameItemName(i.label);
                                  }}
                                >
                                  Rename image
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
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open);
          if (open) {
            setGenValidationError(null);
            setGenSubmitError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Generate new outputs
              <div className="text-xs text-muted-foreground mt-2">
                Category: <span className="font-medium text-foreground capitalize">{productCategory}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isGenerating) return;
              const productImages = genProductImages.map((s) => s.trim()).filter(Boolean);
              if (productImages.length === 0) {
                setGenValidationError('At least one product image is required.');
                return;
              }
              setGenValidationError(null);
              setGenSubmitError(null);
              const ok = await generateNewAssets('generated-image');
              if (ok) setGenerateOpen(false);
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: required inputs */}
                <div className="space-y-4 border-r">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Product images <span className="text-red-500">*</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {genProductImages.map((url, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="flex-1">
                            <AssetPickerField
                              value={url}
                              onChange={(next) =>
                                setGenProductImages((prev) =>
                                  prev.map((v, i) => (i === idx ? next : v))
                                )
                              }
                              kind="product"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {genValidationError ? (
                      <div className="text-sm text-red-600">{genValidationError}</div>
                    ) : null}
                  </div>
                </div>

                {/* Right: optional context + settings */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AssetPickerField
                      label="Model image (optional)"
                      value={genModelImageUrl}
                      onChange={setGenModelImageUrl}
                      kind="model"
                      allowTemplates
                      templateKind="model"
                    />
                    <AssetPickerField
                      label="Background image (optional)"
                      value={genBackgroundImageUrl}
                      onChange={setGenBackgroundImageUrl}
                      kind="background"
                      allowTemplates
                      templateKind="background"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="gen-variations">Number of variations</FieldLabel>
                      <Input
                        id="gen-variations"
                        type="number"
                        min={1}
                        max={10}
                        value={String(genNumberOfVariations)}
                        onChange={(e) => setGenNumberOfVariations(Number(e.target.value))}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="gen-ratio">Aspect ratio</FieldLabel>
                      <select
                        id="gen-ratio"
                        value={genAspectRatio}
                        onChange={(e) => setGenAspectRatio(e.target.value as any)}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="1:1">1:1</option>
                        <option value="4:5">4:5</option>
                        <option value="3:4">3:4</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              <Field>
                <FieldLabel htmlFor="gen-instructions">Custom instructions (optional)</FieldLabel>
                <Textarea
                  id="gen-instructions"
                  value={genCustomInstructions}
                  onChange={(e) => setGenCustomInstructions(e.target.value)}
                  placeholder="e.g., brighter background, more premium lighting, centered framing"
                  className="min-h-[120px] resize-none"
                />
              </Field>
            </FieldGroup>

             {genSubmitError ? (
               <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                 {genSubmitError}
               </div>
             ) : null}
             <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={isGenerating}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View details dialog */}
      <Dialog
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation details</DialogTitle>
          </DialogHeader>

          {!detailsItem ? (
            <div className="text-sm text-muted-foreground">Item not found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border overflow-hidden bg-muted">
                <div className="aspect-square">
                  <img src={detailsItem.url} alt="" className="w-full h-full object-contain" />
                </div>
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

                {detailsItem.prompt ? (
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Prompt</FieldLabel>
                      <Textarea
                        value={detailsItem.prompt}
                        readOnly
                        className="min-h-[160px] resize-none"
                      />
                    </Field>
                  </FieldGroup>
                ) : null}

                {detailsItem.schemaKey || detailsItem.input ? (
                  <FieldGroup>
                    {detailsItem.schemaKey ? (
                      <Field>
                        <FieldLabel>Schema</FieldLabel>
                        <Input value={detailsItem.schemaKey} readOnly />
                      </Field>
                    ) : null}
                  </FieldGroup>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDetails(null)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => downloadImage(detailsItem)}
                    disabled={detailsItem.status !== 'ready'}
                  >
                    Download
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
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border overflow-hidden bg-muted">
              <div className="aspect-square relative">
                {lightboxSetItem ? (
                  <img src={lightboxSetItem.url} alt="" className="w-full h-full object-contain" />
                ) : lightboxAsset ? (
                  <img src={lightboxAsset.url} alt="" className="w-full h-full object-contain" />
                ) : null}

                <div className="absolute bottom-2 flex justify-between w-full px-4">
                  <div className="flex items-center gap-2">
                    {lightboxSetItem ? (
                      <>
                        <Badge variant={lightboxSetItem.status === 'ready' ? 'secondary' : 'outline'}>
                          {lightboxSetItem.status}
                        </Badge>
                        <Badge variant="outline">{formatWhen(lightboxSetItem.createdAt)}</Badge>
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
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={async () => {
                      if (lightboxSetItem) {
                        await downloadImage(lightboxSetItem);
                        return;
                      }
                      if (lightboxAsset) {
                        const file = `asset-${lightboxAsset.id}.png`;
                        await downloadFromUrl(lightboxAsset.url, file);
                      }
                    }}
                    disabled={
                      (!lightboxSetItem && !lightboxAsset) ||
                      (lightboxSetItem ? lightboxSetItem.status !== 'ready' : lightboxAsset?.status !== 'ready')
                    }
                    title="Download"
                  >
                    Download
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
                    Optionally add a reference image below to guide the edit.
                  </FieldDescription>
                </Field>
                <AssetPickerField
                  label="Reference image (optional)"
                  value={editReferenceImageUrl}
                  onChange={setEditReferenceImageUrl}
                  kind="product"
                  description="Upload/select a reference image to guide the output. Optional."
                />
              </FieldGroup>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setLightbox(null)} disabled={isGenerating}>
                  Close
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={generateFromEdit}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating…' : 'Edit image'}
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

      {/* Rename image dialog */}
      <Dialog
        open={renameItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameItem(null);
            setRenameItemName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename image</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-image-name">Name</FieldLabel>
              <Input
                id="rename-image-name"
                value={renameItemName}
                onChange={(e) => setRenameItemName(e.target.value)}
                placeholder={renameSetItem?.label ?? 'e.g. hero-shot-1'}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameItem(null);
                setRenameItemName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!renameItem) return;
                const name = renameItemName.trim();
                if (!name) return;
                // Optimistic update, then persist to DB so it survives refresh.
                const prevName = renameSetItem?.label ?? '';
                setItemsBySetId((prev) => ({
                  ...prev,
                  [renameItem.setId]: (prev[renameItem.setId] ?? []).map((i) =>
                    i.id === renameItem.itemId ? { ...i, label: name } : i
                  ),
                }));

                fetch(`/api/variant-images/${renameItem.itemId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ output_label: name }),
                })
                  .then(async (res) => {
                    const j = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(j?.error ?? `Rename failed (HTTP ${res.status})`);
                  })
                  .catch((err) => {
                    // Roll back UI if the server update fails.
                    setItemsBySetId((prev) => ({
                      ...prev,
                      [renameItem.setId]: (prev[renameItem.setId] ?? []).map((i) =>
                        i.id === renameItem.itemId ? { ...i, label: prevName || i.label } : i
                      ),
                    }));
                    setSyncMessage(err?.message ? String(err.message) : 'Rename failed.');
                  });

                setRenameItem(null);
                setRenameItemName('');
              }}
              disabled={!renameItemName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


