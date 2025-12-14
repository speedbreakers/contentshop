'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

type OverageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usageType: 'image' | 'text';
  overageCount: number;
  overageCost: number; // in cents
  remaining: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export function OverageDialog({
  open,
  onOpenChange,
  usageType,
  overageCount,
  overageCost,
  remaining,
  onConfirm,
  onCancel,
  isLoading = false,
}: OverageDialogProps) {
  const formattedCost = `$${(overageCost / 100).toFixed(2)}`;
  const unitLabel = usageType === 'image' ? 'image' : 'text generation';
  const unitLabelPlural = usageType === 'image' ? 'images' : 'text generations';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>Credit Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            You&apos;ve used all your included {usageType} credits for this billing period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Included credits remaining
              </span>
              <span className="font-medium">{remaining}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {overageCount > 1 
                  ? `${overageCount} ${unitLabelPlural} at overage rate`
                  : `1 ${unitLabel} at overage rate`
                }
              </span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {formattedCost}
              </span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between">
              <span className="font-medium">Additional charge</span>
              <span className="font-bold text-lg">{formattedCost}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            This amount will be added to your next invoice. You can upgrade your plan to get more included credits at a lower overage rate.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? 'Generating...' : `Continue (${formattedCost})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

