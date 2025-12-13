'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FakeProduct, FakeVariant } from '@/lib/fake/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LinkShopifyDialog } from './link-shopify-dialog';

function optionSummary(product: FakeProduct, v: FakeVariant) {
  if (!v.optionValues.length) return '—';
  const optById = new Map(product.options.map((o) => [o.id, o.name]));
  return v.optionValues
    .map((x) => `${optById.get(x.productOptionId) ?? 'Option'}=${x.value}`)
    .join(', ');
}

export function VariantsTable(props: {
  product: FakeProduct;
  onChange: (next: FakeProduct) => void;
}) {
  const variants = useMemo(
    () => [...props.product.variants].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [props.product.variants]
  );

  const [linkVariantId, setLinkVariantId] = useState<number | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<number | null>(null);

  function setDefault(variantId: number) {
    props.onChange({
      ...props.product,
      defaultVariantId: variantId,
      updatedAt: new Date().toISOString(),
    });
  }

  function saveVariantLink(variantId: number, gid: string) {
    props.onChange({
      ...props.product,
      variants: props.product.variants.map((v) =>
        v.id === variantId
          ? { ...v, shopifyVariantGid: gid || null, updatedAt: new Date().toISOString() }
          : v
      ),
      updatedAt: new Date().toISOString(),
    });
  }

  function deleteVariant(variantId: number) {
    props.onChange({
      ...props.product,
      variants: props.product.variants.filter((v) => v.id !== variantId),
      updatedAt: new Date().toISOString(),
    });
    setDeleteVariantId(null);
  }

  const linkVariant = linkVariantId
    ? props.product.variants.find((v) => v.id === linkVariantId) ?? null
    : null;

  const deleteVariantEntity = deleteVariantId
    ? props.product.variants.find((v) => v.id === deleteVariantId) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div>
        <div className="font-medium">Variants</div>
        <div className="text-sm text-muted-foreground">
          Default variant is required. Reassign default before removing it.
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Options</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Shopify</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {variants.map((v) => {
            const isDefault = v.id === props.product.defaultVariantId;
            const isLast = props.product.variants.length <= 1;
            const canDelete = !isDefault && !isLast;

            return (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="font-medium">{v.title}</div>
                  <div className="text-xs text-muted-foreground">#{v.id}</div>
                  {isDefault ? <Badge className="mt-1">Default</Badge> : null}
                </TableCell>

                <TableCell className="text-sm">{optionSummary(props.product, v)}</TableCell>
                <TableCell className="text-sm">{v.sku ?? '—'}</TableCell>
                <TableCell>
                  {v.shopifyVariantGid ? <Badge>Linked</Badge> : <Badge variant="outline">Not linked</Badge>}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        Menu
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/products/${props.product.id}/variants/${v.id}`}
                        >
                          Manage assets
                        </Link>
                      </DropdownMenuItem>
                      {!isDefault ? (
                        <DropdownMenuItem onClick={() => setDefault(v.id)}>
                          Set as default
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => setLinkVariantId(v.id)}>
                        {v.shopifyVariantGid ? 'Change Shopify link' : 'Link Shopify variant'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteVariantId(v.id)}
                        disabled={!canDelete}
                        title={
                          isDefault
                            ? 'Cannot delete the default variant. Reassign default first.'
                            : isLast
                              ? 'A product must have at least one variant.'
                              : undefined
                        }
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <LinkShopifyDialog
        open={linkVariantId !== null}
        onOpenChange={(open) => {
          if (!open) setLinkVariantId(null);
        }}
        title="Link Shopify variant"
        label="Shopify Variant GID"
        value={linkVariant?.shopifyVariantGid ?? ''}
        placeholder="gid://shopify/ProductVariant/..."
        onSave={(gid) => {
          if (!linkVariantId) return;
          saveVariantLink(linkVariantId, gid);
        }}
      />

      <AlertDialog open={deleteVariantId !== null} onOpenChange={(open) => !open && setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteVariantEntity
              ? `This will remove “${deleteVariantEntity.title}”.`
              : 'This will remove the selected variant.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteVariantId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteVariantId) deleteVariant(deleteVariantId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


