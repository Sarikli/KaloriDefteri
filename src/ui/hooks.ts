import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/database';
import { defaultGoal, defaultSettings } from '../db/repo';
import type { AppSettings, Beverage, DailyGoalSettings, DateKey, Food, UserProfile } from '../db/types';
import { BUILTIN_FOODS } from '../data/foods';
import { BUILTIN_BEVERAGES } from '../data/beverages';
import { goalForDate } from '../engine/daily';
import { addDays } from '../engine/dates';

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? defaultSettings(), []);
}

export function useProfile(): UserProfile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useGoals(): DailyGoalSettings[] | undefined {
  return useLiveQuery(() => db.goals.toArray(), []);
}

export function useGoalFor(date: DateKey): DailyGoalSettings {
  const goals = useGoals();
  return useMemo(() => (goals?.length ? goalForDate(goals, date)! : defaultGoal()), [goals, date]);
}

export function useDay(date: DateKey) {
  return useLiveQuery(async () => {
    const [meals, beverages, activities, steps, weights] = await Promise.all([
      db.mealEntries.where('date').equals(date).sortBy('time'),
      db.beverageEntries.where('date').equals(date).sortBy('time'),
      db.activities.where('date').equals(date).sortBy('time'),
      db.steps.where('date').equals(date).toArray(),
      db.weights.where('date').equals(date).toArray(),
    ]);
    return { meals, beverages, activities, steps, weights };
  }, [date]);
}

export function useRange(from: DateKey, to: DateKey) {
  return useLiveQuery(async () => {
    const [meals, beverages, activities, steps, weights] = await Promise.all([
      db.mealEntries.where('date').between(from, to, true, true).toArray(),
      db.beverageEntries.where('date').between(from, to, true, true).toArray(),
      db.activities.where('date').between(from, to, true, true).toArray(),
      db.steps.where('date').between(from, to, true, true).toArray(),
      db.weights.toArray(),
    ]);
    return { meals, beverages, activities, steps, weights };
  }, [from, to]);
}

/** Yerleşik + kişisel yemekler (arşivlenenler hariç) */
export function useAllFoods(): Food[] {
  const user = useLiveQuery(() => db.foods.toArray(), []);
  return useMemo(() => [...(user ?? []).filter((f) => !f.archived), ...BUILTIN_FOODS], [user]);
}

export function useAllBeverages(): Beverage[] {
  const user = useLiveQuery(() => db.beverages.toArray(), []);
  return useMemo(() => [...(user ?? []).filter((b) => !b.archived), ...BUILTIN_BEVERAGES], [user]);
}

export function useFavorites() {
  return useLiveQuery(async () => (await db.favorites.toArray()).sort((a, b) => a.order - b.order), []) ?? [];
}

/** Son 60 günün kullanım istatistiği: son kullanılanlar ve sık kullanılanlar */
export function useUsage(today: DateKey) {
  return useLiveQuery(async () => {
    const from = addDays(today, -60);
    const meals = await db.mealEntries.where('date').between(from, today, true, true).toArray();
    const bevs = await db.beverageEntries.where('date').between(from, today, true, true).toArray();
    const foodCount = new Map<string, number>();
    const foodLast = new Map<string, number>();
    for (const m of meals) {
      if (!m.foodId) continue;
      foodCount.set(m.foodId, (foodCount.get(m.foodId) ?? 0) + 1);
      foodLast.set(m.foodId, Math.max(foodLast.get(m.foodId) ?? 0, m.time));
    }
    const bevCount = new Map<string, number>();
    const bevMl = new Map<string, Map<number, number>>();
    for (const b of bevs) {
      bevCount.set(b.beverageId, (bevCount.get(b.beverageId) ?? 0) + 1);
      const m = bevMl.get(b.beverageId) ?? new Map<number, number>();
      m.set(b.baseMl, (m.get(b.baseMl) ?? 0) + 1);
      bevMl.set(b.beverageId, m);
    }
    const recentFoods = [...foodLast.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const frequentFoods = [...foodCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    /** İçecek başına en sık kullanılan miktar */
    const usualMl = new Map<string, number>();
    for (const [id, m] of bevMl) usualMl.set(id, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    return { recentFoods, frequentFoods, foodCount, bevCount, usualMl };
  }, [today]);
}
