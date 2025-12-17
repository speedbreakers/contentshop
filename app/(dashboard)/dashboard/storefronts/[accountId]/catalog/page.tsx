'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Search,
  Package,
  ChevronRight,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  Store,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CommerceAccount {
  id: number;
  provider: string;
  displayName: string;
  status: string;
  shopDomain: string | null;
}

interface ExternalProduct {
  id: number;
  externalProductId: string;
  title: string;
  handle: string | null;
  status: string | null;
  productType: string | null;
  vendor: string | null;
  featuredImageUrl: string | null;
  variantCount?: number;
  linkedProductId?: number | null;
  linkedProductName?: string | null;
}

interface ExternalVariant {
  id: number;
  externalProductId: string;
  externalVariantId: string;
  title: string;
  sku: string | null;
  price: string | null;
  featuredImageUrl: string | null;
  selectedOptions: Array<{ name: string; value: string }> | null;
  linkedVariantId?: number | null;
  linkedVariantName?: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  
  const statusLower = status.toLowerCase();
  if (statusLower === 'active') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Active</Badge>;
  }
  if (statusLower === 'draft') {
    return <Badge variant="outline">Draft</Badge>;
  }
  if (statusLower === 'archived') {
    return <Badge variant="secondary">Archived</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function LinkStatusBadge({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
        <Link2 className="mr-1 h-3 w-3" />
        Linked
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Link2Off className="mr-1 h-3 w-3" />
      Unlinked
    </Badge>
  );
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 rounded-md object-cover"
    />
  );
}

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default function ExternalCatalogPage({ params }: PageProps) {
  const router = useRouter();
  const { accountId } = use(params);
  const accountIdNum = parseInt(accountId, 10);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch account details
  const { data: accountData, isLoading: accountLoading } = useSWR<{ account: CommerceAccount }>(
    `/api/commerce/accounts/${accountId}`,
    fetcher
  );

  // Fetch products
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
  const { data: productsData, isLoading: productsLoading } = useSWR<{
    products: ExternalProduct[];
    pagination: { total: number; hasMore: boolean };
  }>(
    `/api/commerce/accounts/${accountId}/products?limit=50${searchParam}`,
    fetcher
  );

  const account = accountData?.account;
  const products = productsData?.products ?? [];
  const totalProducts = productsData?.pagination?.total ?? 0;

  // Toggle product expansion to show variants
  function toggleProduct(productId: number) {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  // Navigate back
  function handleBack() {
    router.push('/dashboard/storefronts');
  }

  if (accountLoading) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (!account) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-center py-12">
          <Store className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Store not found</h3>
          <Button className="mt-4" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Storefronts
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">{account.displayName} Catalog</h1>
          {account.shopDomain && (
            <a
              href={`https://${account.shopDomain}/admin/products`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
            >
              View in Shopify
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>External Products</CardTitle>
              <CardDescription>
                {totalProducts} product{totalProducts !== 1 ? 's' : ''} synced from Shopify.
                Link products to your ContentShop catalog to enable publishing.
              </CardDescription>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, handle, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {debouncedSearch ? 'No products found' : 'No products synced'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {debouncedSearch
                  ? 'Try a different search term.'
                  : 'Run a sync from the storefronts page to import products.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  accountId={accountIdNum}
                  isExpanded={expandedProducts.has(product.id)}
                  onToggle={() => toggleProduct(product.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ProductRow({
  product,
  accountId,
  isExpanded,
  onToggle,
}: {
  product: ExternalProduct;
  accountId: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Fetch variants when expanded
  const { data: variantsData, isLoading: variantsLoading } = useSWR<{
    variants: ExternalVariant[];
  }>(
    isExpanded
      ? `/api/commerce/accounts/${accountId}/variants?product_id=${encodeURIComponent(product.externalProductId)}`
      : null,
    fetcher
  );

  const variants = variantsData?.variants ?? [];

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors">
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
            <ProductImage src={product.featuredImageUrl} alt={product.title} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{product.title}</span>
                <StatusBadge status={product.status} />
                <LinkStatusBadge linked={!!product.linkedProductId} />
              </div>
              <div className="text-sm text-muted-foreground">
                {product.handle && <span>{product.handle}</span>}
                {product.productType && (
                  <>
                    {product.handle && ' · '}
                    <span>{product.productType}</span>
                  </>
                )}
                {product.vendor && (
                  <>
                    {(product.handle || product.productType) && ' · '}
                    <span>{product.vendor}</span>
                  </>
                )}
              </div>
            </div>
            {product.linkedProductName && (
              <div className="text-sm text-muted-foreground">
                → {product.linkedProductName}
              </div>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4">
            {variantsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : variants.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No variants found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"></TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Options</TableHead>
                    <TableHead>Link Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        <ProductImage src={variant.featuredImageUrl} alt={variant.title} />
                      </TableCell>
                      <TableCell className="font-medium">{variant.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {variant.sku || '—'}
                      </TableCell>
                      <TableCell>
                        {variant.price ? `$${variant.price}` : '—'}
                      </TableCell>
                      <TableCell>
                        {variant.selectedOptions && variant.selectedOptions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {variant.selectedOptions.map((opt, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {opt.name}: {opt.value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <LinkStatusBadge linked={!!variant.linkedVariantId} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled>
                          {variant.linkedVariantId ? 'Unlink' : 'Link'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

