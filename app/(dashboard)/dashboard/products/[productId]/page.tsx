'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FakeProduct, FakeVariant } from '@/lib/fake/products';
import { fetchJson } from '@/lib/swr/fetcher';
import { VariantsTable } from './_components/variants-table';
import { CreateVariantDialog } from './_components/create-variant-dialog';
import { ProductDescription } from './_components/product-description';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Loader2Icon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';

const PRODUCT_CATEGORIES = [
  { value: 'apparel', label: 'Apparel' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'bags', label: 'Bags' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'home', label: 'Home & Living' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'jewellery', label: 'Jewellery' },
  { value: 'sports', label: 'Sports' },
  { value: 'toys', label: 'Toys' },
] as const;

type ProductDetail = FakeProduct & { imageUrl?: string | null };

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const productKey = Number.isFinite(productId) ? `/api/products/${productId}` : null;

  const [loadError, setLoadError] = useState<string | null>(null);

  const [createVariantOpen, setCreateVariantOpen] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string>('apparel');
  const [editTags, setEditTags] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: product,
    error: productError,
    isLoading,
    mutate: mutateProduct,
  } = useSWR<ProductDetail>(
    productKey,
    async (url) => {
      const j = await fetchJson<{ product: any }>(url);
      const p = j?.product;
      if (!p) throw new Error('Product not found');

      const mapped: ProductDetail = {
        id: Number(p.id),
        title: String(p.title),
        status: (p.status as any) ?? 'draft',
        category: (p.category as any) ?? 'apparel',
        vendor: p.vendor ?? null,
        productType: p.productType ?? null,
        handle: p.handle ?? null,
        tags: p.tags ?? null,
        shopifyProductGid: p.shopifyProductGid ?? null,
        imageUrl: p.imageUrl ?? null,
        defaultVariantId: Number(p.defaultVariantId ?? (p.variants?.[0]?.id ?? 0)),
        options: Array.isArray(p.options) ? p.options : [],
        variants: Array.isArray(p.variants)
          ? p.variants.map((v: any) => ({
              id: Number(v.id),
              productId: Number(v.productId ?? p.id),
              title: String(v.title),
              sku: v.sku ?? null,
              shopifyVariantGid: v.shopifyVariantGid ?? null,
              optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
              updatedAt: String(v.updatedAt ?? new Date().toISOString()),
            }))
          : [],
        updatedAt: String(p.updatedAt ?? new Date().toISOString()),
      };

      return mapped;
    },
    {
      // Prevent UI flashes when navigating around and coming back.
      keepPreviousData: true,
    }
  );

  const headerMessage = useMemo(() => {
    if (!Number.isFinite(productId)) return 'Invalid product.';
    if (isLoading) return 'Loading…';
    if (loadError) return loadError;
    if (productError instanceof Error) return productError.message;
    if (productError) return 'Failed to load product.';
    return 'Product not found.';
  }, [productError, isLoading, loadError, productId]);

  if (!product) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-muted-foreground">
          {headerMessage}
        </div>
        <Button asChild className="mt-4">
          <Link href="/dashboard/products">Back to products</Link>
        </Button>
      </section>
    );
  }

  function addVariant(variant: FakeVariant) {
    mutateProduct((p) => {
      if (!p) return p as any;
      return {
        ...p,
        variants: [variant, ...p.variants],
        updatedAt: new Date().toISOString(),
      };
    }, { revalidate: false });
  }

  function openEdit() {
    if (!product) return;
    setEditTitle(product.title ?? '');
    setEditCategory((product.category as unknown as string) ?? 'apparel');
    setEditTags(product.tags ?? '');
    setEditImageUrl(product.imageUrl ?? '');
    setEditOpen(true);
  }

  async function uploadEditImage(file: File) {
    const form = new FormData();
    form.append('kind', 'product');
    form.append('file', file);

    setEditUploading(true);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');

      const url = data?.file?.url;
      if (typeof url === 'string' && url.length > 0) {
        setEditImageUrl(url);
      }
    } catch (e: any) {
      setLoadError(e?.message ?? 'Upload failed');
    } finally {
      setEditUploading(false);
    }
  }

  async function saveEdit() {
    if (!product) return;
    const title = editTitle.trim();
    if (!title) return;

    setLoadError(null);
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category: editCategory,
        tags: editTags.trim() || null,
        imageUrl: editImageUrl || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLoadError(data?.error ? String(data.error) : `Save failed (HTTP ${res.status})`);
      return;
    }

    const updated = data?.product;
    if (updated) {
      mutateProduct(
        (prev) =>
          prev
            ? {
                ...prev,
                title: updated.title ?? prev.title,
                category: updated.category ?? prev.category,
                tags: updated.tags ?? prev.tags,
                imageUrl: updated.imageUrl ?? prev.imageUrl,
                updatedAt: updated.updatedAt ?? prev.updatedAt,
              }
            : prev,
        { revalidate: false }
      );
    }

    setEditOpen(false);
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-2">
          <Link href="/dashboard/products" className="hover:underline">
            Products
          </Link>{' '}
          / {product.title}
        </div>
        {loadError ? <div className="text-sm text-red-600 mb-2">{loadError}</div> : null}

        <div className="flex items-start justify-between gap-4">
          <div className='flex gap-x-4'>
            <div className="h-12 w-12 rounded-md border overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="font-medium text-xl">{product.title}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {product.category}
              </div>
            </div>
          </div>

          <div className="flex gap-2">


            <CreateVariantDialog
              open={createVariantOpen}
              onOpenChange={setCreateVariantOpen}
              product={product}
              onCreate={addVariant}
            />

            <Button variant="outline" onClick={openEdit} aria-label="Edit product">
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <Tabs defaultValue="variants">
            <TabsList>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="mt-4">
              <VariantsTable
                product={product}
                onChange={(next) => mutateProduct(next as any, { revalidate: false })}
              />
            </TabsContent>

            <TabsContent value="description" className="mt-4">
              <ProductDescription
                productId={product.id}
                isShopifyLinked={false}
                onRequestLinkShopify={() => { }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
            <div>
              <FieldLabel className="mb-2 block">Product Image</FieldLabel>
              <div className="group relative aspect-square w-full max-w-[180px] rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/50 hover:border-muted-foreground/40 transition-colors">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) {
                      uploadEditImage(f);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                {editImageUrl ? (
                  <>
                    <Image
                      src={editImageUrl}
                      alt="Product preview"
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditImageUrl('')}
                      className="absolute top-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Remove image"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
                      aria-label="Change image"
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={editUploading}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {editUploading ? (
                      <Loader2Icon className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <div className="rounded-full bg-muted p-3">
                          <PlusIcon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium">Change image</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Helps identify the product in listings
              </p>
            </div>

            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="edit-product-title">Title</FieldLabel>
                <Input
                  id="edit-product-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Category controls the generation form shown on variants.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-product-tags">Tags</FieldLabel>
                <Input
                  id="edit-product-tags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="tshirt, cotton, basics"
                />
                <FieldDescription>Comma-separated. Optional.</FieldDescription>
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editTitle.trim() || editUploading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


