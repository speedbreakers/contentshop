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

  function reset() {
    setTitle('');
    setSku('');
    setValues({});
  }

  function create() {
    const t = title.trim();
    if (!t) return;

    if (sortedOptions.length > 0) {
      for (const opt of sortedOptions) {
        if (!values[opt.id]?.trim()) return;
      }
    }

    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();

    props.onCreate({
      id,
      productId: props.product.id,
      title: t,
      sku: sku.trim() || null,
      shopifyVariantGid: null,
      optionValues: sortedOptions
        .map((opt) => ({
          productOptionId: opt.id,
          value: values[opt.id]?.trim() ?? '',
        }))
        .filter((v) => v.value),
      updatedAt: now,
    });

    props.onOpenChange(false);
    reset();
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
          <Button onClick={create}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


