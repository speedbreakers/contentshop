'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
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
import { EllipsisVerticalIcon, ImageIcon } from 'lucide-react';
import { EditVariantDialog } from './edit-variant-dialog';
import { fetchJson } from '@/lib/swr/fetcher';

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
  const [error, setError] = useState<string | null>(null);
  const [editVariantId, setEditVariantId] = useState<number | null>(null);

  const variantsKey = `/api/products/${props.product.id}/variants`;

  const fallbackItems = useMemo(() => {
    const list = Array.isArray(props.product.variants) ? props.product.variants : [];
    return list.map((v: any) => ({
      id: Number(v.id),
      productId: Number(v.productId ?? props.product.id),
      title: String(v.title ?? ''),
      sku: v.sku ?? null,
      imageUrl: v.imageUrl ?? null,
      shopifyVariantGid: v.shopifyVariantGid ?? null,
      optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
      updatedAt: String(v.updatedAt ?? new Date().toISOString()),
    }));
  }, [props.product.id, props.product.variants]);

  const {
    data: variantsData,
    error: swrError,
    isLoading,
    mutate: mutateVariants,
  } = useSWR<{ items: any[] }>(
    variantsKey,
    async (url) => fetchJson<{ items: any[] }>(url),
    {
      fallbackData: { items: fallbackItems },
      keepPreviousData: true,
    }
  );

  const variants: FakeVariant[] = useMemo(() => {
    const items = Array.isArray(variantsData?.items) ? variantsData!.items : [];
    return items.map((v: any) => ({
      id: Number(v.id),
      productId: Number(v.productId ?? props.product.id),
      title: String(v.title),
      sku: v.sku ?? null,
      imageUrl: v.imageUrl ?? null,
      shopifyVariantGid: v.shopifyVariantGid ?? null,
      optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
      updatedAt: String(v.updatedAt ?? new Date().toISOString()),
    }));
  }, [props.product.id, variantsData]);

  const errorMessage =
    error ??
    (swrError instanceof Error ? swrError.message : swrError ? 'Failed to load variants' : null);

  const [linkVariantId, setLinkVariantId] = useState<number | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<number | null>(null);

  async function reloadVariants() {
    setError(null);
    await mutateVariants();
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
        mutateVariants();
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
        mutateVariants();
      })
      .catch((e) => setError(e?.message ? String(e.message) : 'Delete failed'))
      .finally(() => setDeleteVariantId(null));
  }

  const linkVariant = linkVariantId
    ? variants.find((v) => v.id === linkVariantId) ?? null
    : null;

  const editVariant = editVariantId
    ? variants.find((v) => v.id === editVariantId) ?? null
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
            {variants.length} variants
          </div>
          {errorMessage ? <div className="text-sm text-red-600">{errorMessage}</div> : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={2}>Variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {variants.length === 0 && isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
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
                    <TableCell colSpan={2}>
                      <div className='flex items-center gap-x-4'>
                        <div className="h-12 w-12 rounded-md border overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                          {v.imageUrl ? (
                            <Image
                              src={v.imageUrl}
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
                          {isDefault ? <Badge className="mt-1">Default</Badge> : <div className="font-medium">{v.title}</div>}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">{v.sku ?? '—'}</TableCell>

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
                          <DropdownMenuItem onClick={() => setEditVariantId(v.id)}>
                            Edit
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

      <EditVariantDialog
        open={editVariantId !== null}
        onOpenChange={(open) => {
          if (!open) setEditVariantId(null);
        }}
        productId={props.product.id}
        variant={
          editVariant
            ? {
                id: editVariant.id,
                title: editVariant.title,
                sku: editVariant.sku ?? null,
                imageUrl: editVariant.imageUrl ?? null,
              }
            : null
        }
        onSaved={() => {
          // Reload to reflect saved imageUrl/title/sku in the table
          mutateVariants();
          setEditVariantId(null);
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


