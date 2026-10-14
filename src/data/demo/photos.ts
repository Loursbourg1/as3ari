/** Deterministic stand-ins and real example community reported photos. */
const REAL_PHOTOS: Record<string, string> = {
  potatoes: '/examples/potatoes.jpg',
  onions: '/examples/onions.jpg',
  tomatoes: '/examples/tomatoes.jpg',
  garlic: '/examples/garlic.jpg',
};

const CATEGORY_IMAGE_PATHS: Record<string, string> = {
  vegetables: '/category-illustrations/vegetables.svg',
  'meat-poultry': '/category-illustrations/meat-poultry.svg',
  fish: '/category-illustrations/fish.svg',
  'dairy-eggs': '/category-illustrations/dairy-eggs.svg',
  'grains-legumes': '/category-illustrations/grains-legumes.svg',
  bakery: '/category-illustrations/bakery.svg',
  pantry: '/category-illustrations/pantry.svg',
  desserts: '/category-illustrations/desserts.svg',
  drinks: '/category-illustrations/drinks.svg',
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
  return CATEGORY_IMAGE_PATHS[categoryId] ?? '/category-illustrations/pantry.svg';
}

export function demoPhotoUrl(productId: string, priceLabel: string): string {
  void priceLabel;
  if (REAL_PHOTOS[productId]) {
    return REAL_PHOTOS[productId]!;
  }
  const categoryId = PRODUCT_CATEGORY_FALLBACKS[productId] ?? 'pantry';
  return categoryImageUrl(categoryId);
}
