import type { Category, DietTag, Dimension, Ingredient, Product } from '../../domain/types';

/**
 * Canonical catalogue (reference data, no prices).
 * Freshness thresholds are per category and documented in docs/DATA.md.
 * min/max unit prices are wide plausibility bounds used to reject absurd reports;
 * they are NOT price estimates.
 */
export const CATEGORIES: Category[] = [
  { id: 'vegetables', name_en: 'Vegetables', name_fr: 'Légumes', name_ar: 'خضر', recent_days: 7, stale_days: 21, sort_order: 1 },
  { id: 'meat-poultry', name_en: 'Meat & poultry', name_fr: 'Viandes & volailles', name_ar: 'لحوم ودواجن', recent_days: 10, stale_days: 30, sort_order: 2 },
  { id: 'fish', name_en: 'Fish', name_fr: 'Poisson', name_ar: 'سمك', recent_days: 5, stale_days: 14, sort_order: 3 },
  { id: 'dairy-eggs', name_en: 'Dairy & eggs', name_fr: 'Produits laitiers & œufs', name_ar: 'حليب وبيض', recent_days: 14, stale_days: 45, sort_order: 4 },
  { id: 'grains-legumes', name_en: 'Grains, pasta & legumes', name_fr: 'Céréales, pâtes & légumineuses', name_ar: 'حبوب وعجائن وبقول', recent_days: 30, stale_days: 90, sort_order: 5 },
  { id: 'bakery', name_en: 'Bread', name_fr: 'Pain', name_ar: 'خبز', recent_days: 14, stale_days: 45, sort_order: 6 },
  { id: 'pantry', name_en: 'Oil & pantry', name_fr: 'Huile & épicerie', name_ar: 'زيت ومواد غذائية', recent_days: 30, stale_days: 90, sort_order: 7 },
  { id: 'desserts', name_en: 'Desserts', name_fr: 'Desserts', name_ar: 'حلويات', recent_days: 14, stale_days: 45, sort_order: 8 },
  { id: 'drinks', name_en: 'Drinks', name_fr: 'Boissons', name_ar: 'مشروبات', recent_days: 7, stale_days: 21, sort_order: 9 },
];

type P = [
  id: string,
  category: string,
  dimension: Dimension,
  names: [string, string, string],
  variant: [string, string, string] | null,
  terms: string[],
  bounds: [string, string],
];

