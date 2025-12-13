'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import type { FakeGeneratedDescriptionVersion } from '@/lib/fake/product-description';

type Tone = 'premium' | 'playful' | 'minimal';
type Length = 'short' | 'medium' | 'long';

function synthesizeContent(args: {
  prompt: string;
  tone: Tone;
  length: Length;
  baseHtml?: string | null;
}) {
  const base = (args.baseHtml ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tonePrefix =
    args.tone === 'premium'
      ? 'Elevated and refined:'
      : args.tone === 'playful'
        ? 'Fun and friendly:'
        : 'Simple and clear:';

  const lengthHint =
    args.length === 'short'
      ? 'Keep it short.'
      : args.length === 'long'
        ? 'Add a bit more detail.'
        : 'Keep it concise.';

  const baseHint = base ? ` Base context: ${base.slice(0, 120)}…` : '';

  return `${tonePrefix} ${args.prompt.trim()} ${lengthHint}${baseHint}`.trim();
}

export function GenerateDescriptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  baseShopifyHtml: string | null;
  onGenerate: (draft: FakeGeneratedDescriptionVersion) => void;
  onFinalize: (final: FakeGeneratedDescriptionVersion) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('premium');
  const [length, setLength] = useState<Length>('medium');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!props.open) {
      setPrompt('');
      setTone('premium');
      setLength('medium');
      setIsGenerating(false);
    }
  }, [props.open]);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating, [prompt, isGenerating]);

  function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    const id = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();

    const draft: FakeGeneratedDescriptionVersion = {
      id,
      productId: props.productId,
      createdAt: now,
      status: 'generating',
      prompt: prompt.trim(),
      tone,
      length,
      content: 'Generating…',
    };

    props.onGenerate(draft);

    setTimeout(() => {
      const final: FakeGeneratedDescriptionVersion = {
        ...draft,
        status: 'ready',
        content: synthesizeContent({
          prompt: draft.prompt,
          tone,
          length,
          baseHtml: props.baseShopifyHtml,
        }),
      };
      props.onFinalize(final);
      setIsGenerating(false);
      props.onOpenChange(false);
    }, 900);
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate new description variation</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="desc-prompt">What should change?</FieldLabel>
            <Textarea
              id="desc-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Make it more premium. Focus on comfort and durability. Keep it under 120 words."
              className="min-h-[120px] resize-none"
            />
            <FieldDescription>
              This is a mock generator for now. Later this will call Vertex AI via the Vercel AI SDK.
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="desc-tone">Tone</FieldLabel>
              <Input
                id="desc-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                placeholder="premium | playful | minimal"
              />
              <FieldDescription>Use: premium, playful, minimal.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="desc-length">Length</FieldLabel>
              <Input
                id="desc-length"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                placeholder="short | medium | long"
              />
              <FieldDescription>Use: short, medium, long.</FieldDescription>
            </Field>
          </div>

          {props.baseShopifyHtml ? (
            <Field>
              <FieldLabel htmlFor="desc-context">Current Shopify description (context)</FieldLabel>
              <Textarea
                id="desc-context"
                value={props.baseShopifyHtml}
                readOnly
                className="min-h-[90px] resize-none font-mono text-xs"
              />
              <FieldDescription>Read-only context used by the generator.</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canSubmit}>
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


