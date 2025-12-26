"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/swr/fetcher";
import { Loader2, Pencil, Trash2, Upload as UploadIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import useSWR from "swr";

type Moodboard = {
    id: number;
    name: string;
    description: string | null;
    styleProfile: any;
};

type UploadItem = {
    id: number;
    originalName?: string | null;
    contentType?: string | null;
    url: string;
};

type MoodboardAssetKind = "background" | "model" | "reference_positive" | "reference_negative";

type MoodboardAsset = {
    id: number;
    uploadedFileId: number;
    kind: "background" | "model" | "reference";
    originalName?: string | null;
    contentType?: string | null;
    url: string;
};

function AssetGrid(props: { items: MoodboardAsset[]; emptyLabel: string; size?: "sm" | "md" }) {
    if (props.items.length === 0) {
        return <div className="text-sm text-muted-foreground">{props.emptyLabel}</div>;
    }

    const size = props.size ?? "sm";
    const gridClass =
        size === "sm"
            ? "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2"
            : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3";

    return (
        <div className={gridClass}>
            {props.items.map((a) => (
                <div key={a.id} className="rounded-md border overflow-hidden bg-background">
                    <div className="relative aspect-square">
                        <Image src={a.url} alt={a.originalName ?? `Asset ${a.id}`} fill className="object-cover" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function parseLines(input: string) {
    return input
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function MoodboardDetailPage() {
    const params = useParams<{ moodboardId: string }>();
    const router = useRouter();
    const moodboardId = Number(params.moodboardId);

    const [assetsModalOpen, setAssetsModalOpen] = React.useState(false);
    const [assetsKind, setAssetsKind] = React.useState<MoodboardAssetKind>("background");
    const [selectedUploadIds, setSelectedUploadIds] = React.useState<Record<number, boolean>>({});
    const [addingAssets, setAddingAssets] = React.useState(false);
    const [uploadingAssets, setUploadingAssets] = React.useState(false);
    const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

    const { data: moodboardData, isLoading: loadingMoodboard, mutate: mutateMoodboard } = useSWR<{ moodboard: any }>(
        Number.isFinite(moodboardId) ? `/api/moodboards/${moodboardId}` : null,
        fetchJson
    );

    const moodboard: Moodboard | null = moodboardData?.moodboard
        ? {
            id: Number(moodboardData.moodboard.id),
            name: String(moodboardData.moodboard.name),
            description: moodboardData.moodboard.description ?? null,
            styleProfile: moodboardData.moodboard.styleProfile ?? moodboardData.moodboard.style_profile ?? {},
        }
        : null;

    const { data: bgData, isLoading: loadingBg, mutate: mutateBg } = useSWR<{ items: any[] }>(
        Number.isFinite(moodboardId) ? `/api/moodboards/${moodboardId}/assets?kind=background` : null,
        fetchJson
    );
    const { data: modelData, isLoading: loadingModels, mutate: mutateModels } = useSWR<{ items: any[] }>(
        Number.isFinite(moodboardId) ? `/api/moodboards/${moodboardId}/assets?kind=model` : null,
        fetchJson
    );
    const { data: posRefData, isLoading: loadingPosRefs, mutate: mutatePosRefs } = useSWR<{ items: any[] }>(
        Number.isFinite(moodboardId) ? `/api/moodboards/${moodboardId}/assets?kind=reference_positive` : null,
        fetchJson
    );
    const { data: negRefData, isLoading: loadingNegRefs, mutate: mutateNegRefs } = useSWR<{ items: any[] }>(
        Number.isFinite(moodboardId) ? `/api/moodboards/${moodboardId}/assets?kind=reference_negative` : null,
        fetchJson
    );
    const uploadsKind =
        assetsKind === "background"
            ? "moodboard_background"
            : assetsKind === "model"
                ? "moodboard_model"
                : assetsKind === "reference_positive"
                    ? "moodboard_reference_positive"
                    : "moodboard_reference_negative";

    const { data: uploadsData, isLoading: loadingUploads, mutate: mutateUploads } = useSWR<{ items: any[] }>(
        assetsModalOpen && Number.isFinite(moodboardId) ? `/api/uploads?kind=${uploadsKind}` : null,
        fetchJson
    );

    const backgrounds: MoodboardAsset[] = React.useMemo(() => {
        const list = Array.isArray(bgData?.items) ? bgData!.items : [];
        return list.map((a: any) => ({
            id: Number(a.id),
            uploadedFileId: Number(a.uploadedFileId),
            kind: (a.kind as any) ?? "background",
            originalName: a.originalName ?? null,
            contentType: a.contentType ?? null,
            url: String(a.url),
        }));
    }, [bgData]);

    const models: MoodboardAsset[] = React.useMemo(() => {
        const list = Array.isArray(modelData?.items) ? modelData!.items : [];
        return list.map((a: any) => ({
            id: Number(a.id),
            uploadedFileId: Number(a.uploadedFileId),
            kind: (a.kind as any) ?? "model",
            originalName: a.originalName ?? null,
            contentType: a.contentType ?? null,
            url: String(a.url),
        }));
    }, [modelData]);

    const positiveRefs: MoodboardAsset[] = React.useMemo(() => {
        const list = Array.isArray(posRefData?.items) ? posRefData!.items : [];
        return list.map((a: any) => ({
            id: Number(a.id),
            uploadedFileId: Number(a.uploadedFileId),
            kind: (a.kind as any) ?? "reference_positive",
            originalName: a.originalName ?? null,
            contentType: a.contentType ?? null,
            url: String(a.url),
        }));
    }, [posRefData]);

    const negativeRefs: MoodboardAsset[] = React.useMemo(() => {
        const list = Array.isArray(negRefData?.items) ? negRefData!.items : [];
        return list.map((a: any) => ({
            id: Number(a.id),
            uploadedFileId: Number(a.uploadedFileId),
            kind: (a.kind as any) ?? "reference_negative",
            originalName: a.originalName ?? null,
            contentType: a.contentType ?? null,
            url: String(a.url),
        }));
    }, [negRefData]);

    const uploads: UploadItem[] = React.useMemo(() => {
        const list = Array.isArray(uploadsData?.items) ? uploadsData!.items : [];
        return list.map((u: any) => ({
            id: Number(u.id),
            originalName: u.originalName ?? null,
            contentType: u.contentType ?? null,
            url: String(u.url),
        }));
    }, [uploadsData]);

    const typography = (moodboard?.styleProfile?.typography ?? {}) as Record<string, any>;
    const doNotList = Array.isArray(moodboard?.styleProfile?.do_not) ? (moodboard!.styleProfile.do_not as any[]) : [];

    const [editOpen, setEditOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [editName, setEditName] = React.useState("");
    const [editDescription, setEditDescription] = React.useState("");

    const [editTypographyOpen, setEditTypographyOpen] = React.useState(false);
    const [typoTone, setTypoTone] = React.useState<string>("minimal");
    const [typoFontFamily, setTypoFontFamily] = React.useState<string>("");
    const [typoCase, setTypoCase] = React.useState<string>("sentence");
    const [typoRules, setTypoRules] = React.useState<string>("");
    const [typoDoNot, setTypoDoNot] = React.useState<string>("");
    const [savingTypography, setSavingTypography] = React.useState(false);

    React.useEffect(() => {
        if (!moodboard) return;
        setEditName(moodboard.name);
        setEditDescription(moodboard.description ?? "");
        setTypoTone(String(typography?.tone ?? "minimal"));
        setTypoFontFamily(String(typography?.font_family ?? ""));
        setTypoCase(String(typography?.case ?? "sentence"));
        setTypoRules(Array.isArray(typography?.rules) ? typography.rules.join("\n") : "");
        setTypoDoNot(Array.isArray(doNotList) ? doNotList.join("\n") : "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moodboard?.id]);

    const selectedIds = React.useMemo(
        () => Object.entries(selectedUploadIds).filter(([, v]) => v).map(([k]) => Number(k)),
        [selectedUploadIds]
    );

    function openAssetsModal(kind: MoodboardAssetKind) {
        setAssetsKind(kind);
        const current =
            kind === "background"
                ? backgrounds
                : kind === "model"
                    ? models
                    : kind === "reference_positive"
                        ? positiveRefs
                        : negativeRefs;
        const nextSelected: Record<number, boolean> = {};
        for (const a of current) nextSelected[a.uploadedFileId] = true;
        setSelectedUploadIds(nextSelected);
        setAssetsModalOpen(true);
    }

    async function saveAssetsSelection() {
        if (!Number.isFinite(moodboardId)) return;
        setAddingAssets(true);
        try {
            const currentAssets =
                assetsKind === "background"
                    ? backgrounds
                    : assetsKind === "model"
                        ? models
                        : assetsKind === "reference_positive"
                            ? positiveRefs
                            : negativeRefs;
            const desiredIds = selectedIds;
            const desiredSet = new Set(desiredIds);
            const currentSet = new Set(currentAssets.map((a) => a.uploadedFileId));

            const toRemove = currentAssets.filter((a) => !desiredSet.has(a.uploadedFileId));
            const toAdd = desiredIds.filter((id) => !currentSet.has(id));

            if (toRemove.length > 0) {
                await Promise.all(
                    toRemove.map(async (a) => {
                        const res = await fetch(`/api/moodboards/${moodboardId}/assets/${a.id}`, { method: "DELETE" });
                        const j = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(j?.error ?? `Remove failed (HTTP ${res.status})`);
                    })
                );
            }

            if (toAdd.length > 0) {
                const res = await fetch(`/api/moodboards/${moodboardId}/assets`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uploaded_file_ids: toAdd, kind: assetsKind }),
                });
                const j = await res.json().catch(() => null);
                if (!res.ok) throw new Error(j?.error ?? `Add failed (HTTP ${res.status})`);
            }

            await Promise.all([mutateBg(), mutateModels(), mutatePosRefs(), mutateNegRefs(), mutateMoodboard()]);
            setAssetsModalOpen(false);
        } finally {
            setAddingAssets(false);
        }
    }

    async function uploadAndAddFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        if (!Number.isFinite(moodboardId)) return;
        setUploadingAssets(true);
        try {
            const uploadedIds: number[] = [];
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.set("kind", uploadsKind);
                fd.set("file", file);
                const res = await fetch("/api/uploads", { method: "POST", body: fd });
                const json = await res.json().catch(() => null);
                if (!res.ok) throw new Error(json?.error ?? `Upload failed (HTTP ${res.status})`);
                const id = Number(json?.file?.id);
                if (Number.isFinite(id)) uploadedIds.push(id);
            }

            if (uploadedIds.length > 0) {
                setSelectedUploadIds((prev) => {
                    const next = { ...prev };
                    for (const id of uploadedIds) next[id] = true;
                    return next;
                });
            }
            await mutateUploads();
        } finally {
            setUploadingAssets(false);
            if (uploadInputRef.current) uploadInputRef.current.value = "";
        }
    }

    async function saveMoodboard() {
        if (!moodboard) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/moodboards/${moodboard.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDescription.trim() ? editDescription.trim() : null,
                }),
            });
            const j = await res.json().catch(() => null);
            if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
            setEditOpen(false);
            await mutateMoodboard();
        } finally {
            setSaving(false);
        }
    }

    async function saveTypography() {
        if (!moodboard) return;
        setSavingTypography(true);
        try {
            const nextStyleProfile = {
                ...(moodboard.styleProfile ?? {}),
                typography: {
                    ...(typeof moodboard.styleProfile?.typography === "object" ? moodboard.styleProfile.typography : {}),
                    tone: typoTone,
                    font_family: typoFontFamily,
                    case: typoCase,
                    rules: parseLines(typoRules),
                },
                do_not: parseLines(typoDoNot),
            };

            const res = await fetch(`/api/moodboards/${moodboard.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ style_profile: nextStyleProfile }),
            });
            const j = await res.json().catch(() => null);
            if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
            setEditTypographyOpen(false);
            await mutateMoodboard();
        } finally {
            setSavingTypography(false);
        }
    }

    async function deleteMoodboard() {
        if (!moodboard) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/moodboards/${moodboard.id}`, { method: "DELETE" });
            const j = await res.json().catch(() => null);
            if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
            router.push("/dashboard/moodboards");
        } finally {
            setDeleting(false);
        }
    }

    let uploadsContent: React.ReactNode;
    if (loadingUploads) {
        uploadsContent = (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading uploads…
            </div>
        );
    } else if (uploads.length === 0) {
        uploadsContent = <div className="text-sm text-muted-foreground"></div>;
    } else {
        uploadsContent = (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {uploads.map((u) => (
                    <label
                        key={u.id}
                        className="group rounded-md border overflow-hidden bg-background cursor-pointer"
                        title={u.originalName ?? `Upload ${u.id}`}
                    >
                        <div className="relative aspect-square">
                            <Image src={u.url} alt={u.originalName ?? `Upload ${u.id}`} fill className="object-cover" />
                            <div className="absolute top-1 left-1">
                                <Checkbox
                                    checked={!!selectedUploadIds[u.id]}
                                    onCheckedChange={(checked) =>
                                        setSelectedUploadIds((prev) => ({ ...prev, [u.id]: Boolean(checked) }))
                                    }
                                />
                            </div>
                        </div>
                    </label>
                ))}
            </div>
        );
    }

    return (
        <section className="flex-1 p-4 pb-0 lg:p-8 lg:pb-0">
            <div className="text-sm text-muted-foreground mb-2">
                <Link href="/dashboard/moodboards" className="hover:underline">
                    Moodboards
                </Link>{" "}
                / <span className="text-foreground">{moodboard?.name ?? "…"}</span>
            </div>
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-lg lg:text-2xl font-medium">{moodboard?.name ?? "Moodboard"}</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure typography and reference images used during generation.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!moodboard}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!moodboard}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

                <Card className="p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-medium">Backgrounds</div>
                            <div className="text-xs text-muted-foreground">Background references for strict moodboard mode.</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAssetsModal("background")} disabled={!moodboard}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>

                    <div className="mt-3">
                        {loadingBg ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : (
                            <AssetGrid items={backgrounds} emptyLabel="No background assets yet." size="sm" />
                        )}
                    </div>
                </Card>

                <Card className="p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-medium">Models</div>
                            <div className="text-xs text-muted-foreground">Model references for strict moodboard mode.</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAssetsModal("model")} disabled={!moodboard}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>

                    <div className="mt-3">
                        {loadingModels ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : (
                            <AssetGrid items={models} emptyLabel="No model assets yet." size="sm" />
                        )}
                    </div>
                </Card>

                <Card className="p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-medium">Positive style references</div>
                            <div className="text-xs text-muted-foreground">
                                Images that represent the target style to emulate during generation.
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                                {String(moodboard?.styleProfile?.reference_positive_summary ?? "") || "Summary will appear after saving assets."}
                            </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAssetsModal("reference_positive")} disabled={!moodboard}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>

                    <div className="mt-3">
                        {loadingPosRefs ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : (
                            <AssetGrid items={positiveRefs} emptyLabel="No positive reference assets yet." size="sm" />
                        )}
                    </div>
                </Card>

                <Card className="p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-medium">Negative style references</div>
                            <div className="text-xs text-muted-foreground">
                                Images that represent styles to avoid during generation (strict mode only).
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                                {String(moodboard?.styleProfile?.reference_negative_summary ?? "") || "Summary will appear after saving assets."}
                            </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAssetsModal("reference_negative")} disabled={!moodboard}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>

                    <div className="mt-3">
                        {loadingNegRefs ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : (
                            <AssetGrid items={negativeRefs} emptyLabel="No negative reference assets yet." size="sm" />
                        )}
                    </div>
                </Card>
            </div>

            <Card className="p-3 mt-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="font-medium">Typography Details</div>
                        <div className="text-xs text-muted-foreground">These guide tone, font, and text rules.</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditTypographyOpen(true)} disabled={!moodboard}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mt-3">
                    <div>
                        <div className="text-muted-foreground">Tone</div>
                        <div>{String(typography?.tone ?? "—")}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Font family</div>
                        <div>{String(typography?.font_family ?? "—")}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Case</div>
                        <div>{String(typography?.case ?? "—")}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Rules</div>
                        <div className="whitespace-pre-wrap">{Array.isArray(typography?.rules) ? typography.rules.join("\n") : "—"}</div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="text-muted-foreground">Do not</div>
                        <div className="whitespace-pre-wrap">{doNotList.length ? doNotList.join("\n") : "—"}</div>
                    </div>
                </div>
            </Card>

            {loadingMoodboard && !moodboard ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

            {/* Name/description edit */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit moodboard</DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Name</FieldLabel>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </Field>
                        <Field>
                            <FieldLabel>Description</FieldLabel>
                            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[120px]" />
                        </Field>
                    </FieldGroup>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void saveMoodboard()} disabled={saving || !editName.trim()}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Typography edit */}
            <Dialog open={editTypographyOpen} onOpenChange={setEditTypographyOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit typography</DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel>Tone</FieldLabel>
                                <select
                                    value={typoTone}
                                    onChange={(e) => setTypoTone(e.target.value)}
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
                                <Input value={typoFontFamily} onChange={(e) => setTypoFontFamily(e.target.value)} placeholder="e.g. Inter" />
                            </Field>
                            <Field>
                                <FieldLabel>Case</FieldLabel>
                                <select
                                    value={typoCase}
                                    onChange={(e) => setTypoCase(e.target.value)}
                                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="sentence">Sentence</option>
                                    <option value="title">Title</option>
                                    <option value="upper">Upper</option>
                                </select>
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel>Typography rules (one per line)</FieldLabel>
                            <Textarea value={typoRules} onChange={(e) => setTypoRules(e.target.value)} className="min-h-[140px]" />
                        </Field>
                        <Field>
                            <FieldLabel>Do not (one per line)</FieldLabel>
                            <Textarea value={typoDoNot} onChange={(e) => setTypoDoNot(e.target.value)} className="min-h-[140px]" />
                        </Field>
                    </FieldGroup>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTypographyOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void saveTypography()} disabled={savingTypography}>
                            {savingTypography ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assets edit */}
            <Dialog open={assetsModalOpen} onOpenChange={setAssetsModalOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {assetsKind === "background"
                                ? "Edit backgrounds"
                                : assetsKind === "model"
                                    ? "Edit models"
                                    : assetsKind === "reference_positive"
                                        ? "Edit positive references"
                                        : "Edit negative references"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Card className="p-4">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel>Images</FieldLabel>
                                    <FieldDescription>
                                        Select which images should be included in this section
                                    </FieldDescription>
                                </Field>

                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm text-muted-foreground">
                                        Upload new images directly into this section.
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={uploadInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => void uploadAndAddFiles(e.target.files)}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => uploadInputRef.current?.click()}
                                            disabled={uploadingAssets}
                                        >
                                            <UploadIcon className="h-4 w-4 mr-2" />
                                            {uploadingAssets ? "Uploading…" : "Upload"}
                                        </Button>
                                    </div>
                                </div>

                                {uploadsContent}

                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => void saveAssetsSelection()}
                                        disabled={addingAssets || uploadingAssets || !Number.isFinite(moodboardId)}
                                    >
                                        {addingAssets ? "Saving…" : "Save"}
                                    </Button>
                                </div>
                            </FieldGroup>
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssetsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="outline" onClick={() => openAssetsModal(assetsKind)}>
                            Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete moodboard?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="text-sm text-muted-foreground">This will delete “{moodboard?.name ?? "this moodboard"}”.</div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void deleteMoodboard()} disabled={deleting}>
                            {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}


