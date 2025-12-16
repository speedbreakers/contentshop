'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';

type Moodboard = {
    id: number;
    name: string;
    description: string | null;
    styleProfile: any;
    assetsCount?: number;
    updatedAt?: string;
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
    const [items, setItems] = useState<Moodboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Moodboard | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Minimal v1 style_profile editor: typography + do_not
    const [tone, setTone] = useState<'minimal' | 'bold' | 'luxury' | 'playful' | 'technical'>('minimal');
    const [fontFamily, setFontFamily] = useState('');
    const [textCase, setTextCase] = useState<'sentence' | 'title' | 'upper'>('sentence');
    const [rules, setRules] = useState('');
    const [doNot, setDoNot] = useState('');

    const [assetsOpen, setAssetsOpen] = useState(false);
    const [assetsFor, setAssetsFor] = useState<Moodboard | null>(null);
    const [assets, setAssets] = useState<MoodboardAsset[]>([]);
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [selectedUploadIds, setSelectedUploadIds] = useState<Record<number, boolean>>({});
    const [uploading, setUploading] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const styleProfile = useMemo(() => {
        return {
            typography: {
                tone,
                font_family: fontFamily.trim(),
                case: textCase,
                rules: rules
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
            },
            do_not: doNot
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
        };
    }, [tone, fontFamily, textCase, rules, doNot]);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/moodboards');
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error ?? `Failed to load (HTTP ${res.status})`);
            const list = Array.isArray(json?.items) ? json.items : [];
            setItems(
                list.map((m: any) => ({
                    id: Number(m.id),
                    name: String(m.name),
                    description: m.description ?? null,
                    styleProfile: m.styleProfile ?? m.style_profile ?? {},
                    assetsCount: Number(m.assetsCount ?? 0),
                    updatedAt: m.updatedAt ?? null,
                }))
            );
        } catch (e: any) {
            setError(e?.message ? String(e.message) : 'Failed to load moodboards');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function openCreate() {
        setEditing(null);
        setName('');
        setDescription('');
        setTone('minimal');
        setFontFamily('');
        setTextCase('sentence');
        setRules('');
        setDoNot('');
        setOpen(true);
    }

    function openEdit(m: Moodboard) {
        setEditing(m);
        setName(m.name);
        setDescription(m.description ?? '');
        const sp = safeJson(m.styleProfile, {});
        const typo = safeJson(sp.typography, {});
        setTone((typo.tone as any) ?? 'minimal');
        setFontFamily(String(typo.font_family ?? ''));
        setTextCase((typo.case as any) ?? 'sentence');
        setRules(Array.isArray(typo.rules) ? typo.rules.join('\n') : '');
        setDoNot(Array.isArray(sp.do_not) ? sp.do_not.join('\n') : '');
        setOpen(true);
    }

    async function save() {
        const payload = {
            name: name.trim(),
            description: description.trim() ? description.trim() : null,
            style_profile: styleProfile,
        };
        if (!payload.name) return;

        const res = await fetch(editing ? `/api/moodboards/${editing.id}` : '/api/moodboards', {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Save failed (HTTP ${res.status})`);
        setOpen(false);
        await load();
    }

    async function remove(m: Moodboard) {
        const ok = window.confirm(`Delete moodboard “${m.name}”?`);
        if (!ok) return;
        const res = await fetch(`/api/moodboards/${m.id}`, { method: 'DELETE' });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Delete failed (HTTP ${res.status})`);
        await load();
    }

    async function openAssets(m: Moodboard) {
        setAssetsFor(m);
        setAssetsOpen(true);
        setSelectedUploadIds({});

        const [assetsRes, uploadsRes] = await Promise.all([
            fetch(`/api/moodboards/${m.id}/assets`),
            fetch('/api/uploads?kind=moodboard'),
        ]);
        const assetsJson = await assetsRes.json().catch(() => null);
        const uploadsJson = await uploadsRes.json().catch(() => null);
        if (assetsRes.ok) {
            const list = Array.isArray(assetsJson?.items) ? assetsJson.items : [];
            setAssets(
                list.map((a: any) => ({
                    id: Number(a.id),
                    uploadedFileId: Number(a.uploadedFileId),
                    originalName: a.originalName ?? null,
                    contentType: a.contentType ?? null,
                    url: String(a.url),
                }))
            );
        }
        if (uploadsRes.ok) {
            const list = Array.isArray(uploadsJson?.items) ? uploadsJson.items : [];
            setUploads(
                list.map((u: any) => ({
                    id: Number(u.id),
                    originalName: u.originalName ?? null,
                    contentType: u.contentType ?? null,
                    url: String(u.url),
                }))
            );
        }
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

        // Refresh assets list
        const assetsRes = await fetch(`/api/moodboards/${assetsFor.id}/assets`);
        const assetsJson = await assetsRes.json().catch(() => null);
        if (assetsRes.ok) {
            const list = Array.isArray(assetsJson?.items) ? assetsJson.items : [];
            setAssets(
                list.map((a: any) => ({
                    id: Number(a.id),
                    uploadedFileId: Number(a.uploadedFileId),
                    originalName: a.originalName ?? null,
                    contentType: a.contentType ?? null,
                    url: String(a.url),
                }))
            );
        }
        setSelectedUploadIds({});
        await load();
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

            // Refresh both panes.
            const [assetsRes, uploadsRes] = await Promise.all([
                fetch(`/api/moodboards/${assetsFor.id}/assets`),
                fetch('/api/uploads?kind=moodboard'),
            ]);
            const assetsJson = await assetsRes.json().catch(() => null);
            const uploadsJson = await uploadsRes.json().catch(() => null);

            if (assetsRes.ok) {
                const list = Array.isArray(assetsJson?.items) ? assetsJson.items : [];
                setAssets(
                    list.map((a: any) => ({
                        id: Number(a.id),
                        uploadedFileId: Number(a.uploadedFileId),
                        originalName: a.originalName ?? null,
                        contentType: a.contentType ?? null,
                        url: String(a.url),
                    }))
                );
            }

            if (uploadsRes.ok) {
                const list = Array.isArray(uploadsJson?.items) ? uploadsJson.items : [];
                setUploads(
                    list.map((u: any) => ({
                        id: Number(u.id),
                        originalName: u.originalName ?? null,
                        contentType: u.contentType ?? null,
                        url: String(u.url),
                    }))
                );
            }

            setSelectedUploadIds({});
            await load();
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
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        await load();
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-medium">Moodboards</h1>
                    <div className="text-sm text-muted-foreground">
                        Moodboards define a reusable visual style (typography + rules) and reference images.
                    </div>
                </div>
                <Button onClick={openCreate}>New moodboard</Button>
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No moodboards yet.</div>
                ) : (
                    items.map((m) => (
                        <Card key={m.id}>
                            <CardHeader className="flex flex-row items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="text-base truncate">{m.name}</CardTitle>
                                    {m.description ? (
                                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</div>
                                    ) : null}
                                    <div className="flex gap-2 mt-2">
                                        <Badge variant="outline">{m.assetsCount ?? 0} assets</Badge>
                                        <Badge variant="outline">Typography</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openAssets(m)}>
                                        Assets
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                                        Edit
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => remove(m)}>
                                        Delete
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent />
                        </Card>
                    ))
                )}
            </div>

            {/* Create/Edit dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit moodboard' : 'New moodboard'}</DialogTitle>
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

                        <div className="border-t pt-4">
                            <div className="text-sm font-medium mb-2">Typography (v1)</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel>Tone</FieldLabel>
                                    <select
                                        value={tone}
                                        onChange={(e) => setTone(e.target.value as any)}
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                    >
                                        <option value="minimal">Minimal</option>
                                        <option value="bold">Bold</option>
                                        <option value="luxury">Luxury</option>
                                        <option value="playful">Playful</option>
                                        <option value="technical">Technical</option>
                                    </select>
                                </Field>
                                <Field>
                                    <FieldLabel>Font family</FieldLabel>
                                    <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="e.g. Inter" />
                                </Field>
                                <Field>
                                    <FieldLabel>Case</FieldLabel>
                                    <select
                                        value={textCase}
                                        onChange={(e) => setTextCase(e.target.value as any)}
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                    >
                                        <option value="sentence">Sentence</option>
                                        <option value="title">Title</option>
                                        <option value="upper">Upper</option>
                                    </select>
                                </Field>
                            </div>
                            <Field className="mt-4">
                                <FieldLabel>Typography rules (one per line)</FieldLabel>
                                <Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="e.g. Max 6 words headline" />
                                <FieldDescription>Used heavily for infographics workflows later.</FieldDescription>
                            </Field>
                            <Field className="mt-4">
                                <FieldLabel>Do not (one per line)</FieldLabel>
                                <Textarea value={doNot} onChange={(e) => setDoNot(e.target.value)} placeholder="e.g. No neon colors" />
                            </Field>
                        </div>
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

            {/* Assets dialog */}
            <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}>
                <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage assets{assetsFor ? `: ${assetsFor.name}` : ''}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div>
                            <div className="text-sm font-medium mb-2">Current assets</div>
                            {assets.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No assets attached.</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {assets.map((a) => (
                                        <div key={a.id} className="rounded-md border overflow-hidden">
                                            <img src={a.url} alt="" className="h-28 w-full object-cover" />
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
                                <div className="text-sm text-muted-foreground">No uploads found.</div>
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
                                                <img src={u.url} alt="" className="h-24 w-full object-cover" />
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
        </div>
    );
}


