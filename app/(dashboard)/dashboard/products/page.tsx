'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { fakeProducts, FakeProduct } from '@/lib/fake/products';
import { EllipsisVerticalIcon } from 'lucide-react';

function statusBadgeVariant(status: string) {
  if (status === 'active') return 'default';
  if (status === 'draft') return 'secondary';
  return 'outline';
}

export default function ProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FakeProduct[]>(() =>
    structuredClone(fakeProducts)
  );
  const [query, setQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'apparel' | 'electronics' | 'jewellery'>('apparel');
  const [newVendor, setNewVendor] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newTags, setNewTags] = useState('');

  const [linkProductId, setLinkProductId] = useState<number | null>(null);
  const [linkGid, setLinkGid] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = `${p.title} ${p.handle ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  function createProduct() {
    const title = newTitle.trim();
    if (!title) return;

    const productId = Math.floor(Date.now() / 1000);
    const defaultVariantId = productId * 10 + 1;
    const now = new Date().toISOString();

    const product: FakeProduct = {
      id: productId,
      title,
      status: 'draft',
      category: newCategory,
      vendor: newVendor || null,
      productType: newProductType || null,
      handle: newHandle || null,
      tags: newTags || null,
      shopifyProductGid: null,
      defaultVariantId,
      options: [],
      variants: [
        {
          id: defaultVariantId,
          productId,
          title: 'Default',
          sku: null,
          shopifyVariantGid: null,
          optionValues: [],
          updatedAt: now,
        },
      ],
      updatedAt: now,
    };

    setItems((prev) => [product, ...prev]);
    setCreateOpen(false);
    setNewTitle('');
    setNewCategory('apparel');
    setNewVendor('');
    setNewProductType('');
    setNewHandle('');
    setNewTags('');
  }

  function openLink(product: FakeProduct) {
    setLinkProductId(product.id);
    setLinkGid(product.shopifyProductGid ?? '');
  }

  function saveLink() {
    if (!linkProductId) return;
    setItems((prev) =>
      prev.map((p) =>
        p.id === linkProductId
          ? {
              ...p,
              shopifyProductGid: linkGid.trim() || null,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setLinkProductId(null);
    setLinkGid('');
  }

  function deleteProduct(productId: number) {
    setItems((prev) => prev.filter((p) => p.id !== productId));
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage products, variants, and Shopify links.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              New product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create product</DialogTitle>
            </DialogHeader>

            <FieldGroup>
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
                <RadioGroup
                  value={newCategory}
                  onValueChange={(v) => setNewCategory(v as any)}
                  className="grid grid-cols-1 gap-2"
                >
                  <label className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40 cursor-pointer">
                    <RadioGroupItem value="apparel" />
                    <span className="text-sm">Apparel</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40 cursor-pointer">
                    <RadioGroupItem value="electronics" />
                    <span className="text-sm">Electronics</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/40 cursor-pointer">
                    <RadioGroupItem value="jewellery" />
                    <span className="text-sm">Jewellery</span>
                  </label>
                </RadioGroup>
                <FieldDescription>
                  Category controls the generation form shown on variants.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="create-product-vendor">Vendor</FieldLabel>
                <Input
                  id="create-product-vendor"
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                  placeholder="ACME"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-product-type">Product type</FieldLabel>
                <Input
                  id="create-product-type"
                  value={newProductType}
                  onChange={(e) => setNewProductType(e.target.value)}
                  placeholder="Apparel"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-product-handle">Handle</FieldLabel>
                <Input
                  id="create-product-handle"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="classic-cotton-tshirt"
                />
                <FieldDescription>SEO-friendly slug. Optional for now.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="create-product-tags">Tags</FieldLabel>
                <Input
                  id="create-product-tags"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="tshirt,cotton,basics"
                />
                <FieldDescription>Comma-separated. Optional.</FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createProduct}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>All products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or handle…"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Shopify</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
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
                    <TableCell>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.handle ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(p.status)}
                        className="capitalize"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.variants.length}</TableCell>
                    <TableCell>
                      {p.shopifyProductGid ? (
                        <Badge>Linked</Badge>
                      ) : (
                        <Badge variant="outline">Not linked</Badge>
                      )}
                    </TableCell>

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
                          <DropdownMenuItem onClick={() => openLink(p)}>
                            Link Shopify
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
        </CardContent>
      </Card>

      <Dialog
        open={linkProductId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLinkProductId(null);
            setLinkGid('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Shopify product</DialogTitle>
          </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="link-shopify-product-gid">
              Shopify Product GID
            </FieldLabel>
            <Input
              id="link-shopify-product-gid"
              value={linkGid}
              onChange={(e) => setLinkGid(e.target.value)}
              placeholder="gid://shopify/Product/..."
            />
            <FieldDescription>Paste a Shopify GraphQL product gid.</FieldDescription>
          </Field>
        </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkProductId(null)}>
              Cancel
            </Button>
            <Button onClick={saveLink}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


