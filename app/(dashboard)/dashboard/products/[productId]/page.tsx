'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { fakeProducts, FakeProduct, FakeVariant } from '@/lib/fake/products';
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

  const initial = useMemo(
    () => fakeProducts.find((p) => p.id === productId) ?? null,
    [productId]
  );
  const [product, setProduct] = useState<FakeProduct | null>(() =>
    initial ? structuredClone(initial) : null
  );

  const [linkOpen, setLinkOpen] = useState(false);
  const [createVariantOpen, setCreateVariantOpen] = useState(false);

  if (!product) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-muted-foreground">Product not found.</div>
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

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-2">
          <Link href="/dashboard/products" className="hover:underline">
            Products
          </Link>{' '}
          / {product.title}
        </div>

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
                        setProduct({
                          ...product,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                    >
                      Save (fake)
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
        onSave={(gid) =>
          setProduct({
            ...product,
            shopifyProductGid: gid || null,
            updatedAt: new Date().toISOString(),
          })
        }
        onUnlink={() =>
          setProduct({
            ...product,
            shopifyProductGid: null,
            updatedAt: new Date().toISOString(),
          })
        }
      />
    </section>
  );
}


