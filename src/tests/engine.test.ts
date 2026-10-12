import { describe, expect, it } from 'vitest';
import { BUILTIN_FOODS, BUILTIN_FOOD_MAP } from '../data/foods';
import { BUILTIN_BEVERAGES, BUILTIN_BEVERAGE_MAP } from '../data/beverages';
import { CATEGORIES } from '../data/categories';
import { calcBeverageEntry, caffeineText, composeBeverage, summarizeBeverages } from '../engine/beverage';
import { buildBeverageEntry, buildMealEntry, buildActivity, defaultGoal, DEFAULT_MEALS } from '../db/repo';
import { activityBudget, dedupeActivities, stepsNetKcal } from '../engine/activity';
import { bmrMifflin, calcGoal } from '../engine/energy';
import { computeRecipe } from '../engine/recipe';
import { servingsFor } from '../engine/portion';
import { summarizeDay } from '../engine/daily';
import { averageOver, buildDaySeries, weightTrend } from '../engine/stats';
import { addDays, rangeKeys, toDateKey, timeOnDate } from '../engine/dates';
import { normalizeTr, search } from '../engine/search';
import { atwaterKcal } from '../engine/nutrition';
import type { BeverageEntry, StepEntry, WeightEntry } from '../db/types';

const food = (id: string) => BUILTIN_FOOD_MAP.get(`tr:${id}`)!;
const bev = (id: string) => BUILTIN_BEVERAGE_MAP.get(`bv:${id}`)!;
const goal = { ...defaultGoal(), baseKcal: 2200, exerciseAllowancePct: 100 as const, stepBaseline: 5000 };

describe('Yemek veritabanı', () => {
  it('en az 250 kayıt ve en az 150 Türk mutfağı kaydı içerir', () => {
    expect(BUILTIN_FOODS.length).toBeGreaterThanOrEqual(250);
    expect(BUILTIN_FOODS.filter((f) => f.cuisine === 'tr').length).toBeGreaterThanOrEqual(150);
  });
  it('kimlikler benzersiz, kategoriler geçerli, her kayıtta kaynak ve güvenilirlik var', () => {
    const ids = new Set(BUILTIN_FOODS.map((f) => f.id));
    expect(ids.size).toBe(BUILTIN_FOODS.length);
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const f of BUILTIN_FOODS) {
      expect(cats.has(f.categoryId), f.name).toBe(true);
      expect(f.source).toBeTruthy();
      expect(f.confidence).toBeTruthy();
      expect(f.servings.length, f.name).toBeGreaterThan(0);
      expect(f.servings.filter((s) => s.isDefault).length, f.name).toBe(1);
      for (const s of f.servings) expect(s.amount, `${f.name} ${s.label}`).toBeGreaterThan(0);
    }
  });
  it('makrolar ile kalori tutarlı (Atwater ±%25 veya ±25 kcal)', () => {
    const bad = BUILTIN_FOODS.filter((f) => {
      const a = atwaterKcal(f.per100);
      return Math.abs(a - f.per100.kcal) > Math.max(25, f.per100.kcal * 0.25);
    }).map((f) => `${f.name}: ${f.per100.kcal} vs ${Math.round(atwaterKcal(f.per100))}`);
    expect(bad).toEqual([]);
  });
  it('varyasyonlar var olan ana kayda bağlı', () => {
    for (const f of BUILTIN_FOODS.filter((x) => x.variantOf)) expect(BUILTIN_FOOD_MAP.has(f.variantOf!), f.name).toBe(true);
  });
  it('içecek kimlikleri benzersiz', () => {
    expect(new Set(BUILTIN_BEVERAGES.map((b) => b.id)).size).toBe(BUILTIN_BEVERAGES.length);
  });
});

