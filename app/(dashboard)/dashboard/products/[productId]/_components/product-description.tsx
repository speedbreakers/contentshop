'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { getMockProductDescription } from '@/lib/fake/product-description';
import type { FakeGeneratedDescriptionVersion } from '@/lib/fake/product-description';
import { GenerateDescriptionDialog } from './generate-description-dialog';
import { ViewDescriptionDialog } from './view-description-dialog';
import { EllipsisVerticalIcon } from 'lucide-react';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function excerpt(text: string, max = 120) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function ProductDescription(props: {
  productId: number;
  isShopifyLinked: boolean;
  onRequestLinkShopify: () => void;
}) {
  const seed = useMemo(
    () => getMockProductDescription(props.productId),
    [props.productId]
  );

  const [shopifyHtml, setShopifyHtml] = useState<string | null>(
    seed.shopifyDescriptionHtml
  );
  const [versions, setVersions] = useState<FakeGeneratedDescriptionVersion[]>(
    seed.versions
  );
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    seed.selectedVersionId
  );

  const [generateOpen, setGenerateOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showShopify, setShowShopify] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const selected = selectedVersionId
    ? versions.find((v) => v.id === selectedVersionId) ?? null
    : null;

  const viewVersion = viewId ? versions.find((v) => v.id === viewId) ?? null : null;
  const deleteVersion = deleteId ? versions.find((v) => v.id === deleteId) ?? null : null;

  function mockRefresh() {
    // Mock “refresh”: if linked, update the HTML slightly.
    if (!props.isShopifyLinked) return;
    const now = new Date().toLocaleString();
    const base = seed.shopifyDescriptionHtml ?? '';
    setShopifyHtml(`${base}\n<p><em>Last refreshed: ${now}</em></p>`);
  }

  function removeVersion(id: number) {
    setVersions((prev) => prev.filter((v) => v.id !== id));
    setDeleteId(null);
    setSelectedVersionId((prev) => (prev === id ? null : prev));
    setViewId((prev) => (prev === id ? null : prev));
  }

  async function mockSyncToShopify(version: FakeGeneratedDescriptionVersion) {
    if (!props.isShopifyLinked) return;
    setSyncMessage('Syncing…');
    // Mock: after a short delay, mark as synced.
    setTimeout(() => {
      const when = new Date().toLocaleString();
      setSyncMessage(`Synced to Shopify (mock) at ${when}`);
    }, 650);
  }

  return (
    <div className="space-y-6">
      {/* Collapsible Shopify description */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Current Shopify Description</CardTitle>
            <div className="mt-2 flex items-center gap-2">
              {props.isShopifyLinked ? (
                <Badge>Linked</Badge>
              ) : (
                <Badge variant="outline">Not linked</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={mockRefresh}
              disabled={!props.isShopifyLinked}
              title={
                props.isShopifyLinked
                  ? 'Mock fetch latest description'
                  : 'Link Shopify product to fetch'
              }
            >
              Fetch latest
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowShopify((v) => !v)}
            >
              {showShopify ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!props.isShopifyLinked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link a Shopify product to fetch the latest description.
              </p>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={props.onRequestLinkShopify}
              >
                Link Shopify
              </Button>
            </div>
          ) : !shopifyHtml ? (
            <p className="text-sm text-muted-foreground">
              No Shopify description loaded yet. Click “Fetch latest”.
            </p>
          ) : showShopify ? (
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="raw">Raw HTML</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-3">
                <div
                  className="text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-2"
                  // This is mock HTML; in production you’d sanitize.
                  dangerouslySetInnerHTML={{ __html: shopifyHtml }}
                />
              </TabsContent>
              <TabsContent value="raw" className="mt-3">
                <Textarea
                  value={shopifyHtml}
                  readOnly
                  className="min-h-[180px] resize-none font-mono text-xs"
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {excerpt(shopifyHtml.replace(/<[^>]+>/g, ' '), 220)}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  await copyToClipboard(shopifyHtml);
                }}
              >
                Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Centered main column */}
      <div className="mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Generated Variations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generate, select, and sync a description to Shopify.
              </p>
              {syncMessage ? (
                <p className="text-xs text-muted-foreground mt-2">{syncMessage}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setGenerateOpen(true)}
              >
                Generate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No variations yet. Generate your first variation.
              </p>
            ) : (
              <div className="space-y-3">
                {versions
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedVersionId === v.id ? (
                            <Badge>Selected</Badge>
                          ) : null}
                          <Badge
                            variant={v.status === 'ready' ? 'secondary' : 'outline'}
                          >
                            {v.status}
                          </Badge>
                          {v.tone ? (
                            <Badge variant="outline">{v.tone}</Badge>
                          ) : null}
                          {v.length ? (
                            <Badge variant="outline">{v.length}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatWhen(v.createdAt)}
                        </p>
                        <p className="text-sm mt-2 break-words">
                          {excerpt(v.content, 200)}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <EllipsisVerticalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewId(v.id)}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedVersionId(v.id)}>
                            Select
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              await copyToClipboard(v.content);
                            }}
                          >
                            Copy
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              if (!props.isShopifyLinked || v.status !== 'ready') return;
                              setSelectedVersionId(v.id);
                              await mockSyncToShopify(v);
                            }}
                            disabled={!props.isShopifyLinked || v.status !== 'ready'}
                          >
                            Sync this to Shopify
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(v.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GenerateDescriptionDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        productId={props.productId}
        baseShopifyHtml={shopifyHtml}
        onGenerate={(draft) => {
          setVersions((prev) => [draft, ...prev]);
        }}
        onFinalize={(final) => {
          setVersions((prev) =>
            prev.map((v) => (v.id === final.id ? final : v))
          );
          setSelectedVersionId((prev) => prev ?? final.id);
        }}
      />

      <ViewDescriptionDialog
        open={viewId !== null}
        onOpenChange={(open) => {
          if (!open) setViewId(null);
        }}
        version={viewVersion}
        onSelect={(id) => setSelectedVersionId(id)}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variation?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteVersion
              ? `This will remove the variation created on ${formatWhen(deleteVersion.createdAt)}.`
              : 'This will remove the selected variation.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) removeVersion(deleteId);
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


