'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { FakeGeneratedDescriptionVersion } from '@/lib/fake/product-description';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ViewDescriptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: FakeGeneratedDescriptionVersion | null;
  onSelect: (id: number) => void;
}) {
  const v = props.version;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Variation</DialogTitle>
        </DialogHeader>

        <Textarea
          value={v?.content ?? ''}
          readOnly
          className="min-h-[180px] resize-none"
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              if (!v) return;
              await copyToClipboard(v.content);
            }}
            disabled={!v}
          >
            Copy
          </Button>
          <Button
            onClick={() => {
              if (!v) return;
              props.onSelect(v.id);
              props.onOpenChange(false);
            }}
            disabled={!v}
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


