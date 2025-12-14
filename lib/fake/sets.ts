export type FakeSet = {
  id: number;
  variantId: number;
  isDefault: boolean;
  name: string;
  description?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt?: string | null;
};

function isoMinutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

function defaultSetIdForVariant(variantId: number) {
  // Keep stable + avoid collisions with seeded IDs.
  return 80000 + variantId;
}

function buildDefaultSet(variantId: number): FakeSet {
  return {
    id: defaultSetIdForVariant(variantId),
    variantId,
    isDefault: true,
    name: 'Default',
    description: 'All generations (auto-created)',
    createdAt: isoMinutesAgo(500),
    updatedAt: isoMinutesAgo(10),
  };
}

const seededSetsByVariantId: Record<number, FakeSet[]> = {
  1002: [
    {
      id: 50001,
      variantId: 1002,
      isDefault: false,
      name: 'Homepage winners',
      description: 'Shortlist for homepage hero',
      createdAt: isoMinutesAgo(240),
      updatedAt: isoMinutesAgo(30),
    },
    {
      id: 50002,
      variantId: 1002,
      isDefault: false,
      name: 'Holiday shots',
      description: 'Seasonal backgrounds & props',
      createdAt: isoMinutesAgo(180),
      updatedAt: isoMinutesAgo(60),
    },
  ],
  1003: [
    {
      id: 50003,
      variantId: 1003,
      isDefault: false,
      name: 'Studio lighting tests',
      description: null,
      createdAt: isoMinutesAgo(90),
      updatedAt: isoMinutesAgo(20),
    },
  ],
};

export function getMockSets(variantId: number) {
  const seeded = seededSetsByVariantId[variantId] ? [...seededSetsByVariantId[variantId]] : [];
  return [buildDefaultSet(variantId), ...seeded];
}