describe('Porsiyon hesabı', () => {
  it('miktar değişince kalori doğru güncellenir', () => {
    const f = food('mercimek-corbasi');
    const kase = servingsFor(f).find((s) => s.unit === 'kase')!;
    const one = buildMealEntry({ food: f, serving: kase, count: 1, date: '2026-10-13', mealId: 'ogle' });
    const two = buildMealEntry({ food: f, serving: kase, count: 2, date: '2026-10-13', mealId: 'ogle' });
    expect(one.totals.kcal).toBeCloseTo(62 * 2.5, 1);
    expect(two.totals.kcal).toBeCloseTo(one.totals.kcal * 2, 1);
    const gram = servingsFor(f).find((s) => s.unit === 'g')!;
    const g150 = buildMealEntry({ food: f, serving: gram, count: 150, date: '2026-10-13', mealId: 'ogle' });
    expect(g150.totals.kcal).toBeCloseTo(93, 1);
  });
  it('yarım porsiyon varsayılan porsiyonun yarısıdır', () => {
    const f = food('kuru-fasulye');
    const list = servingsFor(f);
    const tam = list.find((s) => s.unit === 'porsiyon')!;
    const yarim = list.find((s) => s.unit === 'yarim')!;
    expect(yarim.amount).toBe(tam.amount / 2);
  });
  it('kişisel porsiyon yerleşik ölçünün gram karşılığını değiştirir', () => {
    const f = food('mercimek-corbasi');
    const kase = f.servings.find((s) => s.unit === 'kase')!;
    const list = servingsFor(f, [{ ...kase, amount: 320, foodId: f.id, createdAt: 0 }]);
    expect(list.find((s) => s.id === kase.id)!.amount).toBe(320);
  });
});

describe('Tarif hesabı', () => {
  it('malzemelerden toplam, 100 g ve porsiyon değerlerini hesaplar; pişmiş ağırlığı dikkate alır', () => {
    const ing = [
      { f: food('tavuk-gogsu-cig'), g: 500 },
      { f: food('pirinc-cig'), g: 200 },
      { f: food('aycicek-yagi'), g: 30 },
      { f: food('sogan'), g: 100 },
    ].map(({ f, g }) => ({ kind: 'food' as const, refId: f.id, name: f.name, amount: g, basis: 'g' as const, per100: f.per100 }));
    const expectedKcal = 120 * 5 + 365 * 2 + 884 * 0.3 + 40;
    const r = computeRecipe(ing, 1100, 4);
    expect(r.totals.kcal).toBeCloseTo(expectedKcal, 3);
    expect(r.rawWeight).toBe(830);
    expect(r.per100.kcal).toBeCloseTo((expectedKcal / 1100) * 100, 3);
    expect(r.perServing.kcal).toBeCloseTo(expectedKcal / 4, 3);
    expect(r.servingWeight).toBe(275);
    expect(r.weightChangePct).toBeCloseTo(((1100 - 830) / 830) * 100, 3);
    const raw = computeRecipe(ing, null, 4);
    expect(raw.per100.kcal).toBeCloseTo((expectedKcal / 830) * 100, 3);
    expect(raw.totals.kcal).toBeCloseTo(r.totals.kcal, 6); // pişirme toplam enerjiyi değiştirmez
  });
});

