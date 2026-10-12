import type { Nutrients } from '../db/types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, sugar: 0 };

const nullableMul = (v: number | null, f: number) => (v === null ? null : v * f);
const nullableAdd = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

/** 100 birim değerini `amount` birime ölçekler */
export function scale(per100: Nutrients, amount: number): Nutrients {
  const f = amount / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carb: per100.carb * f,
    fat: per100.fat * f,
    fiber: nullableMul(per100.fiber, f),
    sugar: nullableMul(per100.sugar, f),
  };
}

/**
 * İki besin değerini toplar. Bir tarafta lif/şeker bilinmiyorsa toplam da
 * "bilinmiyor" (null) olur — eksik veri sıfır gibi gösterilmez.
 */
export function add(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carb: a.carb + b.carb,
    fat: a.fat + b.fat,
    fiber: nullableAdd(a.fiber, b.fiber),
    sugar: nullableAdd(a.sugar, b.sugar),
  };
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce((acc, n) => add(acc, n), { ...ZERO });
}

/** Günlük toplamlar için: bilinmeyen lif/şeker toplamı bozmasın, ayrıca sayılsın */
export function sumLenient(list: Nutrients[]): Nutrients & { fiberUnknown: number; sugarUnknown: number } {
  let fiberUnknown = 0;
  let sugarUnknown = 0;
  const t = { ...ZERO };
  for (const n of list) {
    t.kcal += n.kcal;
    t.protein += n.protein;
    t.carb += n.carb;
    t.fat += n.fat;
    if (n.fiber === null) fiberUnknown++;
    else t.fiber = (t.fiber ?? 0) + n.fiber;
    if (n.sugar === null) sugarUnknown++;
    else t.sugar = (t.sugar ?? 0) + n.sugar;
  }
  return { ...t, fiberUnknown, sugarUnknown };
}

/** toplam → 100 birim başına */
export function per100Of(totals: Nutrients, totalAmount: number): Nutrients {
  if (totalAmount <= 0) return { ...ZERO };
  return scale(totals, (100 / totalAmount) * 100);
}

export function roundN(n: Nutrients, digits = 1): Nutrients {
  const r = (v: number) => Math.round(v * 10 ** digits) / 10 ** digits;
  return {
    kcal: Math.round(n.kcal),
    protein: r(n.protein),
    carb: r(n.carb),
    fat: r(n.fat),
    fiber: n.fiber === null ? null : r(n.fiber),
    sugar: n.sugar === null ? null : r(n.sugar),
  };
}

/** Saklama için: kalori dahil tüm alanlar 2 ondalık (100 g değerlerinde birikimli yuvarlama hatasını önler) */
export function roundPrecise(n: Nutrients): Nutrients {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { kcal: r(n.kcal), protein: r(n.protein), carb: r(n.carb), fat: r(n.fat), fiber: n.fiber === null ? null : r(n.fiber), sugar: n.sugar === null ? null : r(n.sugar) };
}

/** Makrolardan hesaplanan enerji (Atwater 4/4/9) — veri tutarlılık kontrolü için */
export function atwaterKcal(n: Pick<Nutrients, 'protein' | 'carb' | 'fat'>): number {
  return n.protein * 4 + n.carb * 4 + n.fat * 9;
}

export function nutrients(kcal: number, protein: number, carb: number, fat: number, fiber: number | null = null, sugar: number | null = null): Nutrients {
  return { kcal, protein, carb, fat, fiber, sugar };
}
