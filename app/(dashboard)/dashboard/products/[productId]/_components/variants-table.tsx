'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FakeProduct, FakeVariant } from '@/lib/fake/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EllipsisVerticalIcon } from 'lucide-react';

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
  const router = useRouter();
  const [variants, setVariants] = useState<FakeVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/products/${props.product.id}/variants`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (!ok) {
          setError(j?.error ? String(j.error) : `Failed to load (HTTP ${status})`);
          setVariants([]);
          return;
        }
        const items = Array.isArray(j?.items) ? j.items : [];
        setVariants(
          items.map((v: any) => ({
            id: Number(v.id),
            productId: Number(v.productId ?? props.product.id),
            title: String(v.title),
            sku: v.sku ?? null,
            shopifyVariantGid: v.shopifyVariantGid ?? null,
            optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
            updatedAt: String(v.updatedAt ?? new Date().toISOString()),
          }))
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ? String(e.message) : 'Failed to load variants');
        setVariants([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.product.id]);

  const [linkVariantId, setLinkVariantId] = useState<number | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<number | null>(null);

  async function reloadVariants() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/products/${props.product.id}/variants`);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ? String(j.error) : `Failed to load (HTTP ${res.status})`);
      setVariants([]);
      setLoading(false);
      return;
    }
    const items = Array.isArray(j?.items) ? j.items : [];
    setVariants(
      items.map((v: any) => ({
        id: Number(v.id),
        productId: Number(v.productId ?? props.product.id),
        title: String(v.title),
        sku: v.sku ?? null,
        shopifyVariantGid: v.shopifyVariantGid ?? null,
        optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
        updatedAt: String(v.updatedAt ?? new Date().toISOString()),
      }))
    );
    setLoading(false);
  }

  async function setDefault(variantId: number) {
    setError(null);
    const res = await fetch(`/api/products/${props.product.id}/default-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ? String(data.error) : `Failed (HTTP ${res.status})`);
      return;
    }
    props.onChange({
      ...props.product,
      defaultVariantId: variantId,
      updatedAt: new Date().toISOString(),
    });
  }

  function saveVariantLink(variantId: number, gid: string) {
    setError(null);
    fetch(`/api/products/${props.product.id}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopifyVariantGid: gid || null }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (!ok) {
          setError(j?.error ? String(j.error) : `Save failed (HTTP ${status})`);
          return;
        }
        reloadVariants();
      })
      .catch((e) => setError(e?.message ? String(e.message) : 'Save failed'))
      .finally(() => setLinkVariantId(null));
  }

  function deleteVariant(variantId: number) {
    setError(null);
    fetch(`/api/products/${props.product.id}/variants/${variantId}`, { method: 'DELETE' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (!ok) {
          setError(j?.error ? String(j.error) : `Delete failed (HTTP ${status})`);
          return;
        }
        reloadVariants();
      })
      .catch((e) => setError(e?.message ? String(e.message) : 'Delete failed'))
      .finally(() => setDeleteVariantId(null));
  }

  const linkVariant = linkVariantId
    ? variants.find((v) => v.id === linkVariantId) ?? null
    : null;

  const deleteVariantEntity = deleteVariantId
    ? variants.find((v) => v.id === deleteVariantId) ?? null
    : null;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <div className="text-sm text-muted-foreground">
            Default variant is required. Reassign default before removing it.
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </CardHeader>
        <CardContent>
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : variants.map((v) => {
                const isDefault = v.id === props.product.defaultVariantId;
                const isLast = variants.length <= 1;
                const canDelete = !isDefault && !isLast;

                return (
                  <TableRow
                    key={v.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() =>
                      router.push(`/dashboard/products/${props.product.id}/variants/${v.id}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/dashboard/products/${props.product.id}/variants/${v.id}`);
                      }
                    }}
                  >
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

                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <EllipsisVerticalIcon className="size-4" />
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
        </CardContent>
      </Card>

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


