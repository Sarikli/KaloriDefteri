import type { ActivityEntry, BeverageEntry, DailyGoalSettings, MealDef, MealEntry, Nutrients, StepEntry } from '../db/types';
import { activityBudget, type ActivityBudget } from './activity';
import { summarizeBeverages, type BeverageSummary } from './beverage';
import { macroTargets, type MacroTargets } from './energy';
import { sumLenient } from './nutrition';

export interface DaySummary {
  food: ReturnType<typeof sumLenient>;
  drinks: ReturnType<typeof sumLenient>;
  /** Yemek + içecek; her kayıt yalnızca bir kez sayılır */
  total: ReturnType<typeof sumLenient>;
  beverages: BeverageSummary;
  activity: ActivityBudget;
  baseKcal: number;
  targetKcal: number;
  remainingKcal: number;
  macros: MacroTargets;
  perMeal: Record<string, { kcal: number; count: number }>;
  goal: DailyGoalSettings;
}

export function summarizeDay(input: {
  meals: MealEntry[];
  beverages: BeverageEntry[];
  activities: ActivityEntry[];
  steps: StepEntry[];
  goal: DailyGoalSettings;
  mealDefs: MealDef[];
  weightKg: number;
  heightCm: number;
}): DaySummary {
  const food = sumLenient(input.meals.map((m) => m.totals));
  const drinks = sumLenient(input.beverages.map((b) => b.totals));
  const total = sumLenient([...input.meals.map((m) => m.totals), ...input.beverages.map((b) => b.totals)] as Nutrients[]);
  const beverages = summarizeBeverages(input.beverages);
  const activity = activityBudget(input.activities, input.steps, {
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    stepBaseline: input.goal.stepBaseline,
    allowancePct: input.goal.exerciseAllowancePct,
  });
  const baseKcal = input.goal.baseKcal;
  const targetKcal = baseKcal + activity.addedToTarget;
  const perMeal: Record<string, { kcal: number; count: number }> = {};
  for (const d of input.mealDefs) perMeal[d.id] = { kcal: 0, count: 0 };
  for (const m of input.meals) {
    perMeal[m.mealId] ??= { kcal: 0, count: 0 };
    perMeal[m.mealId].kcal += m.totals.kcal;
    perMeal[m.mealId].count++;
  }
  return {
    food,
    drinks,
    total,
    beverages,
    activity,
    baseKcal,
    targetKcal,
    remainingKcal: targetKcal - total.kcal,
    macros: macroTargets(targetKcal, input.goal.proteinPct, input.goal.carbPct, input.goal.fatPct),
    perMeal,
    goal: input.goal,
  };
}

/** Bir tarihte geçerli hedef: effectiveFrom ≤ tarih olan en son kayıt */
export function goalForDate(goals: DailyGoalSettings[], date: string): DailyGoalSettings | undefined {
  let best: DailyGoalSettings | undefined;
  for (const g of goals) if (g.effectiveFrom <= date && (!best || g.effectiveFrom > best.effectiveFrom)) best = g;
  return best ?? [...goals].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
}
