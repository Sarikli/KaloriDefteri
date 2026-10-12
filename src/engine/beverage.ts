import type { Beverage, BeverageAddons, BeverageEntry, BeverageIngredient, BeverageType, Nutrients } from '../db/types';
import { add, per100Of, scale, sum, ZERO, nutrients } from './nutrition';

export type BeverageGroup = 'water' | 'mineral' | 'coffee' | 'tea' | 'dairy' | 'juice' | 'soft' | 'other';

export const BEVERAGE_TYPES: Record<BeverageType, { label: string; group: BeverageGroup }> = {
  su: { label: 'Su', group: 'water' },
  maden_suyu: { label: 'Maden suyu', group: 'mineral' },
  filtre_kahve: { label: 'Filtre kahve', group: 'coffee' },
  espresso: { label: 'Espresso', group: 'coffee' },
  americano: { label: 'Americano', group: 'coffee' },
  turk_kahvesi: { label: 'Türk kahvesi', group: 'coffee' },
  latte: { label: 'Latte', group: 'coffee' },
  cappuccino: { label: 'Cappuccino', group: 'coffee' },
  soguk_kahve: { label: 'Soğuk kahve', group: 'coffee' },
  siyah_cay: { label: 'Siyah çay', group: 'tea' },
  yesil_cay: { label: 'Yeşil çay', group: 'tea' },
  bitki_cayi: { label: 'Bitki çayı', group: 'tea' },
  sut: { label: 'Süt', group: 'dairy' },
  ayran: { label: 'Ayran', group: 'dairy' },
  kefir: { label: 'Kefir', group: 'dairy' },
  meyve_suyu: { label: 'Meyve suyu', group: 'juice' },
  gazli: { label: 'Gazlı içecek', group: 'soft' },
  enerji: { label: 'Enerji içeceği', group: 'soft' },
  spor: { label: 'Spor içeceği', group: 'soft' },
  protein: { label: 'Protein içeceği', group: 'other' },
  smoothie: { label: 'Smoothie', group: 'juice' },
  diger: { label: 'Diğer içecek', group: 'other' },
  ozel: { label: 'Özel içecek', group: 'other' },
};

export const GROUP_LABEL: Record<BeverageGroup, string> = {
  water: 'Saf su',
  mineral: 'Maden suyu',
  coffee: 'Kahve',
  tea: 'Çay',
  dairy: 'Süt & ayran',
  juice: 'Meyve suyu & smoothie',
  soft: 'Gazlı & enerji',
  other: 'Diğer',
};

/** Tam yağlı süt ve toz şeker — eklenti hesapları için referans değerler (100 ml / 100 g) */
export const MILK_PER100: Nutrients = nutrients(61, 3.15, 4.8, 3.25, 0, 5.05);
export const SUGAR_PER100: Nutrients = nutrients(387, 0, 100, 0, 0, 100);
export const NO_ADDONS: BeverageAddons = { sugarG: 0, milkMl: 0 };

export function groupOf(type: BeverageType): BeverageGroup {
  return BEVERAGE_TYPES[type].group;
}

/** Saf su yalnızca doğrudan içilen sudur (tür = su). Kahve/çay vb. buraya eklenmez. */
export function isPureWater(type: BeverageType): boolean {
  return type === 'su';
}

export interface ComposedBeverage {
  totalMl: number;
  totals: Nutrients;
  per100ml: Nutrients;
  /** Herhangi bir kafeinli bileşenin değeri bilinmiyorsa null */
  caffeinePer100ml: number | null;
  caffeineTotal: number | null;
}

/** "Benim kahvem" gibi bileşik içecekleri hesaplar */
export function composeBeverage(ingredients: BeverageIngredient[]): ComposedBeverage {
  const totalMl = ingredients.filter((i) => i.addsVolume).reduce((s, i) => s + i.amount, 0);
  const totals = ingredients.length ? sum(ingredients.map((i) => scale(i.per100, i.amount))) : { ...ZERO };
  let caffeineTotal: number | null = 0;
  for (const i of ingredients) {
    if (i.caffeinePer100 === null) {
      caffeineTotal = null;
      break;
    }
    caffeineTotal += (i.caffeinePer100 * i.amount) / 100;
  }
  return {
    totalMl,
    totals,
    per100ml: per100Of(totals, totalMl),
    caffeinePer100ml: caffeineTotal === null ? null : totalMl > 0 ? (caffeineTotal / totalMl) * 100 : 0,
    caffeineTotal,
  };
}

