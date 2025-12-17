'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EllipsisVerticalIcon, ImageIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react';

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

type ApiProduct = {
  id: number;
  title: string;
  category: string;
  vendor: string | null;
  productType: string | null;
  handle: string | null;
  tags: string | null;
  imageUrl: string | null;
  defaultVariantId: number | null;
  updatedAt: string;
  variantsCount: number;
};

export default function ProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApiProduct[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('apparel');
  const [newTags, setNewTags] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string>('apparel');
  const [editTags, setEditTags] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch('/api/products')
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (!ok) {
          setLoadError(j?.error ? String(j.error) : `Failed to load (HTTP ${status})`);
          setItems([]);
          return;
        }
        setItems(Array.isArray(j?.items) ? j.items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e?.message ? String(e.message) : 'Failed to load products');
        setItems([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = `${p.title} ${p.handle ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  async function uploadProductImage(file: File) {
    const form = new FormData();
    form.append('kind', 'product');
    form.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');

      const url = data?.file?.url;
      if (typeof url === 'string' && url.length > 0) {
        setNewImageUrl(url);
      }
    } catch (e: any) {
      setLoadError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function uploadEditProductImage(file: File) {
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

  async function createProduct() {
    const title = newTitle.trim();
    if (!title) return;
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category: newCategory,
        tags: newTags.trim() || null,
        imageUrl: newImageUrl || null,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLoadError(data?.error ? String(data.error) : `Create failed (HTTP ${res.status})`);
      return;
    }

    const created: ApiProduct | null = data?.product
      ? {
        ...data.product,
        variantsCount: 1,
      }
      : null;

    if (created) {
      setItems((prev) => [created, ...prev]);
      setCreateOpen(false);
      setNewTitle('');
      setNewCategory('apparel');
      setNewTags('');
      setNewImageUrl('');
    }
  }

  function openEdit(product: ApiProduct) {
    setEditProductId(product.id);
    setEditTitle(product.title ?? '');
    setEditCategory(product.category ?? 'apparel');
    setEditTags(product.tags ?? '');
    setEditImageUrl(product.imageUrl ?? '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editProductId) return;
    const title = editTitle.trim();
    if (!title) return;

    setLoadError(null);
    const res = await fetch(`/api/products/${editProductId}`, {
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

    const updated = data?.product as Partial<ApiProduct> | undefined;
    if (updated?.id) {
      setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    }

    setEditOpen(false);
    setEditProductId(null);
  }

  async function deleteProduct(productId: number) {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLoadError(data?.error ? String(data.error) : `Delete failed (HTTP ${res.status})`);
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== productId));
  }

  return (
    <section className="flex-1 p-4 pb-0 lg:p-8 lg:pb-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage products and variants.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              New product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create product</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
              {/* Left column: Product Image */}
              <div>
                <FieldLabel className="mb-2 block">Product Image</FieldLabel>
                <div className="group relative aspect-square w-full max-w-[180px] rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/50 hover:border-muted-foreground/40 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        uploadProductImage(f);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  {newImageUrl ? (
                    <>
                      <Image
                        src={newImageUrl}
                        alt="Product preview"
                        fill
                        sizes="180px"
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNewImageUrl('')}
                        className="absolute top-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        aria-label="Remove image"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
                        aria-label="Change image"
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {uploading ? (
                        <Loader2Icon className="h-8 w-8 animate-spin" />
                      ) : (
                        <>
                          <div className="rounded-full bg-muted p-3">
                            <PlusIcon className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-medium">Add image</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Helps identify the product in listings
                </p>
              </div>

              {/* Right column: Form fields */}
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="create-product-title">Title</FieldLabel>
                  <Input
                    id="create-product-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Classic Cotton T‑Shirt"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select
                    value={newCategory}
                    onValueChange={(v) => setNewCategory(v)}
                  >
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
                  <FieldLabel htmlFor="create-product-tags">Tags</FieldLabel>
                  <Input
                    id="create-product-tags"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="tshirt, cotton, basics"
                  />
                  <FieldDescription>Comma-separated. Optional.</FieldDescription>
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createProduct} disabled={!newTitle.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="h-[calc(100dvh-200px)] min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>All products</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex gap-3 mb-4 shrink-0">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or handle…"
            />
          </div>
          {loadError ? (
            <div className="text-sm text-red-600 mb-3 shrink-0">{loadError}</div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-auto pr-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/dashboard/products/${p.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/dashboard/products/${p.id}`);
                        }
                      }}
                    >
                      <TableCell className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-md border overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {p.category}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{p.variantsCount ?? '—'}</TableCell>

                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <EllipsisVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/products/${p.id}`}>
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              Edit
                            </DropdownMenuItem>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-start px-2 text-red-600"
                              >
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete product?
                                </AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteProduct(p.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditProductId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
            {/* Left column: Product Image */}
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
                      uploadEditProductImage(f);
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
              <p className="mt-2 text-xs text-muted-foreground">Helps identify the product in listings</p>
            </div>

            {/* Right column: Form fields */}
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="edit-product-title">Title</FieldLabel>
                <Input
                  id="edit-product-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Classic Cotton T‑Shirt"
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
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditProductId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