const PRODUCTS_RAW: P[] = [
  ['potatoes', 'vegetables', 'mass', ['Potatoes', 'Pommes de terre', 'بطاطا'], null, ['potato', 'patate', 'batata', 'بطاطس'], ['20', '600']],
  ['onions', 'vegetables', 'mass', ['Onions', 'Oignons', 'بصل'], ['dry', 'sec', 'يابس'], ['onion', 'oignon', 'bsal'], ['20', '600']],
  ['tomatoes', 'vegetables', 'mass', ['Tomatoes', 'Tomates', 'طماطم'], null, ['tomato', 'tomate', 'tmatem'], ['20', '800']],
  ['carrots', 'vegetables', 'mass', ['Carrots', 'Carottes', 'جزر'], null, ['carrot', 'carotte', 'zrodiya', 'زرودية'], ['20', '600']],
  ['zucchini', 'vegetables', 'mass', ['Zucchini', 'Courgettes', 'كوسة'], null, ['courgette', 'squash', 'kousa', 'qar3a', 'قرعة'], ['20', '800']],
  ['green-peppers', 'vegetables', 'mass', ['Green peppers', 'Poivrons verts', 'فلفل أخضر'], ['sweet', 'doux', 'حلو'], ['pepper', 'poivron', 'felfel'], ['30', '1000']],
  ['garlic', 'vegetables', 'mass', ['Garlic', 'Ail', 'ثوم'], null, ['thoum', 'toum'], ['100', '4000']],
  ['coriander', 'vegetables', 'count', ['Fresh coriander', 'Coriandre fraîche', 'قصبر'], ['bunch', 'botte', 'حزمة'], ['coriander', 'cilantro', 'kosbor', 'معدنوس'], ['5', '300']],
  ['lentils', 'grains-legumes', 'mass', ['Lentils', 'Lentilles', 'عدس'], ['dried', 'sèches', 'جاف'], ['lentil', 'adess', 'ades'], ['80', '1200']],
  ['chickpeas', 'grains-legumes', 'mass', ['Chickpeas', 'Pois chiches', 'حمص'], ['dried', 'secs', 'جاف'], ['chickpea', 'hommos', 'hmass'], ['100', '1500']],
  ['white-beans', 'grains-legumes', 'mass', ['White beans', 'Haricots blancs', 'لوبيا بيضاء'], ['dried', 'secs', 'جافة'], ['beans', 'haricot', 'loubia'], ['100', '1500']],
  ['rice', 'grains-legumes', 'mass', ['Rice', 'Riz', 'أرز'], ['long grain', 'long grain', 'حبة طويلة'], ['riz', 'roz', 'رز'], ['60', '1200']],
  ['spaghetti', 'grains-legumes', 'mass', ['Spaghetti', 'Spaghetti', 'سباغيتي'], null, ['pasta', 'pates', 'pâtes', 'macaroni', 'عجائن'], ['60', '1000']],
  ['couscous', 'grains-legumes', 'mass', ['Couscous', 'Couscous', 'كسكس'], ['medium grain', 'grain moyen', 'حبة متوسطة'], ['kesksou', 'seksu', 'طعام'], ['40', '900']],
  ['semolina-fine', 'grains-legumes', 'mass', ['Semolina', 'Semoule', 'سميد'], ['fine', 'fine', 'رقيق'], ['semoule', 'smid'], ['30', '700']],
  ['flour', 'grains-legumes', 'mass', ['Flour', 'Farine', 'فرينة'], ['white wheat', 'blé blanche', 'قمح أبيض'], ['farine', 'faryna', 'دقيق'], ['30', '600']],
  ['frik', 'grains-legumes', 'mass', ['Frik (cracked green wheat)', 'Frik (blé vert concassé)', 'فريك'], null, ['frik', 'freekeh', 'chorba'], ['100', '2000']],
  ['tomato-paste', 'pantry', 'mass', ['Tomato paste', 'Concentré de tomate', 'طماطم مصبرة'], ['double concentrate', 'double concentré', 'مركزة'], ['concentre', 'tomato concentrate', 'مركز الطماطم'], ['150', '2500']],
  ['vegetable-oil', 'pantry', 'volume', ['Vegetable oil', 'Huile de table', 'زيت المائدة'], null, ['oil', 'huile', 'zit', 'زيت'], ['100', '1500']],
  ['sugar', 'pantry', 'mass', ['Sugar', 'Sucre', 'سكر'], ['white', 'blanc', 'أبيض'], ['sucre', 'sokkar'], ['50', '600']],
  ['eggs', 'dairy-eggs', 'count', ['Eggs', 'Œufs', 'بيض'], null, ['egg', 'oeuf', 'oeufs', 'baid'], ['5', '100']],
  ['milk-pasteurised-bag', 'dairy-eggs', 'volume', ['Milk', 'Lait', 'حليب'], ['pasteurised, bag', 'pasteurisé, sachet', 'مبستر، كيس'], ['lait sachet', 'hlib', 'حليب الكيس'], ['15', '400']],
  ['milk-uht', 'dairy-eggs', 'volume', ['Milk', 'Lait', 'حليب'], ['UHT, carton', 'UHT, brique', 'معقم، علبة'], ['lait uht', 'hlib'], ['50', '600']],
  ['chicken-whole', 'meat-poultry', 'mass', ['Chicken', 'Poulet', 'دجاج'], ['whole', 'entier', 'كامل'], ['poulet', 'djaj', 'دجاجة'], ['150', '2000']],
  ['lamb', 'meat-poultry', 'mass', ['Lamb', 'Viande ovine', 'لحم الغنم'], ['on the bone', 'avec os', 'بالعظم'], ['mutton', 'mouton', 'agneau', 'lham', 'لحم'], ['800', '6000']],
  ['beef-minced', 'meat-poultry', 'mass', ['Minced beef', 'Viande hachée', 'لحم مفروم'], ['beef', 'bœuf', 'بقر'], ['minced', 'hachee', 'kefta', 'كفتة'], ['800', '6000']],
  ['sardines', 'fish', 'mass', ['Sardines', 'Sardines', 'سردين'], ['fresh', 'fraîches', 'طازج'], ['sardine', 'poisson', 'fish', 'سمك'], ['100', '2500']],
  ['baguette', 'bakery', 'count', ['Baguette', 'Baguette', 'خبز'], ['standard', 'ordinaire', 'عادي'], ['bread', 'pain', 'khobz', 'كسرة'], ['5', '100']],
  ['baklava', 'desserts', 'count', ['Baklava', 'Baklava', 'بقلاوة'], null, ['baklava', 'baklawa', 'boulawa'], ['50', '1000']],
  ['orange-juice', 'drinks', 'volume', ['Orange juice', 'Jus d’orange', 'عصير برتقال'], ['fresh', 'frais', 'طازج'], ['juice', 'jus', 'asir', 'عصير'], ['80', '1200']],
  ['water', 'drinks', 'volume', ['Water', 'Eau', 'ماء'], ['mineral', 'minérale', 'معدني'], ['water', 'eau', 'ma', 'ماء'], ['20', '400']],
];

