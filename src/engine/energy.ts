import type { ActivityLevel, GoalType, Sex, UserProfile } from '../db/types';

/**
 * Aktivite düzeyleri. Çarpanlar Mifflin–St Jeor ile yaygın kullanılan PAL değerleridir.
 * ÖNEMLİ: Burada seçilen düzey, uygulamaya ayrıca kaydedilen egzersizleri İÇERMEZ.
 * Egzersizler net harcama olarak ayrıca eklenir; böylece aynı hareket iki kez sayılmaz.
 */
export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; desc: string; factor: number; stepBaseline: number }> = {
  sedentary: { label: 'Masa başı', desc: 'Günün çoğu oturarak geçer (kayıtlı egzersizler hariç)', factor: 1.2, stepBaseline: 4000 },
  light: { label: 'Hafif hareketli', desc: 'Ayakta çalışma, gün içinde yürüme', factor: 1.375, stepBaseline: 7000 },
  active: { label: 'Hareketli iş', desc: 'Bedensel çalışma gerektiren iş', factor: 1.55, stepBaseline: 10000 },
  very_active: { label: 'Ağır bedensel iş', desc: 'Gün boyu yoğun fiziksel çalışma', factor: 1.725, stepBaseline: 13000 },
};

export const GOAL_LABEL: Record<GoalType, string> = {
  maintain: 'Kilo koruma',
  lose: 'Kontrollü kilo verme',
  gain: 'Kontrollü kilo alma',
  manual: 'Manuel hedef',
};

/** 1 kg vücut ağırlığı değişimi için yaklaşık enerji (kaba ve yaygın kabul görmüş bir yaklaşım) */
export const KCAL_PER_KG = 7700;

/** Genel rehberlerde sık geçen alt sınırlar; bunların altı uzman gözetimi gerektirir */
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

export function ageFrom(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

/** Mifflin–St Jeor (1990): 10×kg + 6,25×cm − 5×yaş + (erkek +5 | kadın −161) */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export interface GoalCalc {
  bmr: number;
  tdee: number;
  target: number;
  dailyDelta: number;
  clamped: boolean;
  method: 'mifflin' | 'manual';
  steps: string[];
  warnings: string[];
}

const r = (n: number) => Math.round(n);
const fmt = (n: number) => r(n).toLocaleString('tr-TR');

export function calcGoal(p: Pick<UserProfile, 'birthYear' | 'sex' | 'heightCm' | 'currentWeightKg' | 'activityLevel' | 'goal' | 'rateKgPerWeek' | 'manualKcal' | 'specialCondition'>, now = new Date()): GoalCalc {
  const age = ageFrom(p.birthYear, now);
  const warnings: string[] = [];
  if (age < 18) warnings.push('18 yaş altı için yetişkin formülleri uygun olmayabilir; hedefi bir sağlık uzmanıyla belirlemen önerilir.');
  if (p.specialCondition) warnings.push('Hamilelik, emzirme veya özel tıbbi durumlarda standart formüller yetersiz kalabilir; hedefini doktorunla/diyetisyeninle belirle.');
  const bmr = bmrMifflin(p.sex, p.currentWeightKg, p.heightCm, age);
  const lvl = ACTIVITY_LEVELS[p.activityLevel];
  const tdee = bmr * lvl.factor;
  const steps = [
    `BMR (Mifflin–St Jeor) = 10 × ${p.currentWeightKg} kg + 6,25 × ${p.heightCm} cm − 5 × ${age} yaş ${p.sex === 'male' ? '+ 5' : '− 161'} = ${fmt(bmr)} kcal`,
    `Tahmini TDEE = BMR × ${lvl.factor.toLocaleString('tr-TR')} (${lvl.label}) = ${fmt(tdee)} kcal`,
  ];

  if (p.goal === 'manual') {
    const target = p.manualKcal ?? r(tdee);
    if (target < MIN_KCAL[p.sex]) warnings.push(`Girilen hedef (${fmt(target)} kcal) genel önerilen alt sınırın (${fmt(MIN_KCAL[p.sex])} kcal) altında. Bu düzeyde kısıtlama uzman gözetimi gerektirir.`);
    steps.push(`Manuel hedef: ${fmt(target)} kcal (hesaplanan TDEE yalnızca bilgi amaçlı)`);
    return { bmr, tdee, target, dailyDelta: target - tdee, clamped: false, method: 'manual', steps, warnings };
  }

  let delta = 0;
  if (p.goal === 'lose') delta = -(p.rateKgPerWeek * KCAL_PER_KG) / 7;
  if (p.goal === 'gain') delta = (p.rateKgPerWeek * KCAL_PER_KG) / 7;
  let target = tdee + delta;
  let clamped = false;
  if (p.goal !== 'maintain') {
    steps.push(`Haftalık ${p.rateKgPerWeek.toLocaleString('tr-TR')} kg × ${fmt(KCAL_PER_KG)} kcal ÷ 7 = günlük ${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} kcal`);
  }
  const floor = MIN_KCAL[p.sex];
  if (p.goal === 'lose' && target < floor) {
    target = floor;
    clamped = true;
    warnings.push(`Seçilen hız, hedefi genel önerilen alt sınırın (${fmt(floor)} kcal) altına indiriyordu; hedef bu sınırda tutuldu. Daha yavaş bir hız seçmeyi düşünebilirsin.`);
  }
  if (p.goal === 'lose' && target < bmr) {
    warnings.push(`Hedef, tahmini bazal metabolizmanın (${fmt(bmr)} kcal) altında. Bu tek başına zararlı değildir ama uzun süreli büyük açıklar yerine daha yavaş bir hız genellikle daha sürdürülebilirdir.`);
  }
  if (p.goal === 'lose' && p.rateKgPerWeek > p.currentWeightKg * 0.01) {
    warnings.push('Haftalık hedef, vücut ağırlığının %1\'inden fazla. Genel öneriler daha yavaş bir hız yönündedir.');
  }
  target = Math.round(target / 10) * 10;
  steps.push(`Günlük temel hedef ≈ ${fmt(target)} kcal`);
  return { bmr, tdee, target, dailyDelta: delta, clamped, method: 'mifflin', steps, warnings };
}

export interface MacroTargets {
  proteinG: number;
  carbG: number;
  fatG: number;
}

export function macroTargets(kcal: number, proteinPct: number, carbPct: number, fatPct: number): MacroTargets {
  return {
    proteinG: Math.round((kcal * proteinPct) / 100 / 4),
    carbG: Math.round((kcal * carbPct) / 100 / 4),
    fatG: Math.round((kcal * fatPct) / 100 / 9),
  };
}

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}
