'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
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
  Plus,
  Download,
  Check,
  AlertCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
}

interface CanonicalProduct {
  id: number;
  title: string;
  category: string | null;
  variants: Array<{
    id: number;
    title: string;
    sku: string | null;
  }>;
}

interface VariantLink {
  id: number;
  variantId: number;
  accountId: number;
  externalVariantId: string;
  status: string;
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
    <Image src={src} alt={alt} width={48} height={48} className="h-12 w-12 rounded-md object-cover" />
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

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingVariant, setLinkingVariant] = useState<{
    externalProductId: string;
    externalVariantId: string;
    title: string;
    sku: string | null;
  } | null>(null);
  const [canonicalSearch, setCanonicalSearch] = useState('');
  const [selectedCanonicalVariant, setSelectedCanonicalVariant] = useState<number | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  // Bulk import dialog state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<{
    productsCreated: number;
    variantsLinked: number;
    errors: string[];
  } | null>(null);

  // Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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

  // Fetch unlinked counts for bulk import
  const { data: bulkImportData, mutate: mutateBulkImport } = useSWR<{
    unlinked: { products: number; variants: number };
  }>(
    `/api/commerce/accounts/${accountId}/bulk-import`,
    fetcher
  );

  // Fetch canonical products for link picker
  const { data: canonicalData } = useSWR<{ products: CanonicalProduct[] }>(
    linkDialogOpen && canonicalSearch.trim().length >= 2
      ? `/api/products/search?q=${encodeURIComponent(canonicalSearch.trim())}`
      : null,
    fetcher
  );

  // Fetch variant links for account
  const { data: linksData, mutate: mutateLinks } = useSWR<{ links: VariantLink[] }>(
    `/api/commerce/links/variants?account_id=${accountId}`,
    fetcher
  );

  const account = accountData?.account;
  const products = productsData?.products ?? [];
  const totalProducts = productsData?.pagination?.total ?? 0;
  const unlinkedCounts = bulkImportData?.unlinked ?? { products: 0, variants: 0 };
  const canonicalProducts = canonicalData?.products ?? [];
  const variantLinks = linksData?.links ?? [];

  // Build a map of external variant ID -> link
  const linkMap = new Map<string, VariantLink>();
  for (const link of variantLinks) {
    linkMap.set(link.externalVariantId, link);
  }

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

  function handleBack() {
    router.push('/dashboard/storefronts');
  }

  // Open link dialog
  function openLinkDialog(variant: ExternalVariant, externalProductId: string) {
    setLinkingVariant({
      externalProductId,
      externalVariantId: variant.externalVariantId,
      title: variant.title,
      sku: variant.sku,
    });
    setCanonicalSearch('');
    setSelectedCanonicalVariant(null);
    setLinkDialogOpen(true);
  }

  // Create link
  async function handleCreateLink() {
    if (!linkingVariant || !selectedCanonicalVariant) return;

    setLinkLoading(true);
    try {
      const res = await fetch('/api/commerce/links/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonical_variant_id: selectedCanonicalVariant,
          account_id: accountIdNum,
          external_product_id: linkingVariant.externalProductId,
          external_variant_id: linkingVariant.externalVariantId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create link');
      }

      setNotification({ type: 'success', message: 'Variant linked successfully' });
      setLinkDialogOpen(false);
      mutateLinks();
      mutateBulkImport();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create link',
      });
    } finally {
      setLinkLoading(false);
    }
  }

  // Create canonical product/variant and link (for when canonical doesn't exist yet)
  async function handleCreateCanonicalAndLink() {
    if (!linkingVariant) return;

    setLinkLoading(true);
    try {
      const res = await fetch('/api/commerce/links/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create_canonical_product: true,
          account_id: accountIdNum,
          external_product_id: linkingVariant.externalProductId,
          external_variant_id: linkingVariant.externalVariantId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create canonical product and link');
      }

      setNotification({
        type: 'success',
        message: 'Created canonical product and linked variant successfully',
      });
      setLinkDialogOpen(false);
      mutateLinks();
      mutateBulkImport();
    } catch (err) {
      setNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to create canonical product and link',
      });
    } finally {
      setLinkLoading(false);
    }
  }

  // Delete link
  async function handleUnlink(linkId: number) {
    try {
      const res = await fetch(`/api/commerce/links/variants/${linkId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unlink');
      }

      setNotification({ type: 'success', message: 'Variant unlinked' });
      mutateLinks();
      mutateBulkImport();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to unlink',
      });
    }
  }

  // Bulk import
  async function handleBulkImport() {
    setBulkImportLoading(true);
    setBulkImportResult(null);

    try {
      const res = await fetch(`/api/commerce/accounts/${accountId}/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Bulk import failed');
      }

      if (data.result) {
        setBulkImportResult(data.result);
        mutateLinks();
        mutateBulkImport();
        mutate(`/api/commerce/accounts/${accountId}/products?limit=50${searchParam}`);
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Bulk import failed',
      });
      setBulkImportOpen(false);
    } finally {
      setBulkImportLoading(false);
    }
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
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
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
        {(unlinkedCounts.products > 0 || unlinkedCounts.variants > 0) && (
          <Button onClick={() => setBulkImportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Bulk Import & Link (
            {unlinkedCounts.products > 0 ? unlinkedCounts.products : unlinkedCounts.variants})
          </Button>
        )}
      </div>

      {notification && (
        <Alert
          className={`mb-6 ${
            notification.type === 'success'
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : 'border-red-500 bg-red-50 dark:bg-red-950'
          }`}
        >
          {notification.type === 'success' ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription
            className={
              notification.type === 'success'
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }
          >
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

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
                  linkMap={linkMap}
                  onLink={openLinkDialog}
                  onUnlink={handleUnlink}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Variant</DialogTitle>
            <DialogDescription>
              Link &quot;{linkingVariant?.title}&quot;
              {linkingVariant?.sku && ` (SKU: ${linkingVariant.sku})`} to a canonical variant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
              <div>
                <span className="font-medium text-foreground">Link</span>: Choose an existing
                canonical variant from your catalog (recommended when you already have the product
                in ContentShop).
              </div>
              <div>
                <span className="font-medium text-foreground">Create &amp; Link</span>: Create a
                new canonical product + variant from this external item and link it (use when you
                don&apos;t have it in ContentShop yet).
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search canonical products or SKU..."
                value={canonicalSearch}
                onChange={(e) => setCanonicalSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {canonicalProducts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {canonicalSearch.trim().length < 2
                    ? 'Type at least 2 characters to search your catalog.'
                    : 'No products found.'}
                </div>
              ) : (
                canonicalProducts.map((product) => (
                  <div key={product.id} className="p-2">
                    <div className="font-medium text-sm mb-1">{product.title}</div>
                    <div className="space-y-1">
                      {product.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted',
                            selectedCanonicalVariant === variant.id && 'bg-primary/10'
                          )}
                        >
                          <input
                            type="radio"
                            name="canonical-variant"
                            checked={selectedCanonicalVariant === variant.id}
                            onChange={() => setSelectedCanonicalVariant(variant.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{variant.title}</span>
                          {variant.sku && (
                            <Badge variant="outline" className="text-xs">
                              {variant.sku}
                            </Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleCreateCanonicalAndLink}
              disabled={!linkingVariant || linkLoading}
            >
              {linkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="mr-2 h-4 w-4" />
              Create & Link
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={!selectedCanonicalVariant || linkLoading}
            >
              {linkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Link2 className="mr-2 h-4 w-4" />
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <AlertDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Import & Link</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {bulkImportResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Import Complete!</span>
                    </div>
                    <p>
                      Created {bulkImportResult.productsCreated} products and linked{' '}
                      {bulkImportResult.variantsLinked} variants.
                    </p>
                    {bulkImportResult.errors.length > 0 && (
                      <div className="text-orange-600 text-sm">
                        {bulkImportResult.errors.length} error(s) occurred during import.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p>This will:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Create canonical products for all unlinked external products</li>
                      <li>Create canonical variants for each external variant</li>
                      <li>Automatically link them together</li>
                    </ol>
                    <div className="bg-muted rounded-lg p-3 text-sm">
                      <strong>Found:</strong> {unlinkedCounts.products} unlinked products
                      {unlinkedCounts.variants > 0 && (
                        <>, {unlinkedCounts.variants} unlinked variants</>
                      )}
                    </div>
                    <p className="text-orange-600 text-sm">
                      ⚠ This action cannot be undone easily.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {bulkImportResult ? (
              <AlertDialogAction onClick={() => setBulkImportOpen(false)}>
                Done
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={bulkImportLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkImport}
                  disabled={bulkImportLoading || (unlinkedCounts.products === 0 && unlinkedCounts.variants === 0)}
                >
                  {bulkImportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Download className="mr-2 h-4 w-4" />
                  Import & Link All
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ProductRow({
  product,
  accountId,
  isExpanded,
  onToggle,
  linkMap,
  onLink,
  onUnlink,
}: {
  product: ExternalProduct;
  accountId: number;
  isExpanded: boolean;
  onToggle: () => void;
  linkMap: Map<string, VariantLink>;
  onLink: (variant: ExternalVariant, externalProductId: string) => void;
  onUnlink: (linkId: number) => void;
}) {
  const { data: variantsData, isLoading: variantsLoading } = useSWR<{
    variants: ExternalVariant[];
  }>(
    isExpanded
      ? `/api/commerce/accounts/${accountId}/variants?product_id=${encodeURIComponent(product.externalProductId)}`
      : null,
    fetcher
  );

  const variants = variantsData?.variants ?? [];

  // Check if any variant is linked
  const hasLinkedVariant = variants.some((v) => linkMap.has(v.externalVariantId));

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
                <LinkStatusBadge linked={hasLinkedVariant} />
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
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => {
                    const link = linkMap.get(variant.externalVariantId);
                    const isLinked = !!link;

                    return (
                      <TableRow key={variant.id}>
                        <TableCell>
                          <ProductImage src={variant.featuredImageUrl} alt={variant.title} />
                        </TableCell>
                        <TableCell className="font-medium">{variant.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {variant.sku || '—'}
                        </TableCell>
                        <TableCell>{variant.price ? `$${variant.price}` : '—'}</TableCell>
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
                          <LinkStatusBadge linked={isLinked} />
                        </TableCell>
                        <TableCell>
                          {isLinked ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onUnlink(link.id)}
                            >
                              Unlink
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onLink(variant, product.externalProductId)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Link
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