export const PRODUCTS: Product[] = PRODUCTS_RAW.map(([id, category_id, dimension, names, variant, terms, [min, max]]) => ({
  id,
  category_id,
  dimension,
  name_en: names[0],
  name_fr: names[1],
  name_ar: names[2],
  variant_en: variant?.[0] ?? null,
  variant_fr: variant?.[1] ?? null,
  variant_ar: variant?.[2] ?? null,
  search_terms: terms,
  min_unit_price: min,
  max_unit_price: max,
}));

type I = [id: string, pricing: string | null, dimension: Dimension, names: [string, string, string], tags: DietTag[]];

const INGREDIENTS_RAW: I[] = [
  ['potato', 'potatoes', 'mass', ['Potatoes', 'Pommes de terre', 'بطاطا'], []],
  ['onion', 'onions', 'mass', ['Onions', 'Oignons', 'بصل'], []],
  ['tomato', 'tomatoes', 'mass', ['Tomatoes', 'Tomates', 'طماطم'], []],
  ['carrot', 'carrots', 'mass', ['Carrots', 'Carottes', 'جزر'], []],
  ['zucchini', 'zucchini', 'mass', ['Zucchini', 'Courgettes', 'كوسة'], []],
  ['green-pepper', 'green-peppers', 'mass', ['Green peppers', 'Poivrons verts', 'فلفل أخضر'], []],
  ['garlic', 'garlic', 'mass', ['Garlic', 'Ail', 'ثوم'], []],
  ['coriander', 'coriander', 'count', ['Fresh coriander (bunch)', 'Coriandre fraîche (botte)', 'قصبر (حزمة)'], []],
  ['lentils', 'lentils', 'mass', ['Lentils', 'Lentilles', 'عدس'], ['legume']],
  ['chickpeas', 'chickpeas', 'mass', ['Chickpeas', 'Pois chiches', 'حمص'], ['legume']],
  ['white-beans', 'white-beans', 'mass', ['White beans', 'Haricots blancs', 'لوبيا بيضاء'], ['legume']],
  ['rice', 'rice', 'mass', ['Rice', 'Riz', 'أرز'], []],
  ['spaghetti', 'spaghetti', 'mass', ['Spaghetti', 'Spaghetti', 'سباغيتي'], ['gluten']],
  ['couscous', 'couscous', 'mass', ['Couscous', 'Couscous', 'كسكس'], ['gluten']],
  ['flour', 'flour', 'mass', ['Flour', 'Farine', 'فرينة'], ['gluten']],
  ['frik', 'frik', 'mass', ['Frik', 'Frik', 'فريك'], ['gluten']],
  ['tomato-paste', 'tomato-paste', 'mass', ['Tomato paste', 'Concentré de tomate', 'طماطم مصبرة'], []],
  ['oil', 'vegetable-oil', 'volume', ['Vegetable oil', 'Huile de table', 'زيت المائدة'], []],
  ['egg', 'eggs', 'count', ['Eggs', 'Œufs', 'بيض'], ['egg']],
  ['milk', 'milk-pasteurised-bag', 'volume', ['Milk', 'Lait', 'حليب'], ['dairy']],
  ['chicken', 'chicken-whole', 'mass', ['Chicken', 'Poulet', 'دجاج'], ['poultry']],
  ['lamb', 'lamb', 'mass', ['Lamb', 'Viande ovine', 'لحم الغنم'], ['red_meat']],
  ['beef-minced', 'beef-minced', 'mass', ['Minced beef', 'Viande hachée', 'لحم مفروم'], ['red_meat']],
  ['sardines', 'sardines', 'mass', ['Sardines', 'Sardines', 'سردين'], ['fish']],
  ['bread', 'baguette', 'count', ['Bread (baguette)', 'Pain (baguette)', 'خبز'], ['gluten']],
  ['baklava', 'baklava', 'count', ['Baklava', 'Baklava', 'بقلاوة'], ['gluten']],
  ['orange-juice', 'orange-juice', 'volume', ['Orange juice', 'Jus d’orange', 'عصير برتقال'], []],
  ['water', 'water', 'volume', ['Water', 'Eau', 'ماء'], []],
  ['salt-spices', null, 'mass', ['Salt & spices', 'Sel & épices', 'ملح وتوابل'], []],
];

export const INGREDIENTS: Ingredient[] = INGREDIENTS_RAW.map(([id, pricing, dimension, names, tags]) => ({
  id,
  dimension,
  name_en: names[0],
  name_fr: names[1],
  name_ar: names[2],
  diet_tags: tags,
  is_staple: pricing === null,
  pricing_product_id: pricing,
}));
