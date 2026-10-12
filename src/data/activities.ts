import type { ActivityType, Intensity } from '../db/types';

/**
 * MET değerleri: Compendium of Physical Activities (Ainsworth ve ark., 2011; 2024 güncellemesi)
 * içindeki ilgili satırlardan seçilmiş yaklaşık değerlerdir.
 * `stepsPerMin`: aktivite sırasında telefon/saat adım sayacına yansıyan tahmini adım hızı.
 * Adım ile manuel egzersizin çift sayılmasını önlemek için kullanılır (null = adım üretmez kabul edilir).
 */
export interface ActivityDef {
  label: string;
  met: Record<Intensity, number>;
  intensityHint: Record<Intensity, string>;
  stepsPerMin: Record<Intensity, number> | null;
  hasDistance: boolean;
}

export const ACTIVITIES: Record<ActivityType, ActivityDef> = {
  yuruyus: {
    label: 'Yürüyüş',
    met: { hafif: 2.8, orta: 3.5, yuksek: 5.0 },
    intensityHint: { hafif: '~3 km/sa, yavaş', orta: '~5 km/sa, normal', yuksek: '~6,5 km/sa, tempolu' },
    stepsPerMin: { hafif: 90, orta: 105, yuksek: 120 },
    hasDistance: true,
  },
  kosu: {
    label: 'Koşu',
    met: { hafif: 8.3, orta: 9.8, yuksek: 11.8 },
    intensityHint: { hafif: '~8 km/sa', orta: '~10 km/sa', yuksek: '~12 km/sa' },
    stepsPerMin: { hafif: 155, orta: 165, yuksek: 175 },
    hasDistance: true,
  },
  bisiklet: {
    label: 'Bisiklet',
    met: { hafif: 6.8, orta: 8.0, yuksek: 10.0 },
    intensityHint: { hafif: '16–19 km/sa', orta: '19–22 km/sa', yuksek: '22–25 km/sa' },
    stepsPerMin: null,
    hasDistance: true,
  },
  agirlik: {
    label: 'Ağırlık antrenmanı',
    met: { hafif: 3.5, orta: 5.0, yuksek: 6.0 },
    intensityHint: { hafif: 'hafif, uzun dinlenme', orta: 'genel antrenman', yuksek: 'yoğun, kısa dinlenme' },
    stepsPerMin: null,
    hasDistance: false,
  },
  fitness: {
    label: 'Fitness / aerobik',
    met: { hafif: 3.8, orta: 5.0, yuksek: 8.0 },
    intensityHint: { hafif: 'hafif kondisyon', orta: 'düşük etkili aerobik', yuksek: 'devre / HIIT' },
    stepsPerMin: null,
    hasDistance: false,
  },
  yuzme: {
    label: 'Yüzme',
    met: { hafif: 5.8, orta: 8.3, yuksek: 9.8 },
    intensityHint: { hafif: 'rahat tempo', orta: 'orta tempo', yuksek: 'hızlı' },
    stepsPerMin: null,
    hasDistance: true,
  },
  yoga: {
    label: 'Yoga',
    met: { hafif: 2.5, orta: 3.0, yuksek: 4.0 },
    intensityHint: { hafif: 'hatha / esneme', orta: 'genel', yuksek: 'power / vinyasa' },
    stepsPerMin: null,
    hasDistance: false,
  },
  pilates: {
    label: 'Pilates',
    met: { hafif: 2.8, orta: 3.0, yuksek: 4.0 },
    intensityHint: { hafif: 'başlangıç', orta: 'genel', yuksek: 'ileri / reformer yoğun' },
    stepsPerMin: null,
    hasDistance: false,
  },
  futbol: {
    label: 'Futbol',
    met: { hafif: 6.0, orta: 7.0, yuksek: 10.0 },
    intensityHint: { hafif: 'pas çalışması', orta: 'halı saha', yuksek: 'rekabetçi maç' },
    stepsPerMin: { hafif: 60, orta: 75, yuksek: 90 },
    hasDistance: false,
  },
  basketbol: {
    label: 'Basketbol',
    met: { hafif: 4.5, orta: 6.5, yuksek: 8.0 },
    intensityHint: { hafif: 'şut çalışması', orta: 'genel oyun', yuksek: 'maç' },
    stepsPerMin: { hafif: 40, orta: 70, yuksek: 85 },
    hasDistance: false,
  },
  dans: {
    label: 'Dans',
    met: { hafif: 3.0, orta: 4.8, yuksek: 7.3 },
    intensityHint: { hafif: 'yavaş', orta: 'genel', yuksek: 'aerobik / hızlı' },
    stepsPerMin: { hafif: 40, orta: 60, yuksek: 80 },
    hasDistance: false,
  },
  diger: {
    label: 'Diğer spor',
    met: { hafif: 3.5, orta: 5.0, yuksek: 7.0 },
    intensityHint: { hafif: 'hafif', orta: 'orta', yuksek: 'yoğun' },
    stepsPerMin: null,
    hasDistance: false,
  },
  ozel: {
    label: 'Özel aktivite',
    met: { hafif: 3.0, orta: 4.5, yuksek: 6.5 },
    intensityHint: { hafif: 'MET değerini düzenleyebilirsin', orta: 'MET değerini düzenleyebilirsin', yuksek: 'MET değerini düzenleyebilirsin' },
    stepsPerMin: null,
    hasDistance: false,
  },
};

export const INTENSITY_LABEL: Record<Intensity, string> = { hafif: 'Hafif', orta: 'Orta', yuksek: 'Yüksek' };
