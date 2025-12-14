export type ContentShopTemplateKind = 'model' | 'background';

export type ContentShopTemplate = {
  id: string;
  kind: ContentShopTemplateKind;
  name: string;
  previewUrl: string;
  fileUrl: string;
};

// Mock templates for now. Replace with real Content Shop template URLs later.
export const contentShopTemplates: ContentShopTemplate[] = [
  {
    id: 'bg-studio-white',
    kind: 'background',
    name: 'Studio white sweep',
    previewUrl: 'https://placehold.co/320x200/png?text=Studio+White',
    fileUrl: 'https://placehold.co/1024x768/png?text=Studio+White',
  },
  {
    id: 'bg-neutral-warm',
    kind: 'background',
    name: 'Neutral warm paper',
    previewUrl: 'https://placehold.co/320x200/png?text=Warm+Paper',
    fileUrl: 'https://placehold.co/1024x768/png?text=Warm+Paper',
  },
  {
    id: 'model-front-1',
    kind: 'model',
    name: 'Model front (template)',
    previewUrl: 'https://placehold.co/200x200/png?text=Model+Front',
    fileUrl: 'https://placehold.co/1024x1024/png?text=Model+Front',
  },
];

export function listTemplates(kind: ContentShopTemplateKind) {
  return contentShopTemplates.filter((t) => t.kind === kind);
}


