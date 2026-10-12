import type { ActivityEntry, ActivityType, AllowancePct, Intensity, StepEntry } from '../db/types';
import { ACTIVITIES } from '../data/activities';

/** Brüt: MET × kg × saat. Net: (MET − 1) × kg × saat — dinlenme harcaması (1 MET) BMR/TDEE'de zaten sayılıyor. */
export function activityKcal(met: number, weightKg: number, durationMin: number): { gross: number; net: number } {
  const h = Math.max(0, durationMin) / 60;
  return { gross: met * weightKg * h, net: Math.max(0, met - 1) * weightKg * h };
}

/** Adım uzunluğu: boyun ~%41,4'ü (yaygın yaklaşım) */
export function strideM(heightCm: number): number {
  return (heightCm * 0.414) / 100;
}

/** Aktivitenin adım sayacına yansıyan tahmini adımı. Mesafe verilmişse mesafeden, yoksa süre × adım hızından. */
export function estimateActivitySteps(type: ActivityType, intensity: Intensity, durationMin: number, distanceKm: number | undefined, heightCm: number): number {
  const def = ACTIVITIES[type];
  if (!def.stepsPerMin) return 0;
  if ((type === 'yuruyus' || type === 'kosu') && distanceKm && distanceKm > 0) {
    const stride = strideM(heightCm) * (type === 'kosu' ? 1.6 : 1);
    return Math.round((distanceKm * 1000) / stride);
  }
  return Math.round(def.stepsPerMin[intensity] * Math.max(0, durationMin));
}

/** Yürüyüşün net maliyeti ≈ 0,5 kcal / kg / km (orta hızda, dinlenme harcaması hariç) */
export const NET_WALK_KCAL_PER_KG_KM = 0.5;

export function stepsNetKcal(steps: number, weightKg: number, heightCm: number): number {
  const km = (Math.max(0, steps) * strideM(heightCm)) / 1000;
  return km * weightKg * NET_WALK_KCAL_PER_KG_KM;
}

/** Bir günün adım sayısı: sağlık platformu verisi varsa o (ölçülmüş), yoksa manuel giriş. İkisi toplanmaz. */
export function stepsForDay(entries: StepEntry[]): { steps: number; source: 'health' | 'manual' | null } {
  const health = entries.find((e) => e.source === 'health');
  if (health) return { steps: health.steps, source: 'health' };
  const manual = entries.find((e) => e.source === 'manual');
  if (manual) return { steps: manual.steps, source: 'manual' };
  return { steps: 0, source: null };
}

function overlapMin(a: ActivityEntry, b: ActivityEntry): number {
  const aEnd = a.time + a.durationMin * 60_000;
  const bEnd = b.time + b.durationMin * 60_000;
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(a.time, b.time)) / 60_000;
}

/**
 * Sağlık platformundan gelen bir aktivite, aynı türde ve zaman aralığının yarısından fazlası
 * örtüşen manuel bir kayıtla çakışıyorsa mükerrer kabul edilir (manuel kayıt korunur).
 * Aynı externalId ile gelen tekrarlar da elenir.
 */
export function dedupeActivities(list: ActivityEntry[]): { counted: ActivityEntry[]; duplicates: ActivityEntry[] } {
  const counted: ActivityEntry[] = [];
  const duplicates: ActivityEntry[] = [];
  const seenExternal = new Set<string>();
  const manual = list.filter((a) => a.source === 'manual');
  for (const a of list) {
    if (a.source === 'health') {
      if (a.externalId) {
        if (seenExternal.has(a.externalId)) {
          duplicates.push(a);
          continue;
        }
        seenExternal.add(a.externalId);
      }
      const clash = manual.some((m) => m.type === a.type && overlapMin(m, a) > Math.min(m.durationMin, a.durationMin) / 2);
      if (clash) {
        duplicates.push(a);
        continue;
      }
    }
    counted.push(a);
  }
  return { counted, duplicates };
}

export interface ActivityBudget {
  /** Kayıtlı egzersizlerin net toplamı */
  exerciseNetKcal: number;
  exerciseGrossKcal: number;
  exerciseMin: number;
  steps: number;
  stepSource: 'health' | 'manual' | null;
  stepBaseline: number;
  /** Egzersizlere atanan tahmini adım (çift sayımı önlemek için düşülür) */
  stepsInExercises: number;
  /** Ek (taban ve egzersiz dışı) adım */
  extraSteps: number;
  extraStepsNetKcal: number;
  /** Toplam ek harcama (net) */
  totalExtraKcal: number;
  allowancePct: AllowancePct;
  /** Hedefe eklenen kısım */
  addedToTarget: number;
  duplicates: ActivityEntry[];
}

export function activityBudget(activities: ActivityEntry[], stepEntries: StepEntry[], opts: { weightKg: number; heightCm: number; stepBaseline: number; allowancePct: AllowancePct }): ActivityBudget {
  const { counted, duplicates } = dedupeActivities(activities);
  const exerciseNetKcal = counted.reduce((s, a) => s + a.netKcal, 0);
  const exerciseGrossKcal = counted.reduce((s, a) => s + a.grossKcal, 0);
  const exerciseMin = counted.reduce((s, a) => s + a.durationMin, 0);
  const { steps, source } = stepsForDay(stepEntries);
  const stepsInExercises = counted.reduce((s, a) => s + (a.estSteps || 0), 0);
  // Taban adım aktivite düzeyinde zaten var; egzersiz sırasında atılan adımlar egzersizde sayıldı.
  const extraSteps = Math.max(0, steps - opts.stepBaseline - stepsInExercises);
  const extraStepsNetKcal = stepsNetKcal(extraSteps, opts.weightKg, opts.heightCm);
  const totalExtraKcal = exerciseNetKcal + extraStepsNetKcal;
  const addedToTarget = Math.round((totalExtraKcal * opts.allowancePct) / 100);
  return {
    exerciseNetKcal,
    exerciseGrossKcal,
    exerciseMin,
    steps,
    stepSource: source,
    stepBaseline: opts.stepBaseline,
    stepsInExercises,
    extraSteps,
    extraStepsNetKcal,
    totalExtraKcal,
    allowancePct: opts.allowancePct,
    addedToTarget,
    duplicates,
  };
}
