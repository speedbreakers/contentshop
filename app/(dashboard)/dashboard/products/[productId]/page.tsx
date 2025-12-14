'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FakeProduct, FakeVariant } from '@/lib/fake/products';
import { VariantsTable } from './_components/variants-table';
import { CreateVariantDialog } from './_components/create-variant-dialog';
import { LinkShopifyDialog } from './_components/link-shopify-dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ProductDescription } from './_components/product-description';

function statusBadgeVariant(status: string) {
  if (status === 'active') return 'default';
  if (status === 'draft') return 'secondary';
  return 'outline';
}

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);

  const [product, setProduct] = useState<FakeProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [createVariantOpen, setCreateVariantOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/products/${productId}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (!ok) {
          setLoadError(j?.error ? String(j.error) : `Failed to load (HTTP ${status})`);
          setProduct(null);
          return;
        }
        const p = j?.product;
        if (!p) {
          setLoadError('Product not found');
          setProduct(null);
          return;
        }
        const mapped: FakeProduct = {
          id: Number(p.id),
          title: String(p.title),
          status: (p.status as any) ?? 'draft',
          category: (p.category as any) ?? 'apparel',
          vendor: p.vendor ?? null,
          productType: p.productType ?? null,
          handle: p.handle ?? null,
          tags: p.tags ?? null,
          shopifyProductGid: p.shopifyProductGid ?? null,
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
        setProduct(mapped);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e?.message ? String(e.message) : 'Failed to load product');
        setProduct(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!product) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-muted-foreground">
          {loading ? 'Loading…' : loadError ?? 'Product not found.'}
        </div>
        <Button asChild className="mt-4">
          <Link href="/dashboard/products">Back to products</Link>
        </Button>
      </section>
    );
  }

  const defaultVariant =
    product.variants.find((v) => v.id === product.defaultVariantId) ?? null;

  function addVariant(variant: FakeVariant) {
    setProduct((p) => {
      if (!p) return p;
      return {
        ...p,
        variants: [variant, ...p.variants],
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function saveProductPatch(patch: Partial<Pick<FakeProduct, 'title' | 'vendor' | 'productType' | 'handle' | 'tags' | 'shopifyProductGid' | 'category' | 'status'>>) {
    const current = product;
    if (!current) return;
    setLoadError(null);
    const res = await fetch(`/api/products/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLoadError(data?.error ? String(data.error) : `Save failed (HTTP ${res.status})`);
      return;
    }
    // Re-fetch to keep variants/options in sync.
    setLoading(true);
    fetch(`/api/products/${current.id}`)
      .then((r) => r.json())
      .then((j) => {
        const p = j?.product;
        if (!p) return;
        setProduct((prev) =>
          prev
            ? {
                ...prev,
                title: p.title,
                status: p.status,
                category: p.category,
                vendor: p.vendor,
                productType: p.productType,
                handle: p.handle,
                tags: p.tags,
                shopifyProductGid: p.shopifyProductGid,
                defaultVariantId: p.defaultVariantId ?? prev.defaultVariantId,
                options: Array.isArray(p.options) ? p.options : prev.options,
                variants: Array.isArray(p.variants) ? p.variants : prev.variants,
                updatedAt: p.updatedAt ?? prev.updatedAt,
              }
            : prev
        );
      })
      .finally(() => setLoading(false));
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
          <div>
            <h1 className="text-lg lg:text-2xl font-medium">{product.title}</h1>
            <div className="mt-2 flex gap-2 items-center flex-wrap">
              <Badge
                variant={statusBadgeVariant(product.status)}
                className="capitalize"
              >
                {product.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {product.category}
              </Badge>
              {product.shopifyProductGid ? (
                <Badge>Shopify linked</Badge>
              ) : (
                <Badge variant="outline">Not linked</Badge>
              )}
              {defaultVariant ? (
                <span className="text-xs text-muted-foreground">
                  Default variant:{' '}
                  <span className="font-medium">{defaultVariant.title}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/products">Back</Link>
            </Button>

            <CreateVariantDialog
              open={createVariantOpen}
              onOpenChange={setCreateVariantOpen}
              product={product}
              onCreate={addVariant}
            />

            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => setLinkOpen(true)}
            >
              {product.shopifyProductGid ? 'Manage Shopify link' : 'Link Shopify'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <Tabs defaultValue="variants">
            <TabsList>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="sync">Sync</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="mt-4">
              <VariantsTable product={product} onChange={setProduct} />
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Product details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="product-title">Title</FieldLabel>
                      <Input
                        id="product-title"
                        value={product.title}
                        onChange={(e) =>
                          setProduct({ ...product, title: e.target.value })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="product-vendor">Vendor</FieldLabel>
                        <Input
                          id="product-vendor"
                          value={product.vendor ?? ''}
                          onChange={(e) =>
                            setProduct({
                              ...product,
                              vendor: e.target.value || null,
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="product-type">
                          Product type
                        </FieldLabel>
                        <Input
                          id="product-type"
                          value={product.productType ?? ''}
                          onChange={(e) =>
                            setProduct({
                              ...product,
                              productType: e.target.value || null,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="product-handle">Handle</FieldLabel>
                        <Input
                          id="product-handle"
                          value={product.handle ?? ''}
                          onChange={(e) =>
                            setProduct({
                              ...product,
                              handle: e.target.value || null,
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="product-tags">Tags</FieldLabel>
                        <Input
                          id="product-tags"
                          value={product.tags ?? ''}
                          onChange={(e) =>
                            setProduct({
                              ...product,
                              tags: e.target.value || null,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </FieldGroup>

                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        saveProductPatch({
                          title: product.title,
                          vendor: product.vendor ?? null,
                          productType: product.productType ?? null,
                          handle: product.handle ?? null,
                          tags: product.tags ?? null,
                        })
                      }
                      disabled={loading}
                    >
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="description" className="mt-4">
              <ProductDescription
                productId={product.id}
                isShopifyLinked={!!product.shopifyProductGid}
                onRequestLinkShopify={() => setLinkOpen(true)}
              />
            </TabsContent>

            <TabsContent value="sync" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sync (placeholder)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  This will later sync the variant’s selected image/text to
                  Shopify.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <LinkShopifyDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title={product.shopifyProductGid ? 'Manage Shopify product link' : 'Link Shopify product'}
        label="Shopify Product GID"
        value={product.shopifyProductGid ?? ''}
        placeholder="gid://shopify/Product/..."
        onSave={(gid) => saveProductPatch({ shopifyProductGid: gid || null })}
        onUnlink={() => saveProductPatch({ shopifyProductGid: null })}
      />
    </section>
  );
}


