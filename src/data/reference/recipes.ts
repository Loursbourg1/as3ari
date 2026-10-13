import type { MealSlot, Recipe, UnitCode } from '../../domain/types';

/**
 * Initial structured recipe catalogue. Every ingredient references a catalogued
 * ingredient with an exact quantity and unit so costs can be calculated.
 * All recipes serve 4; the planner scales them to the household size.
 * "salt-spices" is a staple: listed for completeness, never costed.
 */
type Ing = [string, string, UnitCode];

function recipe(
  id: string,
  slots: MealSlot[],
  names: [string, string, string],
  ingredients: Ing[],
  steps: { en: string[]; fr: string[]; ar: string[] },
): Recipe {
  return {
    id,
    servings: 4,
    meal_slots: slots,
    name_en: names[0],
    name_fr: names[1],
    name_ar: names[2],
    ingredients: ingredients.map(([ingredient_id, quantity, unit]) => ({ ingredient_id, quantity, unit })),
    steps,
  };
}

export const RECIPES: Recipe[] = [
  recipe(
    'lentil-stew',
    ['lunch', 'dinner'],
    ['Lentil stew (Adess)', 'Lentilles en sauce (Adess)', 'عدس بالمرق'],
    [['lentils', '400', 'g'], ['onion', '150', 'g'], ['tomato', '200', 'g'], ['garlic', '15', 'g'], ['carrot', '150', 'g'], ['potato', '300', 'g'], ['oil', '40', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '10', 'g']],
    {
      en: ['Rinse the lentils.', 'Soften chopped onion and garlic in the oil, add grated tomato and spices.', 'Add lentils, diced carrot and potato, cover with water.', 'Simmer 35–40 minutes until tender. Serve with bread.'],
      fr: ['Rincer les lentilles.', "Faire revenir l'oignon et l'ail dans l'huile, ajouter la tomate râpée et les épices.", "Ajouter les lentilles, la carotte et la pomme de terre en dés, couvrir d'eau.", 'Laisser mijoter 35 à 40 minutes. Servir avec du pain.'],
      ar: ['اغسل العدس.', 'شوّح البصل والثوم في الزيت ثم أضف الطماطم المبشورة والتوابل.', 'أضف العدس والجزر والبطاطا المقطعة وغطّها بالماء.', 'اتركه يطهى 35 إلى 40 دقيقة. يقدم مع الخبز.'],
    },
  ),
  recipe(
    'chickpea-stew',
    ['lunch', 'dinner'],
    ['Chickpea and potato stew', 'Pois chiches et pommes de terre en sauce', 'حمص بالبطاطا والمرق'],
    [['chickpeas', '350', 'g'], ['onion', '150', 'g'], ['tomato-paste', '60', 'g'], ['garlic', '15', 'g'], ['potato', '300', 'g'], ['oil', '40', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '10', 'g']],
    {
      en: ['Soak the chickpeas overnight, then drain.', 'Fry onion and garlic in the oil, stir in tomato paste and spices.', 'Add chickpeas and water; simmer 60 minutes.', 'Add diced potato and cook 20 minutes more.'],
      fr: ['Faire tremper les pois chiches la veille, puis égoutter.', "Faire revenir l'oignon et l'ail, ajouter le concentré et les épices.", "Ajouter les pois chiches et de l'eau ; cuire 60 minutes.", 'Ajouter la pomme de terre en dés et cuire encore 20 minutes.'],
      ar: ['انقع الحمص ليلة كاملة ثم صفّه.', 'شوّح البصل والثوم وأضف الطماطم المصبرة والتوابل.', 'أضف الحمص والماء واتركه يطهى 60 دقيقة.', 'أضف البطاطا المقطعة واطهها 20 دقيقة أخرى.'],
    },
  ),
  recipe(
    'white-bean-stew',
    ['lunch', 'dinner'],
    ['White bean stew (Loubia)', 'Loubia (haricots blancs en sauce)', 'لوبيا بالمرق'],
    [['white-beans', '400', 'g'], ['onion', '150', 'g'], ['tomato-paste', '70', 'g'], ['garlic', '15', 'g'], ['carrot', '150', 'g'], ['oil', '40', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '10', 'g']],
    {
      en: ['Soak the beans overnight, then drain.', 'Fry onion and garlic, add tomato paste, cumin and paprika.', 'Add beans, sliced carrot and water.', 'Simmer about 75 minutes until creamy.'],
      fr: ['Faire tremper les haricots la veille, puis égoutter.', "Faire revenir l'oignon et l'ail, ajouter le concentré, le cumin et le paprika.", "Ajouter les haricots, la carotte et de l'eau.", 'Laisser mijoter environ 75 minutes.'],
      ar: ['انقع اللوبيا ليلة كاملة ثم صفّها.', 'شوّح البصل والثوم وأضف الطماطم المصبرة والكمون والفلفل الأحمر.', 'أضف اللوبيا والجزر والماء.', 'اتركها تطهى حوالي 75 دقيقة.'],
    },
  ),
  recipe(
    'chorba-frik-chicken',
    ['dinner'],
    ['Chorba frik with chicken', 'Chorba frik au poulet', 'شربة فريك بالدجاج'],
    [['frik', '150', 'g'], ['chicken', '400', 'g'], ['onion', '150', 'g'], ['tomato', '200', 'g'], ['tomato-paste', '40', 'g'], ['chickpeas', '80', 'g'], ['coriander', '1', 'piece'], ['oil', '40', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '10', 'g']],
    {
      en: ['Brown chicken pieces with onion in the oil.', 'Add grated tomato, tomato paste, spices, soaked chickpeas and water; simmer 30 minutes.', 'Stir in the rinsed frik and cook 20 minutes, stirring.', 'Finish with chopped coriander.'],
      fr: ["Faire dorer le poulet avec l'oignon dans l'huile.", "Ajouter la tomate, le concentré, les épices, les pois chiches trempés et l'eau ; cuire 30 minutes.", 'Ajouter le frik rincé et cuire 20 minutes en remuant.', 'Parsemer de coriandre hachée.'],
      ar: ['حمّر قطع الدجاج مع البصل في الزيت.', 'أضف الطماطم والطماطم المصبرة والتوابل والحمص المنقوع والماء واطهه 30 دقيقة.', 'أضف الفريك المغسول واطهه 20 دقيقة مع التحريك.', 'زيّنها بالقصبر المفروم.'],
    },
  ),
  recipe(
    'couscous-chicken',
    ['lunch'],
    ['Chicken and vegetable couscous', 'Couscous au poulet et légumes', 'كسكس بالدجاج والخضر'],
    [['couscous', '500', 'g'], ['chicken', '600', 'g'], ['carrot', '300', 'g'], ['zucchini', '300', 'g'], ['potato', '300', 'g'], ['onion', '150', 'g'], ['chickpeas', '80', 'g'], ['tomato-paste', '40', 'g'], ['oil', '50', 'ml'], ['salt-spices', '10', 'g']],
    {
      en: ['Brown chicken and onion in oil, add tomato paste, spices, soaked chickpeas and water.', 'Add carrots and potatoes after 20 minutes, zucchini after 35.', 'Steam the couscous twice over the sauce, fluffing with a little oil.', 'Serve couscous topped with chicken, vegetables and broth.'],
      fr: ["Faire revenir le poulet et l'oignon, ajouter le concentré, les épices, les pois chiches et l'eau.", 'Ajouter carottes et pommes de terre après 20 minutes, courgettes après 35.', "Cuire le couscous deux fois à la vapeur en l'aérant avec un peu d'huile.", 'Servir garni de poulet, de légumes et de bouillon.'],
      ar: ['حمّر الدجاج والبصل وأضف الطماطم المصبرة والتوابل والحمص والماء.', 'أضف الجزر والبطاطا بعد 20 دقيقة والكوسة بعد 35 دقيقة.', 'فوّر الكسكس مرتين فوق المرق مع قليل من الزيت.', 'قدّمه مع الدجاج والخضر والمرق.'],
    },
  ),
  recipe(
    'couscous-vegetable',
    ['lunch'],
    ['Vegetable couscous', 'Couscous aux légumes', 'كسكس بالخضر'],
    [['couscous', '500', 'g'], ['carrot', '300', 'g'], ['zucchini', '300', 'g'], ['potato', '400', 'g'], ['onion', '150', 'g'], ['chickpeas', '150', 'g'], ['tomato-paste', '40', 'g'], ['oil', '50', 'ml'], ['salt-spices', '10', 'g']],
    {
      en: ['Fry onion in oil, add tomato paste, spices, soaked chickpeas and water.', 'Add carrots and potatoes, then zucchini 15 minutes later.', 'Steam the couscous twice over the broth.', 'Serve with the vegetables and broth.'],
      fr: ["Faire revenir l'oignon, ajouter le concentré, les épices, les pois chiches et l'eau.", 'Ajouter carottes et pommes de terre, puis les courgettes 15 minutes après.', 'Cuire le couscous deux fois à la vapeur au-dessus du bouillon.', 'Servir avec les légumes et le bouillon.'],
      ar: ['شوّح البصل وأضف الطماطم المصبرة والتوابل والحمص والماء.', 'أضف الجزر والبطاطا ثم الكوسة بعد 15 دقيقة.', 'فوّر الكسكس مرتين فوق المرق.', 'قدّمه مع الخضر والمرق.'],
    },
  ),
  recipe(
    'chakchouka',
    ['lunch', 'dinner'],
    ['Chakchouka with eggs', 'Chakchouka aux œufs', 'شكشوكة بالبيض'],
    [['tomato', '600', 'g'], ['green-pepper', '400', 'g'], ['onion', '150', 'g'], ['garlic', '10', 'g'], ['egg', '4', 'piece'], ['oil', '40', 'ml'], ['bread', '2', 'piece'], ['salt-spices', '5', 'g']],
    {
      en: ['Soften sliced onion and peppers in oil.', 'Add chopped tomatoes, garlic and spices; cook down 15 minutes.', 'Make wells and crack in the eggs; cover until set.', 'Serve hot with bread.'],
      fr: ["Faire fondre l'oignon et les poivrons émincés dans l'huile.", "Ajouter les tomates, l'ail et les épices ; réduire 15 minutes.", 'Casser les œufs dans la sauce et couvrir jusqu’à cuisson.', 'Servir chaud avec du pain.'],
      ar: ['شوّح البصل والفلفل المقطع في الزيت.', 'أضف الطماطم والثوم والتوابل واتركها تنضج 15 دقيقة.', 'اكسر البيض فوق الصلصة وغطّها حتى ينضج.', 'تقدم ساخنة مع الخبز.'],
    },
  ),
  recipe(
    'maakouda',
    ['lunch', 'dinner'],
    ['Potato and egg patties (Maakouda)', 'Maakouda (galettes pommes de terre et œufs)', 'معقودة'],
    [['potato', '1000', 'g'], ['egg', '4', 'piece'], ['garlic', '10', 'g'], ['coriander', '1', 'piece'], ['flour', '50', 'g'], ['oil', '150', 'ml'], ['bread', '2', 'piece'], ['salt-spices', '5', 'g']],
    {
      en: ['Boil and mash the potatoes.', 'Mix in eggs, crushed garlic, chopped coriander, flour and spices.', 'Shape into patties.', 'Shallow-fry until golden on both sides; serve with bread.'],
      fr: ['Cuire et écraser les pommes de terre.', "Ajouter les œufs, l'ail, la coriandre hachée, la farine et les épices.", 'Former des galettes.', 'Faire frire des deux côtés ; servir avec du pain.'],
      ar: ['اسلق البطاطا واهرسها.', 'أضف البيض والثوم المهروس والقصبر والفرينة والتوابل.', 'شكّل أقراصا.', 'اقلها حتى يصير لونها ذهبيا وقدّمها مع الخبز.'],
    },
  ),
  recipe(
    'spaghetti-beef',
    ['lunch', 'dinner'],
    ['Spaghetti with minced beef sauce', 'Spaghetti à la viande hachée', 'سباغيتي باللحم المفروم'],
    [['spaghetti', '500', 'g'], ['beef-minced', '300', 'g'], ['tomato', '400', 'g'], ['onion', '100', 'g'], ['garlic', '10', 'g'], ['tomato-paste', '30', 'g'], ['oil', '30', 'ml'], ['salt-spices', '5', 'g']],
    {
      en: ['Brown the minced beef with onion and garlic in the oil.', 'Add grated tomatoes and tomato paste; simmer 20 minutes.', 'Cook the spaghetti in salted water and drain.', 'Toss with the sauce.'],
      fr: ["Faire revenir la viande hachée avec l'oignon et l'ail.", 'Ajouter les tomates râpées et le concentré ; mijoter 20 minutes.', "Cuire les spaghetti à l'eau salée et égoutter.", 'Mélanger avec la sauce.'],
      ar: ['حمّر اللحم المفروم مع البصل والثوم في الزيت.', 'أضف الطماطم المبشورة والطماطم المصبرة واتركها 20 دقيقة.', 'اسلق السباغيتي في ماء مملح وصفّها.', 'اخلطها مع الصلصة.'],
    },
  ),
  recipe(
    'spaghetti-tomato',
    ['lunch', 'dinner'],
    ['Spaghetti with tomato sauce', 'Spaghetti sauce tomate', 'سباغيتي بصلصة الطماطم'],
    [['spaghetti', '500', 'g'], ['tomato', '500', 'g'], ['onion', '100', 'g'], ['garlic', '10', 'g'], ['tomato-paste', '30', 'g'], ['oil', '40', 'ml'], ['salt-spices', '5', 'g']],
    {
      en: ['Soften onion and garlic in the oil.', 'Add grated tomatoes and tomato paste; simmer 20 minutes.', 'Cook the spaghetti and drain.', 'Toss with the sauce.'],
      fr: ["Faire revenir l'oignon et l'ail dans l'huile.", 'Ajouter les tomates râpées et le concentré ; mijoter 20 minutes.', 'Cuire les spaghetti et égoutter.', 'Mélanger avec la sauce.'],
      ar: ['شوّح البصل والثوم في الزيت.', 'أضف الطماطم المبشورة والطماطم المصبرة واتركها 20 دقيقة.', 'اسلق السباغيتي وصفّها.', 'اخلطها مع الصلصة.'],
    },
  ),
  recipe(
    'rice-chicken',
    ['lunch', 'dinner'],
    ['Rice with chicken and vegetables', 'Riz au poulet et légumes', 'أرز بالدجاج والخضر'],
    [['rice', '400', 'g'], ['chicken', '500', 'g'], ['onion', '150', 'g'], ['carrot', '150', 'g'], ['green-pepper', '100', 'g'], ['tomato-paste', '30', 'g'], ['oil', '40', 'ml'], ['salt-spices', '5', 'g']],
    {
      en: ['Brown chicken and onion in the oil.', 'Add diced carrot, pepper, tomato paste, spices and water; simmer 25 minutes.', 'Add rinsed rice and enough water to cover by 1 cm.', 'Cover and cook on low heat 18 minutes.'],
      fr: ["Faire dorer le poulet et l'oignon.", "Ajouter carotte, poivron, concentré, épices et eau ; cuire 25 minutes.", "Ajouter le riz rincé et de l'eau à 1 cm au-dessus.", 'Couvrir et cuire à feu doux 18 minutes.'],
      ar: ['حمّر الدجاج والبصل في الزيت.', 'أضف الجزر والفلفل والطماطم المصبرة والتوابل والماء واتركه 25 دقيقة.', 'أضف الأرز المغسول وماء يغطيه بسنتيمتر.', 'غطّه واطهه على نار هادئة 18 دقيقة.'],
    },
  ),
  recipe(
    'lamb-potato-stew',
    ['lunch', 'dinner'],
    ['Lamb and potato stew', "Ragoût d'agneau aux pommes de terre", 'مرق لحم الغنم بالبطاطا'],
    [['lamb', '500', 'g'], ['potato', '700', 'g'], ['onion', '150', 'g'], ['tomato', '200', 'g'], ['garlic', '10', 'g'], ['oil', '40', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '10', 'g']],
    {
      en: ['Brown the lamb with onion and garlic in the oil.', 'Add grated tomato, spices and water; simmer 60 minutes.', 'Add potato wedges and cook 25 minutes more.', 'Serve with bread.'],
      fr: ["Faire revenir l'agneau avec l'oignon et l'ail.", "Ajouter la tomate, les épices et l'eau ; mijoter 60 minutes.", 'Ajouter les pommes de terre et cuire encore 25 minutes.', 'Servir avec du pain.'],
      ar: ['حمّر اللحم مع البصل والثوم في الزيت.', 'أضف الطماطم والتوابل والماء واتركه 60 دقيقة.', 'أضف البطاطا واطهه 25 دقيقة أخرى.', 'يقدم مع الخبز.'],
    },
  ),
  recipe(
    'fried-sardines',
    ['lunch', 'dinner'],
    ['Fried sardines with tomato salad', 'Sardines frites et salade de tomates', 'سردين مقلي مع سلطة الطماطم'],
    [['sardines', '800', 'g'], ['flour', '100', 'g'], ['oil', '150', 'ml'], ['tomato', '300', 'g'], ['onion', '100', 'g'], ['garlic', '10', 'g'], ['bread', '2', 'piece'], ['salt-spices', '5', 'g']],
    {
      en: ['Clean the sardines and season with garlic and spices.', 'Dredge in flour and fry in hot oil until crisp.', 'Dice tomatoes and onion for a simple salad.', 'Serve with bread.'],
      fr: ["Nettoyer les sardines, assaisonner d'ail et d'épices.", "Fariner et frire dans l'huile chaude.", 'Couper tomates et oignon en dés pour la salade.', 'Servir avec du pain.'],
      ar: ['نظّف السردين وتبّله بالثوم والتوابل.', 'غطّه بالفرينة واقله في زيت ساخن.', 'قطّع الطماطم والبصل لسلطة بسيطة.', 'يقدم مع الخبز.'],
    },
  ),
  recipe(
    'lentil-soup',
    ['dinner'],
    ['Lentil soup (Chorba adess)', 'Soupe de lentilles (Chorba adess)', 'شربة عدس'],
    [['lentils', '300', 'g'], ['carrot', '200', 'g'], ['onion', '100', 'g'], ['potato', '300', 'g'], ['tomato-paste', '30', 'g'], ['oil', '30', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '5', 'g']],
    {
      en: ['Soften onion in the oil, add tomato paste and cumin.', 'Add lentils, carrot, potato and 1.5 litres of water.', 'Simmer 35 minutes, then blend until smooth.', 'Serve with bread.'],
      fr: ["Faire revenir l'oignon, ajouter le concentré et le cumin.", "Ajouter lentilles, carotte, pomme de terre et 1,5 litre d'eau.", 'Cuire 35 minutes puis mixer.', 'Servir avec du pain.'],
      ar: ['شوّح البصل وأضف الطماطم المصبرة والكمون.', 'أضف العدس والجزر والبطاطا ولترا ونصف من الماء.', 'اتركها 35 دقيقة ثم اخلطها.', 'تقدم مع الخبز.'],
    },
  ),
  recipe(
    'zucchini-egg-tajine',
    ['lunch', 'dinner'],
    ['Baked zucchini and egg tajine', 'Tajine de courgettes aux œufs', 'طاجين الكوسة بالبيض'],
    [['zucchini', '700', 'g'], ['egg', '6', 'piece'], ['onion', '100', 'g'], ['garlic', '10', 'g'], ['milk', '200', 'ml'], ['oil', '30', 'ml'], ['bread', '1', 'piece'], ['salt-spices', '5', 'g']],
    {
      en: ['Grate the zucchini, salt lightly and squeeze out water.', 'Soften onion and garlic in the oil, mix with the zucchini.', 'Beat eggs with milk and spices; combine everything in a dish.', 'Bake at 180 °C for 30 minutes.'],
      fr: ["Râper les courgettes, saler légèrement et presser l'eau.", "Faire revenir l'oignon et l'ail, mélanger aux courgettes.", 'Battre les œufs avec le lait et les épices ; tout réunir dans un plat.', 'Cuire au four à 180 °C pendant 30 minutes.'],
      ar: ['ابشر الكوسة وملّحها قليلا واعصرها من الماء.', 'شوّح البصل والثوم واخلطهما مع الكوسة.', 'اخفق البيض مع الحليب والتوابل واخلط الكل في صينية.', 'اخبزه في فرن 180 درجة لمدة 30 دقيقة.'],
    },
  ),
  recipe(
    'tomato-rice-chickpeas',
    ['lunch', 'dinner'],
    ['Tomato rice with chickpeas', 'Riz à la tomate et pois chiches', 'أرز بالطماطم والحمص'],
    [['rice', '400', 'g'], ['chickpeas', '150', 'g'], ['onion', '150', 'g'], ['tomato', '300', 'g'], ['tomato-paste', '30', 'g'], ['oil', '40', 'ml'], ['salt-spices', '5', 'g']],
    {
      en: ['Cook the soaked chickpeas until tender (about 60 minutes).', 'Fry onion, add grated tomato and tomato paste.', 'Add rice, chickpeas and water to cover by 1 cm.', 'Cover and cook on low heat 18 minutes.'],
      fr: ['Cuire les pois chiches trempés (environ 60 minutes).', "Faire revenir l'oignon, ajouter la tomate râpée et le concentré.", "Ajouter le riz, les pois chiches et de l'eau à 1 cm au-dessus.", 'Couvrir et cuire à feu doux 18 minutes.'],
      ar: ['اطه الحمص المنقوع حتى ينضج (حوالي 60 دقيقة).', 'شوّح البصل وأضف الطماطم المبشورة والمصبرة.', 'أضف الأرز والحمص وماء يغطيه بسنتيمتر.', 'غطّه واطهه على نار هادئة 18 دقيقة.'],
    },
  ),
];
