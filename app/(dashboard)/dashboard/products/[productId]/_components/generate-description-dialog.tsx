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
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Tone = 'premium' | 'playful' | 'minimal';
type Length = 'short' | 'medium' | 'long';

type DescriptionVersion = {
  id: number;
  productId: number;
  createdAt: string;
  status: 'generating' | 'ready' | 'failed';
  prompt: string;
  tone?: string | null;
  length?: string | null;
  content: string | null;
  errorMessage?: string | null;
};

export function GenerateDescriptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  baseShopifyHtml: string | null;
  onGenerated: (description: DescriptionVersion) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('premium');
  const [length, setLength] = useState<Length>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setPrompt('');
      setTone('premium');
      setLength('medium');
      setIsGenerating(false);
      setError(null);
    }
  }, [props.open]);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating, [prompt, isGenerating]);

  async function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${props.productId}/descriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          tone,
          length,
        }),
      });

      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `Generation failed (HTTP ${res.status})`);
      }

      const description = data?.description as DescriptionVersion | undefined;
      if (!description) {
        throw new Error('No description returned');
      }

      props.onGenerated(description);
      props.onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate new description variation</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="text-sm text-red-600 mb-2">{error}</div>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="desc-prompt">Instructions</FieldLabel>
            <Textarea
              id="desc-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Make it more premium. Focus on comfort and durability. Highlight key features."
              className="min-h-[120px] resize-none"
            />
            <FieldDescription>
              Describe what you want in the product description. The AI will generate content based on your instructions.
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Tone</FieldLabel>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>The style and voice of the description.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Length</FieldLabel>
              <Select value={length} onValueChange={(v) => setLength(v as Length)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (~50 words)</SelectItem>
                  <SelectItem value="medium">Medium (~80-100 words)</SelectItem>
                  <SelectItem value="long">Long (~150-200 words)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>How detailed the description should be.</FieldDescription>
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
              <FieldDescription>Read-only context that may inform the generation.</FieldDescription>
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
