/** Deterministic stand-ins and real example community reported photos. */
const REAL_PHOTOS: Record<string, string> = {
  potatoes: '/examples/potatoes.jpg',
  onions: '/examples/onions.jpg',
  tomatoes: '/examples/tomatoes.jpg',
  garlic: '/examples/garlic.jpg',
};

const HUES: Record<string, number> = {
  potatoes: 38,
  onions: 28,
  tomatoes: 8,
  carrots: 24,
  zucchini: 92,
  'green-peppers': 130,
  garlic: 48,
  coriander: 140,
  lentils: 18,
  chickpeas: 36,
  'white-beans': 42,
  rice: 46,
  spaghetti: 32,
  couscous: 40,
  'semolina-fine': 44,
  flour: 40,
  frik: 30,
  'tomato-paste': 6,
  'vegetable-oil': 50,
  sugar: 220,
  eggs: 48,
  'milk-pasteurised-bag': 200,
  'milk-uht': 200,
  'chicken-whole': 14,
  lamb: 0,
  'beef-minced': 354,
  sardines: 196,
  baguette: 34,
};

function hueFor(productId: string): number {
  if (HUES[productId] !== undefined) return HUES[productId]!;
  let h = 0;
  for (let i = 0; i < productId.length; i++) h = (h * 31 + productId.charCodeAt(i)) % 360;
  return h;
}

export function demoPhotoUrl(productId: string, priceLabel: string): string {
  if (REAL_PHOTOS[productId]) {
    return REAL_PHOTOS[productId]!;
  }
  const h = hueFor(productId);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${h},48%,32%)"/>
        <stop offset="1" stop-color="hsl(${h},42%,18%)"/>
      </linearGradient>
    </defs>
    <rect width="720" height="960" fill="url(#g)"/>
    <circle cx="360" cy="390" r="170" fill="hsl(${h},55%,46%)"/>
    <circle cx="300" cy="350" r="70" fill="hsl(${h},60%,58%)" opacity="0.55"/>
    <rect x="80" y="680" width="560" height="180" rx="28" fill="rgba(0,0,0,0.35)"/>
    <text x="360" y="755" text-anchor="middle" font-size="64" font-weight="800" fill="#fff" font-family="Inter,Segoe UI,sans-serif">${escapeXml(priceLabel)}</text>
    <text x="360" y="810" text-anchor="middle" font-size="28" fill="rgba(255,255,255,0.85)" font-family="Inter,Segoe UI,sans-serif">DZD</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
