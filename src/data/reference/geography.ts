import type { LocalArea, Wilaya } from '../../domain/types';

/**
 * Algeria's 58 wilayas (2019 administrative division) — reference data only.
 * Being listed here does NOT mean a wilaya has any price data.
 * Map centres are only set for the pilot area; other wilayas fall back to a national view.
 * If the administrative division changes, update this file and regenerate the seed.
 */
const W: [number, string, string, string][] = [
  [1, 'Adrar', 'Adrar', 'أدرار'],
  [2, 'Chlef', 'Chlef', 'الشلف'],
  [3, 'Laghouat', 'Laghouat', 'الأغواط'],
  [4, 'Oum El Bouaghi', 'Oum El Bouaghi', 'أم البواقي'],
  [5, 'Batna', 'Batna', 'باتنة'],
  [6, 'Béjaïa', 'Béjaïa', 'بجاية'],
  [7, 'Biskra', 'Biskra', 'بسكرة'],
  [8, 'Béchar', 'Béchar', 'بشار'],
  [9, 'Blida', 'Blida', 'البليدة'],
  [10, 'Bouira', 'Bouira', 'البويرة'],
  [11, 'Tamanrasset', 'Tamanrasset', 'تمنراست'],
  [12, 'Tébessa', 'Tébessa', 'تبسة'],
  [13, 'Tlemcen', 'Tlemcen', 'تلمسان'],
  [14, 'Tiaret', 'Tiaret', 'تيارت'],
  [15, 'Tizi Ouzou', 'Tizi Ouzou', 'تيزي وزو'],
  [16, 'Algiers', 'Alger', 'الجزائر'],
  [17, 'Djelfa', 'Djelfa', 'الجلفة'],
  [18, 'Jijel', 'Jijel', 'جيجل'],
  [19, 'Sétif', 'Sétif', 'سطيف'],
  [20, 'Saïda', 'Saïda', 'سعيدة'],
  [21, 'Skikda', 'Skikda', 'سكيكدة'],
  [22, 'Sidi Bel Abbès', 'Sidi Bel Abbès', 'سيدي بلعباس'],
  [23, 'Annaba', 'Annaba', 'عنابة'],
  [24, 'Guelma', 'Guelma', 'قالمة'],
  [25, 'Constantine', 'Constantine', 'قسنطينة'],
  [26, 'Médéa', 'Médéa', 'المدية'],
  [27, 'Mostaganem', 'Mostaganem', 'مستغانم'],
  [28, "M'Sila", "M'Sila", 'المسيلة'],
  [29, 'Mascara', 'Mascara', 'معسكر'],
  [30, 'Ouargla', 'Ouargla', 'ورقلة'],
  [31, 'Oran', 'Oran', 'وهران'],
  [32, 'El Bayadh', 'El Bayadh', 'البيض'],
  [33, 'Illizi', 'Illizi', 'إليزي'],
  [34, 'Bordj Bou Arréridj', 'Bordj Bou Arréridj', 'برج بوعريريج'],
  [35, 'Boumerdès', 'Boumerdès', 'بومرداس'],
  [36, 'El Tarf', 'El Tarf', 'الطارف'],
  [37, 'Tindouf', 'Tindouf', 'تندوف'],
  [38, 'Tissemsilt', 'Tissemsilt', 'تيسمسيلت'],
  [39, 'El Oued', 'El Oued', 'الوادي'],
  [40, 'Khenchela', 'Khenchela', 'خنشلة'],
  [41, 'Souk Ahras', 'Souk Ahras', 'سوق أهراس'],
  [42, 'Tipaza', 'Tipaza', 'تيبازة'],
  [43, 'Mila', 'Mila', 'ميلة'],
  [44, 'Aïn Defla', 'Aïn Defla', 'عين الدفلى'],
  [45, 'Naâma', 'Naâma', 'النعامة'],
  [46, 'Aïn Témouchent', 'Aïn Témouchent', 'عين تموشنت'],
  [47, 'Ghardaïa', 'Ghardaïa', 'غرداية'],
  [48, 'Relizane', 'Relizane', 'غليزان'],
  [49, 'Timimoun', 'Timimoun', 'تيميمون'],
  [50, 'Bordj Badji Mokhtar', 'Bordj Badji Mokhtar', 'برج باجي مختار'],
  [51, 'Ouled Djellal', 'Ouled Djellal', 'أولاد جلال'],
  [52, 'Béni Abbès', 'Béni Abbès', 'بني عباس'],
  [53, 'In Salah', 'In Salah', 'عين صالح'],
  [54, 'In Guezzam', 'In Guezzam', 'عين قزام'],
  [55, 'Touggourt', 'Touggourt', 'تقرت'],
  [56, 'Djanet', 'Djanet', 'جانت'],
  [57, "El M'Ghair", "El M'Ghair", 'المغير'],
  [58, 'El Meniaa', 'El Meniaa', 'المنيعة'],
];

/** Pilot area. Centre is the approximate city centre of Djelfa, used only to position the map. */
const PILOT = { code: 17, center_lat: 34.6704, center_lng: 3.2503, default_zoom: 14 };

export const WILAYAS: Wilaya[] = W.map(([code, name_en, name_fr, name_ar]) => ({
  code,
  name_en,
  name_fr,
  name_ar,
  center_lat: code === PILOT.code ? PILOT.center_lat : null,
  center_lng: code === PILOT.code ? PILOT.center_lng : null,
  default_zoom: code === PILOT.code ? PILOT.default_zoom : null,
  is_pilot: code === PILOT.code,
}));

export const PILOT_WILAYA_CODE = PILOT.code;

/** National overview used when a wilaya has no configured map centre. */
export const ALGERIA_VIEW = { lat: 31.5, lng: 2.8, zoom: 5 };

/** Communes of the pilot wilaya that are referenced so far. Extend through the seed/import process. */
export const LOCAL_AREAS: LocalArea[] = [
  { id: 'djelfa', wilaya_code: 17, kind: 'commune', name_en: 'Djelfa', name_fr: 'Djelfa', name_ar: 'الجلفة' },
  { id: 'ain-oussara', wilaya_code: 17, kind: 'commune', name_en: 'Aïn Oussara', name_fr: 'Aïn Oussara', name_ar: 'عين وسارة' },
  { id: 'hassi-bahbah', wilaya_code: 17, kind: 'commune', name_en: 'Hassi Bahbah', name_fr: 'Hassi Bahbah', name_ar: 'حاسي بحبح' },
  { id: 'messaad', wilaya_code: 17, kind: 'commune', name_en: 'Messaad', name_fr: 'Messaad', name_ar: 'مسعد' },
];
