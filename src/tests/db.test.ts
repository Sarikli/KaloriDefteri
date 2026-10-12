import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { KaloriDB, useDatabase, db } from '../db/database';
import * as repo from '../db/repo';
import { exportBackup, importFoods, restoreBackup } from '../db/backup';
import { BUILTIN_BEVERAGE_MAP } from '../data/beverages';
import { BUILTIN_FOOD_MAP } from '../data/foods';
import { summarizeBeverages } from '../engine/beverage';

let n = 0;
beforeEach(async () => {
  useDatabase(new KaloriDB(`test-${n++}`));
  await db.open();
});

const D = '2026-10-13';

describe('Kalıcı depolama', () => {
  it('kişisel yemek kaydedilir, yeni bağlantıda okunur ve aramada kullanılabilir', async () => {
    const f = await repo.saveUserFood({ name: 'Annemin dolması', quickKcalPerServing: 320, serving: { unit: 'porsiyon', label: '1 porsiyon', amount: 250 } });
    const name = db.name;
    db.close();
    const reopened = new KaloriDB(name);
    const back = await reopened.foods.get(f.id);
    expect(back?.name).toBe('Annemin dolması');
    expect(back?.per100.kcal).toBeCloseTo(128, 5);
    reopened.close();
  });

  it('yemek düzenlenince geçmiş günlük kayıt değişmez', async () => {
    const f = await repo.saveUserFood({ name: 'Ev keki', quickKcalPerServing: 300, serving: { unit: 'dilim', label: '1 dilim', amount: 100 } });
    const e = await repo.logFood({ food: f, serving: f.servings[0], count: 1, date: D, mealId: 'ara' });
    await repo.saveUserFood({ name: 'Ev keki', quickKcalPerServing: 450, serving: { unit: 'dilim', label: '1 dilim', amount: 100 } }, f.id);
    const after = await db.mealEntries.get(e.id);
    expect(after?.totals.kcal).toBe(300);
    await repo.updateMealEntry(e.id, { serving: f.servings[0], count: 2 });
    expect((await db.mealEntries.get(e.id))?.totals.kcal).toBe(600);
  });

  it('içecek silinince hem kalori hem sıvı kaydı birlikte kalkar', async () => {
    const coffee = BUILTIN_BEVERAGE_MAP.get('bv:filtre-kahve')!;
    const e = await repo.logBeverage({ beverage: coffee, baseMl: 300, addons: { milkMl: 50, sugarG: 5 }, date: D });
    let all = await db.beverageEntries.where('date').equals(D).toArray();
    expect(summarizeBeverages(all).totalMl).toBe(350);
    expect(summarizeBeverages(all).kcal).toBeGreaterThan(40);
    await repo.deleteBeverageEntry(e.id);
    all = await db.beverageEntries.where('date').equals(D).toArray();
    expect(summarizeBeverages(all).totalMl).toBe(0);
    expect(summarizeBeverages(all).kcal).toBe(0);
  });

  it('kişisel içecek arşivlenince hızlı ekleme ve favori bağlantıları temizlenir, geçmiş kayıt korunur', async () => {
    const mine = await repo.saveUserBeverage({ name: 'Benim kahvem', type: 'filtre_kahve', per100ml: { kcal: 18, protein: 0.6, carb: 2, fat: 0.6, fiber: 0, sugar: 2 }, caffeinePer100ml: 33 });
    await repo.updateSettings({ quickDrinks: [{ id: 'x', beverageId: mine.id, ml: 300 }] });
    await repo.toggleFavorite('beverage', mine.id, mine.name, { ml: 300 });
    const entry = await repo.logBeverage({ beverage: mine, baseMl: 300, date: D });
    await repo.archiveUserBeverage(mine.id);
    expect((await repo.getSettings()).quickDrinks).toEqual([]);
    expect(await db.favorites.count()).toBe(0);
    expect((await db.beverageEntries.get(entry.id))?.totals.kcal).toBeCloseTo(54, 5);
  });

  it('tarif kaydedilince aranabilir yemek oluşur', async () => {
    const tavuk = BUILTIN_FOOD_MAP.get('tr:tavuk-gogsu-cig')!;
    const pirinc = BUILTIN_FOOD_MAP.get('tr:pirinc-cig')!;
    const r = await repo.saveRecipe({
      name: 'Tavuklu pilav (ev)',
      ingredients: [tavuk, pirinc].map((f, i) => ({ kind: 'food', refId: f.id, name: f.name, amount: [500, 200][i], basis: 'g', per100: f.per100 })),
      cookedWeightG: 1000,
      servings: 4,
    });
    const food = await db.foods.get(r.foodId);
    expect(food?.recipeId).toBe(r.id);
    expect(food?.servings[0].amount).toBe(250);
    expect(food?.per100.kcal).toBeCloseTo((600 + 730) / 10, 1);
  });

  it('öğün kopyalama dünün kayıtlarını bugüne taşır, kayıtlar doğru günde kalır', async () => {
    const simit = BUILTIN_FOOD_MAP.get('tr:simit')!;
    await repo.logFood({ food: simit, serving: simit.servings[0], count: 1, date: '2026-10-12', mealId: 'kahvalti' });
    const added = await repo.copyMeal('2026-10-12', 'kahvalti', D, 'kahvalti');
    expect(added).toBe(1);
    expect(await db.mealEntries.where('date').equals(D).count()).toBe(1);
    expect(await db.mealEntries.where('date').equals('2026-10-12').count()).toBe(1);
  });

  it('hedef değişikliği geçmiş günleri etkilemez', async () => {
    await repo.saveGoals({ baseKcal: 2000 }, '2026-10-01');
    await repo.saveGoals({ baseKcal: 1800 }, '2026-10-10');
    const { goalForDate } = await import('../engine/daily');
    const goals = await db.goals.toArray();
    expect(goalForDate(goals, '2026-10-05')?.baseKcal).toBe(2000);
    expect(goalForDate(goals, D)?.baseKcal).toBe(1800);
  });

  it('JSON yedek → geri yükleme (değiştir) verileri eksiksiz geri getirir', async () => {
    const simit = BUILTIN_FOOD_MAP.get('tr:simit')!;
    await repo.logFood({ food: simit, serving: simit.servings[0], count: 1, date: D, mealId: 'kahvalti' });
    await repo.logBeverage({ beverage: BUILTIN_BEVERAGE_MAP.get('bv:su')!, baseMl: 500, date: D });
    await repo.logWeight({ date: D, weightKg: 72.4 });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    await db.mealEntries.clear();
    await repo.logBeverage({ beverage: BUILTIN_BEVERAGE_MAP.get('bv:kola')!, baseMl: 330, date: D });
    await restoreBackup(backup, 'replace');
    expect(await db.mealEntries.count()).toBe(1);
    expect(await db.beverageEntries.count()).toBe(1);
    expect((await db.weights.toArray())[0].weightKg).toBe(72.4);
    await expect(restoreBackup({ foo: 1 }, 'merge')).rejects.toThrow();
  });

  it('CSV ile toplu yemek içe aktarma kaynak bilgisini saklar, hatalı satırları atlar', async () => {
    const csv = 'ad;kategori;kcal;protein;karbonhidrat;yag;lif;porsiyon_adi;porsiyon_g;kaynak\nKeşkek (köy);sulu_yemek;145;9;15;5;1,8;1 kase;250;TürKomp\nHatalı;;abc;;;;;;;\n';
    const r = await importFoods(csv);
    expect(r.added).toBe(1);
    expect(r.skipped.length).toBe(1);
    const f = (await db.foods.toArray())[0];
    expect(f.sourceNote).toBe('TürKomp');
    expect(f.per100.fiber).toBe(1.8);
  });
});
