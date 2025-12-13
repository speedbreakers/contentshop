export type FakeAssetStatus = 'ready' | 'generating' | 'failed';
export type FakeAssetKind = 'uploaded' | 'generated';
export type FakeAssetSource = 'shopify' | 'contentshop';

export type FakeVariantAsset = {
  id: number;
  variantId: number;
  createdAt: string; // ISO
  kind: FakeAssetKind;
  status: FakeAssetStatus;
  source: FakeAssetSource;
  url: string;
  isSelected: boolean;
};

export type FakeVariantGeneration = {
  id: number;
  variantId: number;
  createdAt: string; // ISO
  label: string;
  status: 'ready' | 'running' | 'failed';
};

function isoMinutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

function placeholderUrl(label: string, seed: number, size = 640) {
  const safe = encodeURIComponent(label);
  // External placeholder that works without local assets.
  return `https://placehold.co/${size}x${size}/png?text=${safe}&seed=${seed}`;
}

const seededAssetsByVariantId: Record<number, FakeVariantAsset[]> = {
  // Variant with lots of assets (exercise “View all”)
  1002: [
    {
      id: 70001,
      variantId: 1002,
      createdAt: isoMinutesAgo(180),
      kind: 'uploaded',
      status: 'ready',
      source: 'contentshop',
      url: placeholderUrl('Reference', 1, 640),
      isSelected: false,
    },
    {
      id: 70002,
      variantId: 1002,
      createdAt: isoMinutesAgo(120),
      kind: 'generated',
      status: 'ready',
      source: 'contentshop',
      url: placeholderUrl('Gen A', 2, 640),
      isSelected: true,
    },
    {
      id: 70003,
      variantId: 1002,
      createdAt: isoMinutesAgo(118),
      kind: 'generated',
      status: 'ready',
      source: 'contentshop',
      url: placeholderUrl('Gen B', 3, 640),
      isSelected: false,
    },
    {
      id: 70004,
      variantId: 1002,
      createdAt: isoMinutesAgo(60),
      kind: 'generated',
      status: 'ready',
      source: 'shopify',
      url: placeholderUrl('Shopify 1', 4, 640),
      isSelected: false,
    },
    {
      id: 70005,
      variantId: 1002,
      createdAt: isoMinutesAgo(55),
      kind: 'generated',
      status: 'ready',
      source: 'shopify',
      url: placeholderUrl('Shopify 2', 5, 640),
      isSelected: false,
    },
  ],

  // Variant with a couple assets
  1003: [
    {
      id: 71001,
      variantId: 1003,
      createdAt: isoMinutesAgo(200),
      kind: 'uploaded',
      status: 'ready',
      source: 'contentshop',
      url: placeholderUrl('Reference', 11, 640),
      isSelected: false,
    },
    {
      id: 71002,
      variantId: 1003,
      createdAt: isoMinutesAgo(90),
      kind: 'generated',
      status: 'ready',
      source: 'contentshop',
      url: placeholderUrl('Gen 1', 12, 640),
      isSelected: true,
    },
  ],

  // Default-only variant
  3001: [
    {
      id: 73001,
      variantId: 3001,
      createdAt: isoMinutesAgo(1000),
      kind: 'generated',
      status: 'ready',
      source: 'shopify',
      url: placeholderUrl('Shopify Default', 31, 640),
      isSelected: true,
    },
  ],
};

const seededGenerationsByVariantId: Record<number, FakeVariantGeneration[]> = {
  1002: [
    {
      id: 80001,
      variantId: 1002,
      createdAt: isoMinutesAgo(120),
      label: 'generated-image',
      status: 'ready',
    },
    {
      id: 80002,
      variantId: 1002,
      createdAt: isoMinutesAgo(60),
      label: 'campaign folder',
      status: 'ready',
    },
  ],
  1003: [
    {
      id: 81001,
      variantId: 1003,
      createdAt: isoMinutesAgo(90),
      label: 'generated-image',
      status: 'ready',
    },
  ],
};

export function getMockVariantAssets(variantId: number) {
  const assets = seededAssetsByVariantId[variantId]
    ? [...seededAssetsByVariantId[variantId]]
    : [];

  const generations = seededGenerationsByVariantId[variantId]
    ? [...seededGenerationsByVariantId[variantId]]
    : [];

  return { assets, generations };
}


