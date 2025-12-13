'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

export function LinkShopifyDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  onUnlink?: () => void;
}) {
  const [local, setLocal] = useState(props.value);

  useEffect(() => {
    if (props.open) setLocal(props.value);
  }, [props.open, props.value]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="link-shopify-gid">{props.label}</FieldLabel>
            <Input
              id="link-shopify-gid"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder={props.placeholder}
            />
            <FieldDescription>Paste a Shopify GraphQL gid.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          {props.onUnlink ? (
            <Button
              variant="destructive"
              onClick={() => {
                props.onUnlink?.();
                props.onOpenChange(false);
              }}
              disabled={!props.value}
            >
              Unlink
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              props.onSave(local.trim());
              props.onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


