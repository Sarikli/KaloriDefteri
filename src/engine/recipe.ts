import type { Nutrients, RecipeIngredient } from '../db/types';
import { per100Of, scale, sum, ZERO } from './nutrition';

export interface RecipeResult {
  /** Malzemelerin çiğ toplam ağırlığı (ml ≈ g kabulüyle) */
  rawWeight: number;
  /** Hesapta kullanılan son ağırlık: pişmiş ağırlık girildiyse o, yoksa çiğ toplam */
  finalWeight: number;
  totals: Nutrients;
  per100: Nutrients;
  perServing: Nutrients;
  servingWeight: number;
  /** Pişirmede ağırlık değişimi (%) — su kaybı/kazancı */
  weightChangePct: number | null;
  warnings: string[];
}

/**
 * Tarif hesaplayıcı.
 * Pişirme sırasında ağırlık değişir (su buharlaşır ya da pirinç/bulgur su çeker);
 * bu, 100 g başına değerleri değiştirir ama tarifin toplam enerjisini değiştirmez.
 * Pişirmeye bağlı vitamin/besin kayıpları modellenmez; sonuç tahmindir.
 */
export function computeRecipe(ingredients: RecipeIngredient[], cookedWeightG: number | null, servings: number): RecipeResult {
  const warnings: string[] = [];
  const totals = ingredients.length ? sum(ingredients.map((i) => scale(i.per100, i.amount))) : { ...ZERO };
  const rawWeight = ingredients.reduce((s, i) => s + i.amount, 0);
  const cooked = cookedWeightG && cookedWeightG > 0 ? cookedWeightG : null;
  const finalWeight = cooked ?? rawWeight;
  const safeServings = servings > 0 ? servings : 1;
  if (!(servings > 0)) warnings.push('Porsiyon sayısı 1 kabul edildi.');
  if (ingredients.some((i) => i.basis === 'ml')) warnings.push('Sıvı malzemelerde 1 ml ≈ 1 g kabul edildi.');
  let weightChangePct: number | null = null;
  if (cooked && rawWeight > 0) {
    weightChangePct = ((cooked - rawWeight) / rawWeight) * 100;
    if (weightChangePct < -70 || weightChangePct > 300) {
      warnings.push('Pişmiş ağırlık çiğ toplamdan çok farklı; tartımı kontrol et.');
    }
  }
  return {
    rawWeight,
    finalWeight,
    totals,
    per100: per100Of(totals, finalWeight),
    perServing: scale(totals, 100 / safeServings),
    servingWeight: finalWeight / safeServings,
    weightChangePct,
    warnings,
  };
}