describe('İçecek takibi', () => {
  const d = '2026-10-13';
  const entries: BeverageEntry[] = [
    buildBeverageEntry({ beverage: bev('su'), baseMl: 500, date: d, time: timeOnDate(d, '08:00') }),
    buildBeverageEntry({ beverage: bev('filtre-kahve'), baseMl: 300, date: d, time: timeOnDate(d, '09:00') }),
    buildBeverageEntry({ beverage: bev('ayran'), baseMl: 200, date: d, time: timeOnDate(d, '13:00') }),
    buildBeverageEntry({ beverage: bev('siyah-cay'), baseMl: 250, date: d, time: timeOnDate(d, '16:00') }),
    buildBeverageEntry({ beverage: bev('kola'), baseMl: 330, date: d, time: timeOnDate(d, '19:00') }),
  ];
  const s = summarizeBeverages(entries);

  it('toplam hacim ve türlere göre ayrım doğru (örnek: 1.580 ml)', () => {
    expect(s.totalMl).toBe(1580);
    expect(s.pureWaterMl).toBe(500);
    expect(s.byType.filtre_kahve).toBe(300);
    expect(s.byType.ayran).toBe(200);
    expect(s.byType.siyah_cay).toBe(250);
    expect(s.byType.gazli).toBe(330);
    expect(s.byGroup.coffee).toBe(300);
    expect(s.byGroup.tea).toBe(250);
  });
  it('300 ml filtre kahve toplam hacme eklenir ama saf suyu artırmaz', () => {
    const only = summarizeBeverages([entries[1]]);
    expect(only.totalMl).toBe(300);
    expect(only.pureWaterMl).toBe(0);
  });
  it('sütlü ve şekerli kahvenin kalorisi hesaba katılır', () => {
    const plain = calcBeverageEntry(bev('filtre-kahve'), 250);
    const withMilkSugar = calcBeverageEntry(bev('filtre-kahve'), 250, { milkMl: 50, sugarG: 5 });
    expect(withMilkSugar.totals.kcal - plain.totals.kcal).toBeCloseTo(61 * 0.5 + 387 * 0.05, 3);
    expect(withMilkSugar.ml).toBe(300);
  });
  it('"Benim kahvem" bileşenlerden hesaplanır', () => {
    const coffee = bev('filtre-kahve');
    const milk = bev('sut');
    const sugar = food('seker');
    const c = composeBeverage([
      { kind: 'beverage', refId: coffee.id, name: coffee.name, amount: 250, basis: 'ml', per100: coffee.per100ml, caffeinePer100: 40, addsVolume: true },
      { kind: 'beverage', refId: milk.id, name: milk.name, amount: 50, basis: 'ml', per100: milk.per100ml, caffeinePer100: 0, addsVolume: true },
      { kind: 'food', refId: sugar.id, name: sugar.name, amount: 5, basis: 'g', per100: sugar.per100, caffeinePer100: 0, addsVolume: false },
    ]);
    expect(c.totalMl).toBe(300);
    expect(c.totals.kcal).toBeCloseTo(2.5 + 30.5 + 19.35, 2);
    expect(c.caffeineTotal).toBeCloseTo(100, 5);
  });
  it('içecekler günlük kaloriye bir kez girer (çift sayım yok)', () => {
    const meal = buildMealEntry({ food: food('simit'), serving: food('simit').servings[0], count: 1, date: d, mealId: 'kahvalti' });
    const sum = summarizeDay({ meals: [meal], beverages: entries, activities: [], steps: [], goal, mealDefs: DEFAULT_MEALS, weightKg: 70, heightCm: 175 });
    const bevKcal = entries.reduce((a, e) => a + e.totals.kcal, 0);
    expect(sum.total.kcal).toBeCloseTo(meal.totals.kcal + bevKcal, 5);
    expect(sum.drinks.kcal).toBeCloseTo(bevKcal, 5);
    expect(sum.beverages.kcal).toBeCloseTo(bevKcal, 5);
  });
  it('bilinmeyen kafein sıfır sayılmaz', () => {
    const cold = buildBeverageEntry({ beverage: bev('soguk-kahve'), baseMl: 350, date: d });
    expect(cold.caffeineMg).toBeNull();
    const sum = summarizeBeverages([entries[1], cold]);
    expect(sum.caffeine.complete).toBe(false);
    expect(sum.caffeine.unknownCount).toBe(1);
    expect(caffeineText(sum.caffeine)).toBe('en az 120 mg');
    expect(caffeineText(summarizeBeverages([cold]).caffeine)).toBe('bilinmiyor');
  });
  it('kahve ve çay kafeini ayrı gösterilir; son kafein saati doğru', () => {
    expect(s.caffeine.coffeeMg).toBeCloseTo(120, 5);
    expect(s.caffeine.teaMg).toBeCloseTo(50, 5);
    expect(s.caffeine.otherMg).toBeCloseTo(33, 5);
    expect(s.caffeine.lastCaffeineTime).toBe(timeOnDate(d, '19:00'));
  });
});

