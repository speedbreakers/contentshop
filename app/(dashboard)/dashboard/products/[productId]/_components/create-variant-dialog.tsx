'use client';

import { useMemo, useState } from 'react';
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
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setSku('');
    setValues({});
  }

  async function create() {
    const t = title.trim();
    if (!t) return;

    if (sortedOptions.length > 0) {
      for (const opt of sortedOptions) {
        if (!values[opt.id]?.trim()) return;
      }
    }

    setSaving(true);
    setError(null);
    const payload = {
      title: t,
      sku: sku.trim() || null,
      shopifyVariantGid: null,
      optionValues: sortedOptions
        .map((opt) => ({
          productOptionId: opt.id,
          value: values[opt.id]?.trim() ?? '',
        }))
        .filter((v) => v.value),
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

          {sortedOptions.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">Options</div>
              <FieldGroup>
                {sortedOptions.map((opt) => (
                  <Field key={opt.id}>
                    <FieldLabel htmlFor={`create-variant-opt-${opt.id}`}>
                      {opt.name}
                    </FieldLabel>
                    <Input
                      id={`create-variant-opt-${opt.id}`}
                      value={values[opt.id] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [opt.id]: e.target.value }))
                      }
                      placeholder={`Enter ${opt.name}`}
                      required
                    />
                  </Field>
                ))}
              </FieldGroup>
            </div>
          ) : (
            <Field>
              <FieldDescription>
                This product has no option schema yet. (You can add schema later.)
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


