'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { listTemplates, type ContentShopTemplateKind } from '@/lib/templates/content-shop-templates';
import { Loader2Icon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';

export type UploadKind = 'garment' | 'product' | 'model' | 'background';

type LibraryItem = {
  id: number;
  kind: string;
  originalName?: string | null;
  contentType?: string | null;
  size?: number | null;
  createdAt: string;
  url: string; // signed app URL
};

export function AssetPickerField(props: {
  label?: React.ReactNode;
  value: string;
  onChange: (next: string) => void;
  kind: UploadKind;
  allowTemplates?: boolean;
  templateKind?: ContentShopTemplateKind;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'library' | 'templates'>('upload');
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const templates = useMemo(() => {
    if (!props.allowTemplates || !props.templateKind) return [];
    return listTemplates(props.templateKind);
  }, [props.allowTemplates, props.templateKind]);

  useEffect(() => {
    if (!open) return;
    if (activeTab !== 'library') return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/uploads?kind=${encodeURIComponent(props.kind)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLibrary(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setLibrary([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeTab, props.kind]);

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter((i) => (i.originalName ?? '').toLowerCase().includes(q));
  }, [library, query]);

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append('kind', props.kind);
    form.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');

      const url = data?.file?.url;
      if (typeof url === 'string' && url.length > 0) {
        props.onChange(url);
        setOpen(false);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field>
      {props.label ? <FieldLabel>{props.label}</FieldLabel> : null}
      <div className="flex items-center gap-3">
        <div className="group relative h-20 w-20 shrink-0 rounded-md border overflow-hidden bg-muted">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-0 z-10 flex items-center justify-center"
            aria-label={props.value ? 'Change selected image' : 'Choose an image'}
            title={props.value ? 'Change image' : 'Choose image'}
          >
            {props.value ? (
              <Image
                src={props.value}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No image</span>
            )}
          </button>

          {/* Hover affordance when empty */}
          {!props.value ? (
            <div className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/35 flex items-center justify-center">
              <PlusIcon className="h-6 w-6 text-white" />
            </div>
          ) : null}

          {/* When selected: edit + clear actions on the preview */}
          {props.value ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="absolute left-1 bottom-1 z-30 inline-flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Edit image"
                title="Edit image"
              >
                <PencilIcon className="h-3 w-3 text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onChange('');
                }}
                className="absolute right-1 top-1 z-30 inline-flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Clear image"
                title="Clear image"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      {props.description ? <FieldDescription>{props.description}</FieldDescription> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select asset</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
              {props.allowTemplates ? <TabsTrigger value="templates">Templates</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <FieldGroup>
                <Field>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      uploadFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  {uploading ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      Uploading…
                    </div>
                  ) : null}
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="library" className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search uploads…"
                />
                <Button type="button" variant="outline" onClick={() => setActiveTab('upload')}>
                  Upload new
                </Button>
              </div>

              <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : filteredLibrary.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No uploads yet.</div>
                ) : (
                  filteredLibrary.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => {
                        props.onChange(i.url);
                        setOpen(false);
                      }}
                      className="w-full text-left rounded-md border p-2 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md border overflow-hidden bg-muted shrink-0">
                          <Image
                            src={i.url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div title={i.originalName ?? `File ${i.id}`} className="text-sm font-medium truncate text-ellipsis max-w-[200px]">
                            {i.originalName ?? `File ${i.id}`}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {new Date(i.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            {props.allowTemplates ? (
              <TabsContent value="templates" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        props.onChange(t.fileUrl);
                        setOpen(false);
                      }}
                      className="rounded-md border overflow-hidden hover:bg-muted/30 text-left"
                    >
                      <div className="relative h-32 w-full bg-muted">
                        <Image
                          src={t.previewUrl}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">Template</div>
                      </div>
                    </button>
                  ))}
                  {templates.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No templates configured.</div>
                  ) : null}
                </div>
              </TabsContent>
            ) : null}
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading || uploading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Field>
  );
}


