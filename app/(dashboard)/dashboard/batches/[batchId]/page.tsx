"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2Icon, PauseIcon, PlayIcon, RefreshCwIcon } from "lucide-react";

type BatchStatus = "queued" | "running" | "paused" | "success" | "failed" | "canceled";

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
  status: BatchStatus;
  settings: any;
  variantCount: number;
  imageCount: number;
  folderId: number | null;
  createdAt: string;
  completedAt: string | null;
};

type ApiJobRow = {
  job: {
    id: number;
    status: string;
    error: string | null;
    progress: any;
    metadata: any;
    createdAt: string;
  };
  product: { id: number; title: string };
  variant: { id: number; title: string; imageUrl: string | null };
};

type ApiBatchDetail = {
  batch: ApiBatch;
  progress: BatchProgress;
  jobs: ApiJobRow[];
  outputs: Array<{ id: number; url: string; createdAt: string }>;
};

function statusBadge(status: BatchStatus) {
  switch (status) {
    case "success":
      return <Badge variant="secondary">Success</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "paused":
      return <Badge variant="outline">Paused</Badge>;
    case "running":
      return <Badge variant="outline">Running</Badge>;
    case "queued":
      return <Badge variant="outline">Queued</Badge>;
    case "canceled":
      return <Badge variant="outline">Canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ batchId: string }>();
  const batchId = params?.batchId ? String(params.batchId) : "";

  const { data, error, isLoading } = useSWR<ApiBatchDetail>(
    batchId ? `/api/batches/${batchId}` : null,
    {
      refreshInterval: (d) => {
        const s = d?.batch?.status;
        return s === "queued" || s === "running" ? 3000 : 0;
      },
    }
  );

  const b = data?.batch ?? null;
  const p = data?.progress ?? null;
  const jobs = Array.isArray(data?.jobs) ? data!.jobs : [];
  const outputs = Array.isArray(data?.outputs) ? data!.outputs : [];

  const totalJobs = p ? p.queued + p.running + p.success + p.failed + p.canceled : 0;
  const doneJobs = p ? p.success + p.failed + p.canceled : 0;
  const pct = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  const errorMessage = error instanceof Error ? error.message : error ? "Failed to load batch" : null;

  async function pauseOrResume() {
    if (!b) return;
    const action = b.status === "paused" ? "resume" : "pause";
    const res = await fetch(`/api/batches/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error ?? `Failed to ${action}`);
    await mutate(`/api/batches/${b.id}`);
    await mutate("/api/batches");
  }

  async function retryFailed() {
    if (!b) return;
    const failed = jobs.filter(
      (j) => String(j.job.status) === "failed" && !j.job.metadata?.retryOfJobId
    );
    if (failed.length === 0) return;

    for (const j of failed) {
      await fetch(`/api/generation-jobs/${j.job.id}/retry`, { method: "POST" });
    }

    await mutate(`/api/batches/${b.id}`);
    await mutate("/api/batches");
  }

  return (
    <section className="flex-1 p-4 pb-0 lg:p-8 lg:pb-0 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg lg:text-2xl font-medium truncate">{b?.name ?? "Batch"}</h1>
            {b ? statusBadge(b.status) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {b ? `${b.variantCount} variants · ${b.imageCount} images` : "Loading…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/batches")}>
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void mutate(`/api/batches/${batchId}`);
            }}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {b && b.status !== "canceled" ? (
            <Button variant="outline" onClick={() => void pauseOrResume()}>
              {b.status === "paused" ? (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
          ) : null}
          <Button
            onClick={() => void retryFailed()}
            disabled={!jobs.some((j) => String(j.job.status) === "failed")}
          >
            Retry failed
          </Button>
        </div>
      </div>

      {errorMessage ? <div className="text-sm text-red-600">{errorMessage}</div> : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Loading batch…
        </div>
      ) : null}

      {p ? (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={pct} />
            <div className="text-sm text-muted-foreground">
              {doneJobs}/{totalJobs} done · {p.running} running · {p.queued} queued · {p.failed} failed
            </div>
          </CardContent>
        </Card>
      ) : null}

      {b ? (
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs rounded-md border bg-muted/30 p-3 overflow-auto max-h-[320px]">
              {JSON.stringify(b.settings ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Outputs</CardTitle>
        </CardHeader>
        <CardContent>
          {outputs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No outputs yet.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {outputs.map((o) => (
                <div key={o.id} className="relative aspect-square rounded-md border overflow-hidden bg-muted">
                  <Image src={o.url} alt="" fill sizes="140px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Job</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No jobs.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((j) => (
                  <TableRow key={j.job.id}>
                    <TableCell>
                      <div className="font-medium">{j.product.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {j.variant.title} · #{j.variant.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(j.job.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[380px] truncate">
                      {j.job.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      #{j.job.id}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}


