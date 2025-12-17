'use client';

import { useEffect, useState } from 'react';
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
import { GenerateDescriptionDialog } from './generate-description-dialog';
import { ViewDescriptionDialog } from './view-description-dialog';
import { EllipsisVerticalIcon, Loader2Icon } from 'lucide-react';

type DescriptionVersion = {
  id: number;
  productId: number;
  createdAt: string;
  status: 'generating' | 'ready' | 'failed';
  prompt: string;
  tone?: string | null;
  length?: string | null;
  content: string | null;
  errorMessage?: string | null;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopifyHtml, setShopifyHtml] = useState<string | null>(null);
  const [versions, setVersions] = useState<DescriptionVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewEditMode, setViewEditMode] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showShopify, setShowShopify] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load descriptions from API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${props.productId}/descriptions`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (!ok) {
          setError(j?.error ? String(j.error) : `Failed to load (HTTP ${status})`);
          return;
        }
        setVersions(Array.isArray(j?.items) ? j.items : []);
        setSelectedVersionId(j?.selectedDescriptionId ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ? String(e.message) : 'Failed to load descriptions');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.productId]);

  const viewVersion = viewId ? versions.find((v) => v.id === viewId) ?? null : null;
  const deleteVersion = deleteId ? versions.find((v) => v.id === deleteId) ?? null : null;

  function mockRefresh() {
    // Mock "refresh": if linked, update the HTML slightly.
    if (!props.isShopifyLinked) return;
    const now = new Date().toLocaleString();
    const base = shopifyHtml ?? '';
    setShopifyHtml(`${base}\n<p><em>Last refreshed: ${now}</em></p>`);
  }

  async function selectVersion(id: number) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/products/${props.productId}/descriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ select: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? String(data.error) : 'Failed to select');
        return;
      }
      setSelectedVersionId(id);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteVersionById(id: number) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/products/${props.productId}/descriptions/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? String(data.error) : 'Failed to delete');
        return;
      }
      setVersions((prev) => prev.filter((v) => v.id !== id));
      setDeleteId(null);
      if (selectedVersionId === id) {
        setSelectedVersionId(null);
      }
      if (viewId === id) {
        setViewId(null);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function mockSyncToShopify(version: DescriptionVersion) {
    if (!props.isShopifyLinked) return;
    setSyncMessage('Syncing…');
    // Mock: after a short delay, mark as synced.
    setTimeout(() => {
      const when = new Date().toLocaleString();
      setSyncMessage(`Synced to Shopify (mock) at ${when}`);
    }, 650);
  }

  function handleGenerated(description: DescriptionVersion) {
    setVersions((prev) => [description, ...prev]);
    // Auto-select the first ready description if none selected
    if (!selectedVersionId && description.status === 'ready') {
      selectVersion(description.id);
    }
  }

  async function saveDescriptionContent(id: number, content: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/products/${props.productId}/descriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? String(data.error) : 'Failed to save');
        return;
      }
      const updated = data?.description;
      if (updated) {
        setVersions((prev) =>
          prev.map((v) => (v.id === id ? { ...v, content: updated.content } : v))
        );
      }
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Generated variations */}
      <div className="mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Generated Variations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {versions.length} variations
              </p>
              {syncMessage ? (
                <p className="text-xs text-muted-foreground mt-2">{syncMessage}</p>
              ) : null}
              {error ? (
                <p className="text-xs text-red-600 mt-2">{error}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {versions.length !== 0 ? <Button
                onClick={() => setGenerateOpen(true)}
              >
                Generate
              </Button>
                : null}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : versions.length === 0 ? (
              <div className="text-sm text-muted-foreground h-64 w-full flex flex-col items-center justify-center gap-y-4">
                <span className="font-medium text-lg">No variations yet</span>
                <Button
                  onClick={() => setGenerateOpen(true)}
                >
                  Generate
                </Button>
              </div>
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
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {v.tone ? (
                            <Badge>{v.tone}</Badge>
                          ) : null}
                          {v.length ? (
                            <Badge>{v.length}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatWhen(v.createdAt)}
                        </p>
                        <p className="text-sm mt-2 break-words">
                          {v.status === 'generating' ? (
                            <span className="text-muted-foreground italic">Generating…</span>
                          ) : v.status === 'failed' ? (
                            <span className="text-red-600">{v.errorMessage ?? 'Generation failed'}</span>
                          ) : (
                            v.content
                          )}
                        </p>
                      </div>

                      <Button size="sm" variant="outline" disabled={actionLoading} onClick={async () => {
                        if (v.content) await copyToClipboard(v.content);
                      }}>
                        Copy
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" disabled={actionLoading}>
                            <EllipsisVerticalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setViewEditMode(false);
                              setViewId(v.id);
                            }}
                            disabled={v.status !== 'ready'}
                          >
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setViewEditMode(true);
                              setViewId(v.id);
                            }}
                            disabled={v.status !== 'ready'}
                          >
                            Edit
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
        onGenerated={handleGenerated}
      />

      <ViewDescriptionDialog
        open={viewId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewId(null);
            setViewEditMode(false);
          }
        }}
        version={viewVersion ? {
          id: viewVersion.id,
          productId: viewVersion.productId,
          createdAt: viewVersion.createdAt,
          status: viewVersion.status,
          prompt: viewVersion.prompt,
          tone: viewVersion.tone as any,
          length: viewVersion.length as any,
          content: viewVersion.content ?? '',
        } : null}
        initialEditMode={viewEditMode}
        onSave={saveDescriptionContent}
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
                if (deleteId) deleteVersionById(deleteId);
              }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