describe('Enerji ve hedef', () => {
  it('Mifflin–St Jeor doğru', () => {
    expect(bmrMifflin('male', 80, 180, 30)).toBe(800 + 1125 - 150 + 5);
    expect(bmrMifflin('female', 60, 165, 30)).toBeCloseTo(600 + 1031.25 - 150 - 161, 5);
  });
  it('kilo verme hedefi güvenli alt sınırın altına inmez', () => {
    const g = calcGoal({ birthYear: 1996, sex: 'female', heightCm: 155, currentWeightKg: 50, activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 0.75 }, new Date(2026, 9, 13));
    expect(g.clamped).toBe(true);
    expect(g.target).toBe(1200);
    expect(g.warnings.some((w) => w.includes('alt sınır'))).toBe(true);
    const m = calcGoal({ birthYear: 1992, sex: 'male', heightCm: 178, currentWeightKg: 84, activityLevel: 'sedentary', goal: 'lose', rateKgPerWeek: 0.5 }, new Date(2026, 9, 13));
    expect(m.clamped).toBe(false);
    expect(m.target).toBe(Math.round((m.tdee - 550) / 10) * 10);
    expect(m.warnings.some((w) => w.includes('bazal'))).toBe(true);
  });
  it('18 yaş altı için uyarı verir', () => {
    const g = calcGoal({ birthYear: 2012, sex: 'male', heightCm: 160, currentWeightKg: 50, activityLevel: 'light', goal: 'maintain', rateKgPerWeek: 0 }, new Date(2026, 9, 13));
    expect(g.warnings.some((w) => w.includes('18 yaş'))).toBe(true);
  });
});

describe('Aktivite ve dinamik hedef', () => {
  const d = '2026-10-13';
  it('egzersiz kalorisi hedefi doğru günceller (%0 / %50 / %100)', () => {
    const run = buildActivity({ type: 'kosu', intensity: 'orta', durationMin: 30, date: d, time: timeOnDate(d, '07:00') }, 70, 175);
    expect(run.grossKcal).toBe(Math.round(9.8 * 70 * 0.5));
    expect(run.netKcal).toBe(Math.round(8.8 * 70 * 0.5));
    for (const pct of [0, 50, 100] as const) {
      const sum = summarizeDay({ meals: [], beverages: [], activities: [run], steps: [], goal: { ...goal, exerciseAllowancePct: pct }, mealDefs: DEFAULT_MEALS, weightKg: 70, heightCm: 175 });
      expect(sum.targetKcal).toBe(2200 + Math.round((run.netKcal * pct) / 100));
    }
  });
  it('adım ile manuel yürüyüş çift sayılmaz', () => {
    const walk = buildActivity({ type: 'yuruyus', intensity: 'orta', durationMin: 40, date: d }, 70, 175);
    expect(walk.estSteps).toBe(105 * 40);
    const steps: StepEntry[] = [{ id: `${d}:manual`, date: d, steps: 12000, source: 'manual', updatedAt: 0 }];
    const b = activityBudget([walk], steps, { weightKg: 70, heightCm: 175, stepBaseline: 5000, allowancePct: 100 });
    expect(b.extraSteps).toBe(12000 - 5000 - 4200);
    expect(b.totalExtraKcal).toBeCloseTo(walk.netKcal + stepsNetKcal(2800, 70, 175), 5);
    // Adımların tamamı yürüyüşten geliyorsa ek adım kalorisi sıfırdır
    const b2 = activityBudget([walk], [{ ...steps[0], steps: 8000 }], { weightKg: 70, heightCm: 175, stepBaseline: 5000, allowancePct: 100 });
    expect(b2.extraSteps).toBe(0);
    expect(b2.totalExtraKcal).toBe(walk.netKcal);
  });
  it('sağlık platformu ve manuel adım toplanmaz', () => {
    const steps: StepEntry[] = [
      { id: `${d}:manual`, date: d, steps: 6000, source: 'manual', updatedAt: 0 },
      { id: `${d}:health`, date: d, steps: 9000, source: 'health', updatedAt: 0 },
    ];
    const b = activityBudget([], steps, { weightKg: 70, heightCm: 175, stepBaseline: 5000, allowancePct: 100 });
    expect(b.steps).toBe(9000);
  });
  it('sağlık platformundan gelen çakışan aktivite mükerrer sayılmaz', () => {
    const manual = buildActivity({ type: 'yuruyus', intensity: 'orta', durationMin: 40, date: d, time: timeOnDate(d, '18:00') }, 70, 175);
    const health = { ...buildActivity({ type: 'yuruyus', intensity: 'orta', durationMin: 38, date: d, time: timeOnDate(d, '18:05'), source: 'health', externalId: 'hc-1' }, 70, 175) };
    const dup = { ...health, id: 'x' };
    const { counted, duplicates } = dedupeActivities([manual, health, dup]);
    expect(counted).toEqual([manual]);
    expect(duplicates.length).toBe(2);
  });
});