export interface BeverageCalc {
  ml: number;
  totals: Nutrients;
  caffeineMg: number | null;
}

/**
 * Tek bir içecek kaydının değerleri. Eklenen süt hacme ve kaloriye,
 * eklenen şeker yalnızca kaloriye/şekere yansır.
 */
export function calcBeverageEntry(bev: Pick<Beverage, 'per100ml' | 'caffeinePer100ml'>, baseMl: number, addons: BeverageAddons = NO_ADDONS): BeverageCalc {
  let totals = scale(bev.per100ml, baseMl);
  if (addons.milkMl > 0) totals = add(totals, scale(MILK_PER100, addons.milkMl));
  if (addons.sugarG > 0) totals = add(totals, scale(SUGAR_PER100, addons.sugarG));
  return {
    ml: baseMl + Math.max(0, addons.milkMl),
    totals,
    caffeineMg: bev.caffeinePer100ml === null ? null : (bev.caffeinePer100ml * baseMl) / 100,
  };
}

export interface CaffeineSummary {
  /** Değeri bilinen kayıtlardan toplam (mg) */
  knownMg: number;
  /** Kafein değeri bilinmeyen kayıt sayısı */
  unknownCount: number;
  /** Tüm kayıtların değeri biliniyorsa true; değilse toplam "en az" olarak okunmalı */
  complete: boolean;
  coffeeMg: number;
  teaMg: number;
  otherMg: number;
  lastCaffeineTime: number | null;
}

export interface BeverageSummary {
  totalMl: number;
  pureWaterMl: number;
  nonWaterMl: number;
  kcal: number;
  sugarG: number;
  sugarUnknown: number;
  byType: Partial<Record<BeverageType, number>>;
  byGroup: Record<BeverageGroup, number>;
  caffeine: CaffeineSummary;
  count: number;
}

export function summarizeBeverages(entries: BeverageEntry[]): BeverageSummary {
  const byGroup: Record<BeverageGroup, number> = { water: 0, mineral: 0, coffee: 0, tea: 0, dairy: 0, juice: 0, soft: 0, other: 0 };
  const byType: Partial<Record<BeverageType, number>> = {};
  const caffeine: CaffeineSummary = { knownMg: 0, unknownCount: 0, complete: true, coffeeMg: 0, teaMg: 0, otherMg: 0, lastCaffeineTime: null };
  let totalMl = 0;
  let pureWaterMl = 0;
  let kcal = 0;
  let sugarG = 0;
  let sugarUnknown = 0;
  for (const e of entries) {
    totalMl += e.ml;
    if (isPureWater(e.type)) pureWaterMl += e.ml;
    byType[e.type] = (byType[e.type] ?? 0) + e.ml;
    const g = groupOf(e.type);
    byGroup[g] += e.ml;
    kcal += e.totals.kcal;
    if (e.totals.sugar === null) sugarUnknown++;
    else sugarG += e.totals.sugar;
    if (e.caffeineMg === null) {
      caffeine.unknownCount++;
      caffeine.complete = false;
    } else if (e.caffeineMg > 0) {
      caffeine.knownMg += e.caffeineMg;
      if (g === 'coffee') caffeine.coffeeMg += e.caffeineMg;
      else if (g === 'tea') caffeine.teaMg += e.caffeineMg;
      else caffeine.otherMg += e.caffeineMg;
      if (caffeine.lastCaffeineTime === null || e.time > caffeine.lastCaffeineTime) caffeine.lastCaffeineTime = e.time;
    }
  }
  return { totalMl, pureWaterMl, nonWaterMl: totalMl - pureWaterMl, kcal, sugarG, sugarUnknown, byType, byGroup, caffeine, count: entries.length };
}

/** "180 mg" ya da bilinmeyen kayıt varsa "en az 180 mg" */
export function caffeineText(c: CaffeineSummary): string {
  const v = Math.round(c.knownMg);
  if (c.complete) return `${v} mg`;
  if (v === 0) return 'bilinmiyor';
  return `en az ${v} mg`;
}
