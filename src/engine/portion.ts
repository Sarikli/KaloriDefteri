import type { Food, FoodServing, Nutrients, ServingUnit, UserServing } from '../db/types';
import { scale } from './nutrition';

export const UNIT_LABEL: Record<ServingUnit, string> = {
  g: 'gram',
  ml: 'mililitre',
  adet: 'adet',
  porsiyon: 'porsiyon',
  yarim: 'yarım porsiyon',
  kase: 'kase',
  tabak: 'tabak',
  dilim: 'dilim',
  kepce: 'kepçe',
  bardak: 'bardak',
  yk: 'yemek kaşığı',
  tk: 'tatlı kaşığı',
  avuc: 'avuç',
  fincan: 'fincan',
  kutu: 'kutu',
  paket: 'paket',
  sis: 'şiş',
  kupa: 'kupa',
  sise: 'şişe',
  ozel: 'ölçü',
};

/**
 * Bir yemeğin seçilebilir ölçüleri:
 *  - yemeğin kendi ölçüleri (kullanıcı aynı kimlikle gram karşılığını değiştirdiyse o kullanılır)
 *  - kullanıcının eklediği kişisel ölçüler
 *  - varsayılan porsiyondan türetilen "yarım porsiyon"
 *  - her zaman gram (veya ml); sıvı tabanlılarda ayrıca ml/g
 */
export function servingsFor(food: Food, userServings: UserServing[] = []): FoodServing[] {
  const own = userServings.filter((s) => s.foodId === food.id);
  const overrides = new Map(own.map((s) => [s.id, s]));
  const list: FoodServing[] = food.servings.map((s) => {
    const o = overrides.get(s.id);
    return o ? { ...s, amount: o.amount, label: o.label } : s;
  });
  for (const s of own) if (!food.servings.some((f) => f.id === s.id)) list.push(s);

  const def = list.find((s) => s.isDefault) ?? list.find((s) => s.unit === 'porsiyon') ?? list[0];
  if (def && def.unit === 'porsiyon' && !list.some((s) => s.unit === 'yarim')) {
    list.push({ id: 'yarim', unit: 'yarim', label: 'Yarım porsiyon', amount: def.amount / 2 });
  }
  const baseUnit: ServingUnit = food.basis;
  list.push({ id: baseUnit, unit: baseUnit, label: baseUnit === 'g' ? 'Gram' : 'Mililitre', amount: 1 });
  return list;
}

export function defaultServing(food: Food, userServings: UserServing[] = []): FoodServing {
  const list = servingsFor(food, userServings);
  return list.find((s) => s.isDefault) ?? list[0];
}

/** Ölçü × adet → toplam g/ml */
export function amountFor(serving: FoodServing, count: number): number {
  return Math.max(0, serving.amount * count);
}

export function nutrientsFor(food: Pick<Food, 'per100'>, amount: number): Nutrients {
  return scale(food.per100, amount);
}

export function servingText(serving: FoodServing, count: number, basis: 'g' | 'ml'): string {
  const n = fmtCount(count);
  if (serving.unit === 'g' || serving.unit === 'ml') return `${n} ${serving.unit}`;
  const label = serving.label.replace(/^1\s+/, '');
  const amount = Math.round(serving.amount * count);
  return `${n} × ${label} (${amount} ${basis})`;
}

export function fmtCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}