describe('Tarihler ve istatistik', () => {
  it('tarih anahtarı yerel saatle; gece yarısına yakın kayıt doğru günde kalır', () => {
    const late = new Date(2026, 9, 13, 23, 59);
    expect(toDateKey(late)).toBe('2026-10-13');
    expect(toDateKey(new Date(2026, 9, 14, 0, 1))).toBe('2026-10-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(rangeKeys('2026-10-01', '2026-10-07').length).toBe(7);
    expect(toDateKey(timeOnDate('2026-10-13', '23:30'))).toBe('2026-10-13');
  });
  it('ortalamalarda kaydı olmayan günler sıfır sayılmaz', () => {
    const m = (date: string) => buildMealEntry({ food: food('simit'), serving: food('simit').servings[0], count: 1, date, mealId: 'kahvalti' });
    const series = buildDaySeries({ from: '2026-10-07', to: '2026-10-13', meals: [m('2026-10-10'), m('2026-10-12')], beverages: [], activities: [], steps: [], weights: [], goals: [goal], weightKg: 70, heightCm: 175 });
    const avg = averageOver(series, (p) => p.kcal, (p) => p.hasFood);
    expect(avg.days).toBe(2);
    expect(avg.totalDays).toBe(7);
    expect(avg.value).toBeCloseTo(m('2026-10-10').totals.kcal, 5);
  });
  it('kilo eğilimi az veriyle hesaplanmaz, yeterli veriyle eğimi bulur', () => {
    const w = (date: string, kg: number): WeightEntry => ({ id: date, date, time: 0, weightKg: kg, createdAt: 0 });
    expect(weightTrend([w('2026-10-01', 80), w('2026-10-02', 79.8)])).toBeNull();
    const t = weightTrend([w('2026-09-01', 80), w('2026-09-08', 79.5), w('2026-09-15', 79), w('2026-09-22', 78.5)], 75)!;
    expect(t.slopePerWeek).toBeCloseTo(-0.5, 5);
    expect(t.weeksToTarget).toBeCloseTo(7, 5);
  });
});

describe('Türkçe arama', () => {
  it('Türkçe karakterleri ve büyük İ/I harflerini normalleştirir', () => {
    expect(normalizeTr('İSKENDER Çiğ Köfte')).toBe('iskender cig kofte');
    expect(normalizeTr('IŞIK')).toBe('isik');
  });
  it('Türkçe karakter olmadan, yazım hatasıyla ve takma adla bulur', () => {
    const first = (q: string) => search(BUILTIN_FOODS, q, { limit: 5 }).map((f) => f.name);
    expect(first('mercimek corbasi')[0]).toBe('Mercimek çorbası');
    expect(first('mercmek')).toContain('Mercimek çorbası');
    expect(first('iskendr')).toContain('İskender kebap');
    expect(first('kofte')).toContain('Izgara köfte');
    expect(first('gyros')).toContain('Et döner (porsiyon, ekmeksiz)');
    expect(first('sutlac')[0]).toBe('Sütlaç');
  });
});
