import type { ActivityEntry, BeverageEntry, DailyGoalSettings, DateKey, MealEntry, StepEntry, WeightEntry } from '../db/types';
import { activityBudget } from './activity';
import { groupOf, summarizeBeverages, type BeverageGroup } from './beverage';
import { goalForDate } from './daily';
import { diffDays, rangeKeys, weekStart } from './dates';

export interface DayPoint {
  date: DateKey;
  hasFood: boolean;
  hasDrink: boolean;
  hasActivity: boolean;
  kcal: number;
  foodKcal: number;
  drinkKcal: number;
  protein: number;
  carb: number;
  fat: number;
  baseKcal: number | null;
  targetKcal: number | null;
  totalMl: number;
  waterMl: number;
  byGroup: Record<BeverageGroup, number>;
  coffeeCount: number;
  caffeineMg: number;
  caffeineComplete: boolean;
  exerciseMin: number;
  exerciseNetKcal: number;
  addedKcal: number;
  steps: number | null;
  weightKg: number | null;
}

function groupBy<T extends { date: DateKey }>(list: T[]): Map<DateKey, T[]> {
  const m = new Map<DateKey, T[]>();
  for (const x of list) {
    const arr = m.get(x.date);
    if (arr) arr.push(x);
    else m.set(x.date, [x]);
  }
  return m;
}

export function buildDaySeries(input: {
  from: DateKey;
  to: DateKey;
  meals: MealEntry[];
  beverages: BeverageEntry[];
  activities: ActivityEntry[];
  steps: StepEntry[];
  weights: WeightEntry[];
  goals: DailyGoalSettings[];
  weightKg: number;
  heightCm: number;
}): DayPoint[] {
  const meals = groupBy(input.meals);
  const bevs = groupBy(input.beverages);
  const acts = groupBy(input.activities);
  const steps = groupBy(input.steps);
  const weights = groupBy(input.weights);
  return rangeKeys(input.from, input.to).map((date) => {
    const m = meals.get(date) ?? [];
    const b = bevs.get(date) ?? [];
    const a = acts.get(date) ?? [];
    const s = steps.get(date) ?? [];
    const w = (weights.get(date) ?? []).filter((x) => x.weightKg !== null).sort((x, y) => y.time - x.time)[0];
    const goal = input.goals.length ? goalForDate(input.goals, date) : undefined;
    const bs = summarizeBeverages(b);
    const budget = goal
      ? activityBudget(a, s, { weightKg: input.weightKg, heightCm: input.heightCm, stepBaseline: goal.stepBaseline, allowancePct: goal.exerciseAllowancePct })
      : null;
    const foodKcal = m.reduce((x, e) => x + e.totals.kcal, 0);
    const drinkKcal = bs.kcal;
    return {
      date,
      hasFood: m.length > 0,
      hasDrink: b.length > 0,
      hasActivity: a.length > 0 || s.length > 0,
      kcal: foodKcal + drinkKcal,
      foodKcal,
      drinkKcal,
      protein: [...m, ...b].reduce((x, e) => x + e.totals.protein, 0),
      carb: [...m, ...b].reduce((x, e) => x + e.totals.carb, 0),
      fat: [...m, ...b].reduce((x, e) => x + e.totals.fat, 0),
      baseKcal: goal?.baseKcal ?? null,
      targetKcal: goal ? goal.baseKcal + (budget?.addedToTarget ?? 0) : null,
      totalMl: bs.totalMl,
      waterMl: bs.pureWaterMl,
      byGroup: bs.byGroup,
      coffeeCount: b.filter((e) => groupOf(e.type) === 'coffee').length,
      caffeineMg: bs.caffeine.knownMg,
      caffeineComplete: bs.caffeine.complete,
      exerciseMin: budget?.exerciseMin ?? a.reduce((x, e) => x + e.durationMin, 0),
      exerciseNetKcal: budget?.exerciseNetKcal ?? 0,
      addedKcal: budget?.addedToTarget ?? 0,
      steps: s.length ? (s.find((x) => x.source === 'health') ?? s[0]).steps : null,
      weightKg: w?.weightKg ?? null,
    };
  });
}

export interface Avg {
  value: number | null;
  /** Ortalamaya giren (kaydı olan) gün sayısı */
  days: number;
  totalDays: number;
}

/**
 * Yalnızca kaydı olan günlerin ortalaması. Kaydı olmayan günler 0 tüketim sayılmaz;
 * kaç günün veri içerdiği ayrıca bildirilir.
 */
export function averageOver(points: DayPoint[], pick: (p: DayPoint) => number | null, has: (p: DayPoint) => boolean): Avg {
  const vals = points.filter(has).map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
  return { value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, days: vals.length, totalDays: points.length };
}

export interface WeeklyWeight {
  week: DateKey;
  avg: number;
  count: number;
}

export function weeklyWeightAverages(weights: WeightEntry[]): WeeklyWeight[] {
  const m = new Map<DateKey, number[]>();
  for (const w of weights) {
    if (w.weightKg === null) continue;
    const k = weekStart(w.date);
    m.set(k, [...(m.get(k) ?? []), w.weightKg]);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, v]) => ({ week, avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }));
}

export interface WeightTrend {
  /** kg / hafta (doğrusal regresyon eğimi) */
  slopePerWeek: number;
  points: number;
  spanDays: number;
  /** Hedefe kaba tahmini süre (hafta); trend ters yöndeyse null */
  weeksToTarget: number | null;
}

/**
 * Kilo eğilimi: son kayıtların doğrusal regresyonu.
 * Günlük dalgalanmalar (su, tuz, sindirim) yağ değişimi anlamına gelmez;
 * bu yüzden en az 4 ölçüm ve 10 günlük aralık olmadan eğilim hesaplanmaz.
 */
export function weightTrend(weights: WeightEntry[], targetKg?: number): WeightTrend | null {
  const pts = weights.filter((w) => w.weightKg !== null).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 4) return null;
  const first = pts[0].date;
  const span = diffDays(pts[pts.length - 1].date, first);
  if (span < 10) return null;
  const xs = pts.map((p) => diffDays(p.date, first));
  const ys = pts.map((p) => p.weightKg as number);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slopeDay = den === 0 ? 0 : num / den;
  const slopePerWeek = slopeDay * 7;
  let weeksToTarget: number | null = null;
  if (targetKg !== undefined && Math.abs(slopePerWeek) > 0.02) {
    const current = my + slopeDay * (xs[n - 1] - mx);
    const w = (targetKg - current) / slopePerWeek;
    weeksToTarget = w > 0 ? w : null;
  }
  return { slopePerWeek, points: n, spanDays: span, weeksToTarget };
}

/** Bir günde aynı içecek grubunun içilme saatleri (0–23) */
export function drinkHours(entries: BeverageEntry[]): Array<{ group: BeverageGroup; hour: number; minute: number; ml: number; name: string }> {
  return entries
    .map((e) => {
      const d = new Date(e.time);
      return { group: groupOf(e.type), hour: d.getHours(), minute: d.getMinutes(), ml: e.ml, name: e.name };
    })
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}
