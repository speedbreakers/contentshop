"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EllipsisVerticalIcon, Loader2Icon, PauseIcon, PlayIcon, PlusIcon, TrashIcon } from "lucide-react";
import { mutate } from "swr";

type BatchProgress = {
  queued: number;
  running: number;
  success: number;
  failed: number;
  canceled: number;
};

type ApiBatch = {
  id: number;
  name: string;
  status: "queued" | "running" | "paused" | "success" | "failed" | "canceled";
  variantCount: number;
  imageCount: number;
  folderId: number | null;
  createdAt: string;
  completedAt: string | null;
  progress?: BatchProgress;
};

function statusBadge(status: ApiBatch["status"]) {
  switch (status) {
    case "success":
      return <Badge variant="secondary">Success</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "running":
      return <Badge variant="outline">Running</Badge>;
    case "queued":
      return <Badge variant="outline">Queued</Badge>;
    case "paused":
      return <Badge variant="outline">Paused</Badge>;
    case "canceled":
      return <Badge variant="outline">Canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function BatchesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<{ items: ApiBatch[] }>("/api/batches");
  const items = Array.isArray(data?.items) ? data!.items : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) => (b.name ?? "").toLowerCase().includes(q));
  }, [items, query]);

  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to load batches" : null;

  return (
    <section className="flex-1 p-4 pb-0 lg:p-8 lg:pb-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">Batches</h1>
          <p className="text-sm text-muted-foreground">
            Run generation across multiple variants with per-variant image selection.
          </p>
        </div>

        <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
          <Link href="/dashboard/batches/new">
            <PlusIcon className="h-4 w-4 mr-2" />
            New batch
          </Link>
        </Button>
      </div>

      <Card className="h-[calc(100dvh-200px)] min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>All batches</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex gap-3 mb-4 shrink-0">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
            />
          </div>

          {actionError ? (
            <div className="text-sm text-red-600 mb-3 shrink-0">{actionError}</div>
          ) : null}

          {errorMessage ? (
            <div className="text-sm text-red-600 mb-3 shrink-0">{errorMessage}</div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-auto pr-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Loading…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => {
                    const p = b.progress ?? {
                      queued: 0,
                      running: 0,
                      success: 0,
                      failed: 0,
                      canceled: 0,
                    };
                    const totalJobs = p.queued + p.running + p.success + p.failed + p.canceled;
                    const doneJobs = p.success + p.failed + p.canceled;
                    const pct = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

                    return (
                      <TableRow
                        key={b.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/dashboard/batches/${b.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/dashboard/batches/${b.id}`);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground">
                            #{b.id}
                          </div>
                        </TableCell>
                        <TableCell>{b.variantCount ?? "—"}</TableCell>
                        <TableCell>{b.imageCount ?? "—"}</TableCell>
                        <TableCell>{statusBadge(b.status)}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <Progress value={pct} />
                            <div className="text-xs text-muted-foreground">
                              {doneJobs}/{totalJobs} done · {p.failed} failed
                            </div>
                          </div>
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
                              {b.status === "paused" ? (
                                <DropdownMenuItem
                                  onSelect={async () => {
                                    setActionError(null);
                                    const res = await fetch(`/api/batches/${b.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "resume" }),
                                    });
                                    const data = await res.json().catch(() => null);
                                    if (!res.ok) {
                                      setActionError(data?.error ?? "Failed to resume batch");
                                      return;
                                    }
                                    mutate("/api/batches");
                                  }}
                                >
                                  <PlayIcon className="mr-2 size-4" />
                                  Resume
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={async () => {
                                    setActionError(null);
                                    const res = await fetch(`/api/batches/${b.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "pause" }),
                                    });
                                    const data = await res.json().catch(() => null);
                                    if (!res.ok) {
                                      setActionError(data?.error ?? "Failed to pause batch");
                                      return;
                                    }
                                    mutate("/api/batches");
                                  }}
                                >
                                  <PauseIcon className="mr-2 size-4" />
                                  Pause
                                </DropdownMenuItem>
                              )}

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start px-2 text-red-600"
                                  >
                                    <TrashIcon className="mr-2 size-4" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete batch?
                                    </AlertDialogTitle>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        setActionError(null);
                                        const res = await fetch(`/api/batches/${b.id}`, { method: "DELETE" });
                                        const data = await res.json().catch(() => null);
                                        if (!res.ok) {
                                          setActionError(data?.error ?? "Failed to delete batch");
                                          return;
                                        }
                                        mutate("/api/batches");
                                      }}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}


