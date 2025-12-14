export type FakeSetItemStatus = 'ready' | 'generating' | 'failed';

export type FakeSetItem = {
  id: number;
  setId: number;
  createdAt: string; // ISO
  label: string;
  status: FakeSetItemStatus;
  url: string;
  prompt: string;
  schemaKey?: string;
  input?: any;
  isSelected: boolean;
};

function isoMinutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

function placeholderUrl(label: string, seed: number, size = 640) {
  const safe = encodeURIComponent(label);
  return `https://placehold.co/${size}x${size}/png?text=${safe}&seed=${seed}`;
}

function defaultSetIdForVariant(variantId: number) {
  return 80000 + variantId;
}

const seededItemsBySetId: Record<number, FakeSetItem[]> = {
  // Default sets (auto-created) per variant.
  [defaultSetIdForVariant(1002)]: [
    {
      id: 801001,
      setId: defaultSetIdForVariant(1002),
      createdAt: isoMinutesAgo(35),
      label: 'Default Gen 1',
      status: 'ready',
      url: placeholderUrl('Default Gen 1', 801001, 640),
      prompt: 'Clean studio packshot of the product, soft shadow, premium lighting, white background.',
      isSelected: false,
    },
    {
      id: 801002,
      setId: defaultSetIdForVariant(1002),
      createdAt: isoMinutesAgo(20),
      label: 'Default Gen 2',
      status: 'ready',
      url: placeholderUrl('Default Gen 2', 801002, 640),
      prompt: 'Lifestyle product shot on a neutral surface, natural window light, shallow depth of field.',
      isSelected: false,
    },
  ],
  [defaultSetIdForVariant(1003)]: [
    {
      id: 803001,
      setId: defaultSetIdForVariant(1003),
      createdAt: isoMinutesAgo(18),
      label: 'Default Gen',
      status: 'ready',
      url: placeholderUrl('Default Gen', 803001, 640),
      prompt: 'Centered packshot, high contrast, minimal props, crisp details.',
      isSelected: false,
    },
  ],
  50001: [
    {
      id: 90001,
      setId: 50001,
      createdAt: isoMinutesAgo(70),
      label: 'Gen A',
      status: 'ready',
      url: placeholderUrl('Gen A', 90001, 640),
      prompt: 'Homepage hero composition, bold background gradient, product centered, soft glow.',
      isSelected: true,
    },
    {
      id: 90002,
      setId: 50001,
      createdAt: isoMinutesAgo(60),
      label: 'Gen B',
      status: 'ready',
      url: placeholderUrl('Gen B', 90002, 640),
      prompt: 'Premium studio lighting, subtle vignette, product slightly angled, sharp label.',
      isSelected: false,
    },
    {
      id: 90003,
      setId: 50001,
      createdAt: isoMinutesAgo(50),
      label: 'Gen C',
      status: 'ready',
      url: placeholderUrl('Gen C', 90003, 640),
      prompt: 'Minimalist editorial shot, neutral background, soft shadow, high detail texture.',
      isSelected: false,
    },
  ],
  50002: [
    {
      id: 91001,
      setId: 50002,
      createdAt: isoMinutesAgo(110),
      label: 'Holiday 1',
      status: 'ready',
      url: placeholderUrl('Holiday 1', 91001, 640),
      prompt: 'Holiday themed product photo, warm lighting, subtle snow bokeh, tasteful props.',
      isSelected: false,
    },
    {
      id: 91002,
      setId: 50002,
      createdAt: isoMinutesAgo(90),
      label: 'Holiday 2',
      status: 'ready',
      url: placeholderUrl('Holiday 2', 91002, 640),
      prompt: 'Festive scene, cozy background, soft fairy lights, product in focus.',
      isSelected: false,
    },
  ],
  50003: [
    {
      id: 92001,
      setId: 50003,
      createdAt: isoMinutesAgo(25),
      label: 'Studio test',
      status: 'ready',
      url: placeholderUrl('Studio test', 92001, 640),
      prompt: 'Lighting test: harder key light from top-left, strong shadow, crisp edges.',
      isSelected: true,
    },
  ],
};

export function getMockSetItems(setId: number) {
  return seededItemsBySetId[setId] ? [...seededItemsBySetId[setId]] : [];
}


