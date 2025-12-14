'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type DescriptionVersion = {
  id: number;
  productId: number;
  createdAt: string;
  status: 'generating' | 'ready' | 'failed';
  prompt: string;
  tone?: string | null;
  length?: string | null;
  content: string;
};

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
  version: DescriptionVersion | null;
  initialEditMode?: boolean;
  onSave?: (id: number, content: string) => Promise<void>;
}) {
  const v = props.version;
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset editing state when dialog opens/closes or version changes
  useEffect(() => {
    if (props.open && v) {
      setEditContent(v.content);
      // Start in edit mode if initialEditMode is true
      setEditing(props.initialEditMode ?? false);
    }
  }, [props.open, v, props.initialEditMode]);

  async function handleSave() {
    if (!v || !props.onSave) return;
    setSaving(true);
    try {
      await props.onSave(v.id, editContent);
      setEditing(false);
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Description' : 'View Description'}
          </DialogTitle>
        </DialogHeader>

        <Textarea
          value={editing ? editContent : (v?.content ?? '')}
          onChange={(e) => setEditContent(e.target.value)}
          readOnly={!editing}
          className="min-h-[240px] resize-none"
          placeholder={editing ? 'Enter your product description...' : ''}
        />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={async () => {
                if (!v) return;
                await copyToClipboard(editing ? editContent : v.content);
              }}
              disabled={!v}
            >
              Copy
            </Button>
          </div>
          
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditContent(v?.content ?? '');
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !editContent.trim()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                {props.onSave && (
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    disabled={!v}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => props.onOpenChange(false)}
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
