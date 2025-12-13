export type FakeDescriptionStatus = 'ready' | 'generating' | 'failed';

export type FakeGeneratedDescriptionVersion = {
  id: number;
  productId: number;
  createdAt: string; // ISO
  status: FakeDescriptionStatus;
  prompt: string;
  tone?: 'premium' | 'playful' | 'minimal';
  length?: 'short' | 'medium' | 'long';
  content: string;
};

const shopifyDescriptionByProductId: Record<number, string> = {
  // linked example product
  101: `<p><strong>Classic Cotton T‑Shirt</strong> — your everyday essential.</p>
<ul>
  <li>Soft, breathable cotton</li>
  <li>Clean fit designed for daily wear</li>
  <li>Easy to style, built to last</li>
</ul>
<p>Made for comfort from morning to night.</p>`,
  103: `<p><strong>Ceramic Mug</strong> — a sturdy, minimalist mug for coffee or tea.</p>
<p>Microwave &amp; dishwasher safe. Comfortable handle. 12oz.</p>`,
};

const seededVersionsByProductId: Record<number, FakeGeneratedDescriptionVersion[]> =
  {
    101: [
      {
        id: 91001,
        productId: 101,
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'premium',
        length: 'medium',
        prompt: 'Make it premium, focus on comfort and durability.',
        content:
          'Meet your new everyday staple. This classic cotton tee pairs a clean silhouette with soft, breathable comfort—made to hold its shape and feel great from morning to night. Easy to style, built for repeat wear.',
      },
      {
        id: 91002,
        productId: 101,
        createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'minimal',
        length: 'short',
        prompt: 'Short, minimal, no hype.',
        content:
          'A classic cotton T‑shirt with a clean fit and comfortable feel. Simple, breathable, and easy to wear.',
      },
      {
        id: 91003,
        productId: 101,
        createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'playful',
        length: 'medium',
        prompt: 'Playful tone, highlight versatility.',
        content:
          'Throw it on, dress it up, wear it out. This cotton tee keeps things comfy and effortless with a fit that works for everything—weekends, errands, and last‑minute plans.',
      },
    ],
    102: [
      {
        id: 92001,
        productId: 102,
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'premium',
        length: 'medium',
        prompt: 'Premium hoodie copy, cozy but refined.',
        content:
          'A minimalist hoodie with a soft hand-feel and a clean finish. Designed for warmth without bulk and built to stay comfortable day after day.',
      },
      {
        id: 92002,
        productId: 102,
        createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'minimal',
        length: 'short',
        prompt: 'Short and straightforward.',
        content:
          'A simple hoodie made for everyday comfort. Soft, warm, and easy to layer.',
      },
    ],
    105: [
      {
        id: 95001,
        productId: 105,
        createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'premium',
        length: 'long',
        prompt: 'Emphasize performance, cushioning, and stability.',
        content:
          'Engineered for smooth miles, these running shoes balance responsive cushioning with stable support. A breathable upper keeps things light, while a confident outsole helps you stay grounded—whether you’re logging daily runs or weekend long distances.',
      },
      {
        id: 95002,
        productId: 105,
        createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        status: 'ready',
        tone: 'minimal',
        length: 'medium',
        prompt: 'Minimal but informative.',
        content:
          'Comfortable running shoes with breathable support and a cushioned ride. Built for daily training.',
      },
    ],
  };

export function getMockProductDescription(productId: number) {
  return {
    shopifyDescriptionHtml: shopifyDescriptionByProductId[productId] ?? null,
    versions: seededVersionsByProductId[productId]
      ? [...seededVersionsByProductId[productId]]
      : [],
    selectedVersionId: seededVersionsByProductId[productId]?.[0]?.id ?? null,
  };
}


