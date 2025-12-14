export type FakeProductStatus = 'draft' | 'active' | 'archived';

export type FakeProductCategory = 'apparel' | 'electronics' | 'jewellery';

export type FakeProductOption = {
  id: number;
  name: string;
  position: 1 | 2 | 3;
};

export type FakeVariantOptionValue = {
  productOptionId: number;
  value: string;
};

export type FakeVariant = {
  id: number;
  productId: number;
  title: string;
  sku?: string | null;
  shopifyVariantGid?: string | null;
  optionValues: FakeVariantOptionValue[];
  updatedAt: string; // ISO
};

export type FakeProduct = {
  id: number;
  title: string;
  status: FakeProductStatus;
  category: FakeProductCategory;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  tags?: string | null;
  shopifyProductGid?: string | null;
  defaultVariantId: number;
  options: FakeProductOption[];
  variants: FakeVariant[];
  updatedAt: string; // ISO
};

function isoMinutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

export const fakeProducts: FakeProduct[] = [
  {
    id: 101,
    title: 'Classic Cotton T‑Shirt',
    status: 'active',
    category: 'apparel',
    vendor: 'ACME',
    productType: 'Apparel',
    handle: 'classic-cotton-tshirt',
    tags: 'tshirt,cotton,basics',
    shopifyProductGid: 'gid://shopify/Product/9012345678901',
    defaultVariantId: 1001,
    options: [
      { id: 1, name: 'Color', position: 1 },
      { id: 2, name: 'Size', position: 2 },
    ],
    variants: [
      {
        id: 1001,
        productId: 101,
        title: 'Default',
        sku: null,
        shopifyVariantGid: null,
        optionValues: [],
        updatedAt: isoMinutesAgo(30),
      },
      {
        id: 1002,
        productId: 101,
        title: 'Black / M',
        sku: 'TSHIRT-BLK-M',
        shopifyVariantGid: 'gid://shopify/ProductVariant/8012345678901',
        optionValues: [
          { productOptionId: 1, value: 'Black' },
          { productOptionId: 2, value: 'M' },
        ],
        updatedAt: isoMinutesAgo(50),
      },
      {
        id: 1003,
        productId: 101,
        title: 'White / L',
        sku: 'TSHIRT-WHT-L',
        shopifyVariantGid: null,
        optionValues: [
          { productOptionId: 1, value: 'White' },
          { productOptionId: 2, value: 'L' },
        ],
        updatedAt: isoMinutesAgo(120),
      },
    ],
    updatedAt: isoMinutesAgo(20),
  },
  {
    id: 102,
    title: 'Minimalist Hoodie',
    status: 'draft',
    category: 'apparel',
    vendor: 'ACME',
    productType: 'Apparel',
    handle: 'minimalist-hoodie',
    tags: 'hoodie,fleece',
    shopifyProductGid: null,
    defaultVariantId: 2001,
    options: [{ id: 1, name: 'Size', position: 1 }],
    variants: [
      {
        id: 2001,
        productId: 102,
        title: 'Default',
        sku: null,
        shopifyVariantGid: null,
        optionValues: [],
        updatedAt: isoMinutesAgo(10),
      },
      {
        id: 2002,
        productId: 102,
        title: 'Size / M',
        sku: 'HOODIE-M',
        shopifyVariantGid: null,
        optionValues: [{ productOptionId: 1, value: 'M' }],
        updatedAt: isoMinutesAgo(12),
      },
    ],
    updatedAt: isoMinutesAgo(10),
  },
  {
    id: 103,
    title: 'Ceramic Mug',
    status: 'active',
    category: 'electronics',
    vendor: 'ACME Home',
    productType: 'Home Goods',
    handle: 'ceramic-mug',
    tags: 'mug,ceramic,kitchen',
    shopifyProductGid: 'gid://shopify/Product/9012345678999',
    defaultVariantId: 3001,
    options: [],
    variants: [
      {
        id: 3001,
        productId: 103,
        title: 'Default',
        sku: 'MUG-DEFAULT',
        shopifyVariantGid: 'gid://shopify/ProductVariant/8012345678999',
        optionValues: [],
        updatedAt: isoMinutesAgo(90),
      },
    ],
    updatedAt: isoMinutesAgo(90),
  },
  {
    id: 104,
    title: 'Leather Wallet',
    status: 'archived',
    category: 'jewellery',
    vendor: 'ACME',
    productType: 'Accessories',
    handle: 'leather-wallet',
    tags: 'wallet,leather',
    shopifyProductGid: null,
    defaultVariantId: 4001,
    options: [{ id: 1, name: 'Color', position: 1 }],
    variants: [
      {
        id: 4001,
        productId: 104,
        title: 'Default',
        sku: null,
        shopifyVariantGid: null,
        optionValues: [],
        updatedAt: isoMinutesAgo(3000),
      },
      {
        id: 4002,
        productId: 104,
        title: 'Brown',
        sku: 'WALLET-BRN',
        shopifyVariantGid: null,
        optionValues: [{ productOptionId: 1, value: 'Brown' }],
        updatedAt: isoMinutesAgo(3100),
      },
    ],
    updatedAt: isoMinutesAgo(3000),
  },
  {
    id: 105,
    title: 'Running Shoes',
    status: 'active',
    category: 'apparel',
    vendor: 'ACME Sport',
    productType: 'Footwear',
    handle: 'running-shoes',
    tags: 'shoes,running',
    shopifyProductGid: null,
    defaultVariantId: 5001,
    options: [
      { id: 1, name: 'Color', position: 1 },
      { id: 2, name: 'Size', position: 2 },
    ],
    variants: [
      {
        id: 5001,
        productId: 105,
        title: 'Default',
        sku: null,
        shopifyVariantGid: null,
        optionValues: [],
        updatedAt: isoMinutesAgo(5),
      },
      {
        id: 5002,
        productId: 105,
        title: 'Red / 9',
        sku: 'SHOE-RED-9',
        shopifyVariantGid: null,
        optionValues: [
          { productOptionId: 1, value: 'Red' },
          { productOptionId: 2, value: '9' },
        ],
        updatedAt: isoMinutesAgo(6),
      },
    ],
    updatedAt: isoMinutesAgo(5),
  },
];

export function getFakeProduct(productId: number) {
  return fakeProducts.find((p) => p.id === productId) ?? null;
}


