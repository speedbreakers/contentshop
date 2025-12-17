'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react';

export function EditVariantDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  variant: { id: number; title: string; sku: string | null; imageUrl: string | null } | null;
  onSaved?: (next: { title: string; sku: string | null; imageUrl: string | null }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    setTitle(props.variant?.title ?? '');
    setSku(props.variant?.sku ?? '');
    setImageUrl(props.variant?.imageUrl ?? '');
  }, [props.open, props.variant]);

  async function uploadImage(file: File) {
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

  async function save() {
    if (!props.variant) return;
    const nextTitle = title.trim();
    if (!nextTitle) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/products/${props.productId}/variants/${props.variant.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: nextTitle,
            sku: sku.trim() || null,
            imageUrl: imageUrl || null,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Save failed (HTTP ${res.status})`);
      }

      props.onSaved?.({
        title: nextTitle,
        sku: sku.trim() || null,
        imageUrl: imageUrl || null,
      });
      props.onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit variant</DialogTitle>
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
                    uploadImage(f);
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
                      <span className="text-xs font-medium">Change image</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <FieldDescription>Optional. Used as a visual for this variant in lists.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-variant-title">Title</FieldLabel>
            <Input
              id="edit-variant-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-variant-sku">SKU</FieldLabel>
            <Input
              id="edit-variant-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || uploading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


