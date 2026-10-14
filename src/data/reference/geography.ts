import type { LocalArea, Wilaya } from '../../domain/types';

/**
 * Algeria's 58 wilayas (2019 administrative division). Reference data only.
 * Being listed here does not mean a wilaya has price data yet.
 * Map centres are chef-lieu approximations for every wilaya.
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

/** Chef-lieu map centres [lat, lng] keyed by wilaya code. */
const CENTERS: Record<number, readonly [number, number]> = {
  1: [27.874, -0.294], 2: [36.165, 1.335], 3: [33.8, 2.865], 4: [35.875, 7.114],
  5: [35.555, 6.174], 6: [36.751, 5.084], 7: [34.85, 5.728], 8: [31.616, -2.217],
  9: [36.47, 2.828], 10: [36.375, 3.901], 11: [22.785, 5.522], 12: [35.404, 8.124],
  13: [34.888, -1.314], 14: [35.371, 1.317], 15: [36.711, 4.046], 16: [36.754, 3.059],
  17: [34.67, 3.25], 18: [36.821, 5.766], 19: [36.191, 5.414], 20: [34.83, 0.152],
  21: [36.879, 6.906], 22: [35.202, -0.63], 23: [36.9, 7.767], 24: [36.462, 7.433],
  25: [36.365, 6.614], 26: [36.267, 2.75], 27: [35.931, 0.089], 28: [35.705, 4.542],
  29: [35.396, 0.14], 30: [31.949, 5.325], 31: [35.697, -0.633], 32: [33.68, 1.02],
  33: [26.509, 8.482], 34: [36.073, 4.761], 35: [36.766, 3.477], 36: [36.767, 8.314],
  37: [27.671, -8.147], 38: [35.607, 1.811], 39: [33.368, 6.867], 40: [35.436, 7.143],
  41: [36.286, 7.951], 42: [36.589, 2.447], 43: [36.45, 6.267], 44: [36.264, 1.968],
  45: [33.267, -0.311], 46: [35.297, -1.14], 47: [32.489, 3.673], 48: [35.737, 0.556],
  49: [29.258, 0.241], 50: [21.329, 0.954], 51: [34.428, 5.07], 52: [30.131, -2.169],
  53: [27.197, 2.482], 54: [19.572, 5.772], 55: [33.105, 6.056], 56: [24.555, 9.484],
  57: [33.951, 5.922], 58: [30.583, 2.883],
};

export const WILAYAS: Wilaya[] = W.map(([code, name_en, name_fr, name_ar]) => {
  const c = CENTERS[code]!;
  return {
    code,
    name_en,
    name_fr,
    name_ar,
    center_lat: c[0],
    center_lng: c[1],
    default_zoom: 12,
    is_pilot: false,
  };
});

/** Default map/home wilaya when the visitor has not chosen one yet (Algiers). */
export const DEFAULT_WILAYA_CODE = 16;

export const ALGERIA_VIEW = { lat: 28.0, lng: 3.0, zoom: 5 };

export const LOCAL_AREAS: LocalArea[] = [
  { id: 'djelfa', wilaya_code: 17, kind: 'commune', name_en: 'Djelfa', name_fr: 'Djelfa', name_ar: 'الجلفة' },
  { id: 'ain-oussara', wilaya_code: 17, kind: 'commune', name_en: 'Aïn Oussara', name_fr: 'Aïn Oussara', name_ar: 'عين وسارة' },
  { id: 'hassi-bahbah', wilaya_code: 17, kind: 'commune', name_en: 'Hassi Bahbah', name_fr: 'Hassi Bahbah', name_ar: 'حاسي بحبح' },
  { id: 'messaad', wilaya_code: 17, kind: 'commune', name_en: 'Messaad', name_fr: 'Messaad', name_ar: 'مسعد' },
];
