'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
// Delete moved to moodboard detail page; no AlertDialog needed here.

type Moodboard = {
  id: number;
  name: string;
  description: string | null;
  styleProfile: any;
  assetsCount?: number;
  updatedAt?: string;
  previewAssets?: Array<{ uploadedFileId: number; url: string; originalName: string | null }>;
};

type UploadItem = {
    id: number;
    originalName?: string | null;
    contentType?: string | null;
    url: string;
};

type MoodboardAsset = {
    id: number;
    uploadedFileId: number;
    originalName?: string | null;
    contentType?: string | null;
    url: string;
};

function safeJson(value: any, fallback: any) {
    if (value && typeof value === 'object') return value;
    return fallback;
}

export default function MoodboardsPage() {
    const router = useRouter();
    const {
        data,
        error: swrError,
        isLoading: loading,
        mutate: mutateMoodboards,
    } = useSWR<{ items: any[] }>('/api/moodboards');

    const error = swrError instanceof Error ? swrError.message : swrError ? 'Failed to load moodboards' : null;

    const items: Moodboard[] = useMemo(() => {
        const list = Array.isArray(data?.items) ? data!.items : [];
        return list.map((m: any) => ({
            id: Number(m.id),
            name: String(m.name),
            description: m.description ?? null,
            styleProfile: m.styleProfile ?? m.style_profile ?? {},
            assetsCount: Number(m.assetsCount ?? 0),
            updatedAt: m.updatedAt ?? null,
            previewAssets: Array.isArray(m.previewAssets) ? m.previewAssets : [],
        }));
    }, [data]);

    const [open, setOpen] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const [assetsOpen, setAssetsOpen] = useState(false);
    const [assetsFor, setAssetsFor] = useState<Moodboard | null>(null);
    const [selectedUploadIds, setSelectedUploadIds] = useState<Record<number, boolean>>({});
    const [uploading, setUploading] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const assetsKey = assetsOpen && assetsFor ? `/api/moodboards/${assetsFor.id}/assets` : null;
    const uploadsKey = assetsOpen ? '/api/uploads?kind=moodboard' : null;

    const {
        data: assetsData,
        isLoading: assetsLoading,
        mutate: mutateAssets,
    } = useSWR<{ items: any[] }>(assetsKey);

    const {
        data: uploadsData,
        isLoading: uploadsLoading,
        mutate: mutateUploads,
    } = useSWR<{ items: any[] }>(uploadsKey);

    const assets: MoodboardAsset[] = useMemo(() => {
        const list = Array.isArray(assetsData?.items) ? assetsData!.items : [];
        return list.map((a: any) => ({
            id: Number(a.id),
            uploadedFileId: Number(a.uploadedFileId),
            originalName: a.originalName ?? null,
            contentType: a.contentType ?? null,
            url: String(a.url),
        }));
    }, [assetsData]);

    const uploads: UploadItem[] = useMemo(() => {
        const list = Array.isArray(uploadsData?.items) ? uploadsData!.items : [];
        return list.map((u: any) => ({
            id: Number(u.id),
            originalName: u.originalName ?? null,
            contentType: u.contentType ?? null,
            url: String(u.url),
        }));
    }, [uploadsData]);

    // Note: list loading is handled by SWR.

    function openCreate() {
        setName('');
        setDescription('');
        setOpen(true);
    }

    async function save() {
        const payload = {
            name: name.trim(),
            description: description.trim() ? description.trim() : null,
            // Keep creation lightweight; typography/assets can be configured on the moodboard page.
            style_profile: {},
        };
        if (!payload.name) return;

        const res = await fetch('/api/moodboards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Save failed (HTTP ${res.status})`);
        setOpen(false);
        await mutateMoodboards();

        // After creating a moodboard, navigate to its dedicated page for asset uploads.
        if (json?.moodboard?.id) {
            router.push(`/dashboard/moodboards/${Number(json.moodboard.id)}`);
        }
    }

    async function openAssets(m: Moodboard) {
        setAssetsFor(m);
        setSelectedUploadIds({});
        setAssetsOpen(true);
    }

    async function attachSelected() {
        if (!assetsFor) return;
        const ids = Object.entries(selectedUploadIds)
            .filter(([, v]) => v)
            .map(([k]) => Number(k))
            .filter((n) => Number.isFinite(n));
        if (ids.length === 0) return;

        const res = await fetch(`/api/moodboards/${assetsFor.id}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploaded_file_ids: ids }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Attach failed (HTTP ${res.status})`);

        setSelectedUploadIds({});
        await Promise.all([mutateAssets(), mutateUploads(), mutateMoodboards()]);
    }

    async function uploadAndAttach(files: FileList | null) {
        if (!assetsFor) return;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const uploadedIds: number[] = [];
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.set('kind', 'moodboard');
                fd.set('file', file);
                const res = await fetch('/api/uploads', { method: 'POST', body: fd });
                const json = await res.json().catch(() => null);
                if (!res.ok) throw new Error(json?.error ?? `Upload failed (HTTP ${res.status})`);
                const id = Number(json?.file?.id);
                if (Number.isFinite(id)) uploadedIds.push(id);
            }

            if (uploadedIds.length > 0) {
                const attachRes = await fetch(`/api/moodboards/${assetsFor.id}/assets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploaded_file_ids: uploadedIds }),
                });
                const attachJson = await attachRes.json().catch(() => null);
                if (!attachRes.ok) throw new Error(attachJson?.error ?? `Attach failed (HTTP ${attachRes.status})`);
            }

            setSelectedUploadIds({});
            await Promise.all([mutateAssets(), mutateUploads(), mutateMoodboards()]);
        } finally {
            setUploading(false);
            // Allow selecting the same file again by resetting the input value.
            if (uploadInputRef.current) uploadInputRef.current.value = '';
        }
    }

    async function detach(assetId: number) {
        if (!assetsFor) return;
        const res = await fetch(`/api/moodboards/${assetsFor.id}/assets/${assetId}`, { method: 'DELETE' });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Remove failed (HTTP ${res.status})`);
        await Promise.all([mutateAssets(), mutateMoodboards()]);
    }

    return (
      <section className="flex-1 p-4 pb-0 lg:p-8 lg:pb-0">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-lg lg:text-2xl font-medium">Moodboards</h1>
            <p className="text-sm text-muted-foreground">
              Moodboards define a reusable visual style (typography + rules) and reference images.
            </p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={openCreate}>
            New moodboard
          </Button>
        </div>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>All moodboards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No moodboards yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((m) => {
                  const sp = safeJson(m.styleProfile, {});
                  const tone = safeJson(sp.typography, {})?.tone ? String(safeJson(sp.typography, {})?.tone) : null;
                  const previews = Array.isArray(m.previewAssets) ? m.previewAssets.slice(0, 4) : [];
                  return (
                    <Card
                      key={m.id}
                      className="overflow-hidden cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => router.push(`/dashboard/moodboards/${m.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/dashboard/moodboards/${m.id}`);
                        }
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">{m.name}</CardTitle>
                            {m.description ? (
                              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {m.description}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground mt-1">
                                No description.
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => router.push(`/dashboard/moodboards/${m.id}`)}
                          >
                            Open
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="outline">{m.assetsCount ?? 0} assets</Badge>
                          {tone ? <Badge variant="outline" className="capitalize">{tone}</Badge> : null}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        <div className="rounded-lg border bg-muted/30 p-2">
                          {previews.length === 0 ? (
                            <div className="h-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              Add assets to see previews
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {Array.from({ length: 4 }).map((_, idx) => {
                                const a = previews[idx];
                                return (
                                  <div
                                    key={idx}
                                    className="relative aspect-square rounded-md border overflow-hidden bg-muted"
                                    title={a?.originalName ?? ''}
                                  >
                                    {a ? (
                                      <Image
                                        src={a.url}
                                        alt=""
                                        fill
                                        sizes="(min-width: 1024px) 64px, 56px"
                                        className="object-cover"
                                      />
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-3">
                          <div className="text-xs text-muted-foreground">
                            {m.updatedAt ? `Updated ${new Date(String(m.updatedAt)).toLocaleDateString()}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">Click to open</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

            {/* Create dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New moodboard</DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="mb-name">Name</FieldLabel>
                            <Input id="mb-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="mb-desc">Description</FieldLabel>
                            <Textarea id="mb-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </Field>

                    </FieldGroup>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={save} disabled={!name.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete moved to moodboard detail page */}

            {/* Assets dialog */}
            <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}>
                <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage assets{assetsFor ? `: ${assetsFor.name}` : ''}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div>
                            <div className="text-sm font-medium mb-2">Current assets</div>
                            {assetsLoading ? (
                                <div className="text-sm text-muted-foreground">Loading…</div>
                            ) : assets.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No assets attached.</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {assets.map((a) => (
                                        <div key={a.id} className="rounded-md border overflow-hidden">
                                            <div className="relative h-28 w-full bg-muted">
                                              <Image
                                                src={a.url}
                                                alt=""
                                                fill
                                                sizes="(min-width: 640px) 25vw, 50vw"
                                                className="object-cover"
                                              />
                                            </div>
                                            <div className="p-2 flex items-center justify-between gap-2">
                                                <div className="text-xs truncate" title={a.originalName ?? ''}>
                                                    {a.originalName ?? `File ${a.uploadedFileId}`}
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => detach(a.id)}>
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-sm font-medium">Add assets</div>
                                <div className="flex items-center gap-2">
                                    <Button size='sm' variant='secondary' onClick={attachSelected} disabled={!assetsFor || Object.keys(selectedUploadIds).length === 0}>
                                        Attach selected
                                    </Button>
                                    <div className="inline-flex items-center gap-2">
                                        <input
                                            ref={uploadInputRef}
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => uploadAndAttach(e.target.files)}
                                            disabled={uploading}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={uploading}
                                            onClick={() => uploadInputRef.current?.click()}
                                        >
                                            {uploading ? 'Uploading…' : 'Upload'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {uploads.length === 0 ? (
                                uploadsLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading…</div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No uploads found.</div>
                                )
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {uploads.map((u) => {
                                        const checked = Boolean(selectedUploadIds[u.id]);
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => setSelectedUploadIds((prev) => ({ ...prev, [u.id]: !checked }))}
                                                className={`rounded-md border overflow-hidden text-left ${checked ? 'ring-2 ring-primary' : ''
                                                    }`}
                                                title={u.originalName ?? ''}
                                            >
                                                <div className="relative h-24 w-full bg-muted">
                                                  <Image
                                                    src={u.url}
                                                    alt=""
                                                    fill
                                                    sizes="(min-width: 640px) 20vw, 50vw"
                                                    className="object-cover"
                                                  />
                                                </div>
                                                <div className="p-2 text-xs truncate">
                                                    {checked ? 'Selected: ' : ''}
                                                    {u.originalName ?? `File ${u.id}`}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssetsOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
      </section>
    );
}


