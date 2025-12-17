'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { FakeProduct, FakeVariant } from '@/lib/fake/products';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react';

export function CreateVariantDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: FakeProduct;
  onCreate: (variant: FakeVariant) => void;
}) {
  const sortedOptions = useMemo(
    () => [...props.product.options].sort((a, b) => a.position - b.position),
    [props.product.options]
  );

  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setSku('');
    setImageUrl('');
    setValues({});
  }

  async function uploadVariantImage(file: File) {
    const form = new FormData();
    form.append('kind', 'product');
    form.append('file', file);

    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');

      const url = data?.file?.url;
      if (typeof url === 'string' && url.length > 0) {
        setImageUrl(url);
      }
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    const t = title.trim();
    if (!t) return;

    setSaving(true);
    setError(null);
    const payload = {
      title: t,
      sku: sku.trim() || null,
      imageUrl: imageUrl || null,
      shopifyVariantGid: null,
      optionValues: [],
    };

    try {
      const res = await fetch(`/api/products/${props.product.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `Create failed (HTTP ${res.status})`);
      }
      const v = data?.variant;
      if (!v) throw new Error('Create failed (missing variant)');

      props.onCreate({
        id: Number(v.id),
        productId: Number(v.productId ?? props.product.id),
        title: String(v.title),
        sku: v.sku ?? null,
        imageUrl: v.imageUrl ?? payload.imageUrl,
        shopifyVariantGid: v.shopifyVariantGid ?? null,
        optionValues: Array.isArray(v.optionValues) ? v.optionValues : payload.optionValues,
        updatedAt: String(v.updatedAt ?? new Date().toISOString()),
      });

      props.onOpenChange(false);
      reset();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open);
        if (!open) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => props.onOpenChange(true)}>
          Create variant
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create variant</DialogTitle>
        </DialogHeader>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <FieldGroup>
          <Field>
            <FieldLabel className="mb-2 block">Variant image</FieldLabel>
            <div className="group relative aspect-square w-full max-w-[180px] rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/50 hover:border-muted-foreground/40 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) {
                    uploadVariantImage(f);
                    e.currentTarget.value = '';
                  }
                }}
              />

              {imageUrl ? (
                <>
                  <Image
                    src={imageUrl}
                    alt="Variant preview"
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
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
            <FieldDescription>Optional. Used as a visual for this variant in lists.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="create-variant-title">Title</FieldLabel>
            <Input
              id="create-variant-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Black / M"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="create-variant-sku">SKU</FieldLabel>
            <Input
              id="create-variant-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Optional"
            />
            <FieldDescription>Optional. Used for inventory and store operations.</FieldDescription>
          </Field>

        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving || uploading}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


