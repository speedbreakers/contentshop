'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export type GenerationJobProgress = {
  current: number;
  total: number;
  completedImageIds?: number[];
};

export type GenerationJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';

export interface GenerationJobData {
  id: number;
  type: string;
  status: GenerationJobStatus;
  progress?: GenerationJobProgress | null;
  error?: string | null;
  metadata?: {
    zipUrl?: string;
    numberOfVariations?: number;
    [key: string]: unknown;
  } | null;
  generationId?: number | null;
  createdAt: string;
  completedAt?: string | null;
}

interface GenerationProgressProps {
  job: GenerationJobData;
  onRetry?: (jobId: number) => Promise<void>;
  onClose?: () => void;
  isRetrying?: boolean;
}

export function GenerationProgress({
  job,
  onRetry,
  onClose,
  isRetrying = false,
}: GenerationProgressProps) {
  const { status, progress, error, metadata } = job;
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 1;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const numberOfVariations = metadata?.numberOfVariations ?? total;
  const hasZipUrl = Boolean(metadata?.zipUrl);

  const handleRetry = async () => {
    if (onRetry) {
      await onRetry(job.id);
    }
  };

  const handleDownloadZip = () => {
    window.open(`/api/generation-jobs/${job.id}/download`, '_blank');
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
      {/* Status header */}
      <div className="flex items-center gap-x-2 flex-1">
        {status === 'queued' && (
          <>
            <Clock className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">Queued</span>
            <span className="text-muted-foreground text-sm">- Waiting to start...</span>
          </>
        )}
        {status === 'running' && (
          <>
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="font-medium">Generating</span>
            <span className="text-muted-foreground text-sm">
              ({current} of {total} images)
            </span>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="font-medium text-green-700 dark:text-green-400">Complete</span>
            <span className="text-muted-foreground text-sm">
              (Generated {total} image{total !== 1 ? 's' : ''})
            </span>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="font-medium text-red-700 dark:text-red-400">Failed</span>
          </>
        )}
        {status === 'canceled' && (
          <>
            <XCircle className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-muted-foreground">Canceled</span>
          </>
        )}
      </div>

      {/* Progress bar for running jobs */}
      {status === 'running' && (
        <div className="flex-1 flex items-center gap-x-4">
          <Progress value={percentage} className="h-2" />
          <div className="text-sm text-muted-foreground text-right">
            {percentage}%
          </div>
        </div>
      )}

      {/* Error message for failed jobs */}
      {status === 'failed' && error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* Download zip button - only for successful jobs with multiple images */}
        {status === 'success' && hasZipUrl && numberOfVariations > 1 && (
          <Button onClick={handleDownloadZip} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download Zip ({total} images)
          </Button>
        )}

        {/* Retry button - only for failed jobs */}
        {status === 'failed' && onRetry && (
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            size="sm"
            variant={'secondary'}
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </>
            )}
          </Button>
        )}

        {/* Close button */}
        {onClose && (status === 'success' || status === 'failed' || status === 'canceled') && (
          <Button onClick={onClose} variant="ghost" size="sm">
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

