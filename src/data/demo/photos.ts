/** Deterministic stand-ins and real example community reported photos. */
import {
  faBasketShopping,
  faBreadSlice,
  faCakeCandles,
  faCarrot,
  faDrumstickBite,
  faEgg,
  faFish,
  faGlassWater,
  faWheatAwn,
} from '@fortawesome/free-solid-svg-icons';

const REAL_PHOTOS: Record<string, string> = {
  potatoes: '/examples/potatoes.jpg',
  onions: '/examples/onions.jpg',
  tomatoes: '/examples/tomatoes.jpg',
  garlic: '/examples/garlic.jpg',
};

const CATEGORY_ICONS = {
  vegetables: faCarrot,
  'meat-poultry': faDrumstickBite,
  fish: faFish,
  'dairy-eggs': faEgg,
  'grains-legumes': faWheatAwn,
  bakery: faBreadSlice,
  pantry: faBasketShopping,
  desserts: faCakeCandles,
  drinks: faGlassWater,
};

const PRODUCT_CATEGORY_FALLBACKS: Record<string, string> = {
  potatoes: 'vegetables',
  onions: 'vegetables',
  tomatoes: 'vegetables',
  carrots: 'vegetables',
  zucchini: 'vegetables',
  'green-peppers': 'vegetables',
  garlic: 'vegetables',
  coriander: 'vegetables',
  lentils: 'grains-legumes',
  chickpeas: 'grains-legumes',
  'white-beans': 'grains-legumes',
  rice: 'grains-legumes',
  spaghetti: 'grains-legumes',
  couscous: 'grains-legumes',
  'semolina-fine': 'grains-legumes',
  flour: 'grains-legumes',
  frik: 'grains-legumes',
  'tomato-paste': 'pantry',
  'vegetable-oil': 'pantry',
  sugar: 'pantry',
  eggs: 'dairy-eggs',
  'milk-pasteurised-bag': 'dairy-eggs',
  'milk-uht': 'dairy-eggs',
  'chicken-whole': 'meat-poultry',
  lamb: 'meat-poultry',
  'beef-minced': 'meat-poultry',
  sardines: 'fish',
  baguette: 'bakery',
  baklava: 'desserts',
  'orange-juice': 'drinks',
  water: 'drinks',
};

export function categoryImageUrl(categoryId: string): string {
  const { icon: [width, height, , , paths] } = CATEGORY_ICONS[categoryId as keyof typeof CATEGORY_ICONS] ?? faBasketShopping;
  const canvasSize = 128;
  const iconSize = 72;
  const scale = iconSize / Math.max(width, height);
  const offsetX = (canvasSize - width * scale) / 2;
  const offsetY = (canvasSize - height * scale) / 2;
  const transform = `translate(${offsetX} ${offsetY}) scale(${scale})`;
  const pathMarkup = (Array.isArray(paths) ? paths : [paths])
    .map((path) => `<path fill="#174c30" transform="${transform}" d="${path}"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}"><rect width="${canvasSize}" height="${canvasSize}" fill="#f4f5f6"/>${pathMarkup}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function demoPhotoUrl(productId: string, priceLabel: string): string {
  void priceLabel;
  if (REAL_PHOTOS[productId]) {
    return REAL_PHOTOS[productId]!;
  }
  const categoryId = PRODUCT_CATEGORY_FALLBACKS[productId] ?? 'pantry';
  return categoryImageUrl(categoryId);
}
