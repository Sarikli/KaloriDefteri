import { db } from './database';
import type {
  ActivityEntry,
  ActivityType,
  AllowancePct,
  AppSettings,
  Beverage,
  BeverageAddons,
  BeverageEntry,
  BeverageIngredient,
  BeverageType,
  DailyGoalSettings,
  DateKey,
  FavoriteItem,
  FavoriteKind,
  Food,
  FoodServing,
  Intensity,
  MealDef,
  MealEntry,
  MealTemplate,
  Nutrients,
  Recipe,
  RecipeIngredient,
  UserProfile,
  UserServing,
  WeightEntry,
} from './types';
import { BUILTIN_BEVERAGE_MAP, DEFAULT_QUICK_DRINKS } from '../data/beverages';
import { BUILTIN_FOOD_MAP } from '../data/foods';
import { ACTIVITIES } from '../data/activities';
import { activityKcal, estimateActivitySteps } from '../engine/activity';
import { calcBeverageEntry, composeBeverage, NO_ADDONS } from '../engine/beverage';
import { addDays, defaultTimeFor, toDateKey } from '../engine/dates';
import { ACTIVITY_LEVELS, calcGoal } from '../engine/energy';
import { roundPrecise, scale } from '../engine/nutrition';
import { amountFor, servingText } from '../engine/portion';
import { computeRecipe } from '../engine/recipe';

export function uid(prefix = ''): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}:${rnd}` : rnd;
}

const now = () => Date.now();

// ───────────────────────── Ayarlar & varsayılanlar ─────────────────────────

export const DEFAULT_MEALS: MealDef[] = [
  { id: 'kahvalti', name: 'Kahvaltı', order: 0, builtin: true },
  { id: 'ogle', name: 'Öğle yemeği', order: 1, builtin: true },
  { id: 'aksam', name: 'Akşam yemeği', order: 2, builtin: true },
  { id: 'ara', name: 'Ara öğün', order: 3, builtin: true },
];

export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    theme: 'system',
    meals: DEFAULT_MEALS,
    quickDrinks: DEFAULT_QUICK_DRINKS,
    reminders: { enabled: false, waterEveryMin: null, mealTimes: [], weightTime: null, dailyReviewTime: null },
    onboarded: false,
    caffeineTracking: true,
    updatedAt: now(),
  };
}

export function defaultGoal(effectiveFrom: DateKey = '1970-01-01'): DailyGoalSettings {
  return {
    effectiveFrom,
    baseKcal: 2000,
    method: 'manual',
    proteinPct: 20,
    carbPct: 50,
    fatPct: 30,
    waterMl: 2000,
    fluidMl: 2500,
    caffeineLimitMg: 400,
    exerciseAllowancePct: 50,
    stepBaseline: 5000,
    updatedAt: now(),
  };
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app');
  if (s) return s;
  const d = defaultSettings();
  await db.settings.put(d);
  return d;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch, id: 'app', updatedAt: now() });
}

/** Belirli bir tarihten itibaren geçerli hedefleri kaydeder; önceki günler eski hedefi korur. */
export async function saveGoals(patch: Partial<DailyGoalSettings>, effectiveFrom: DateKey = toDateKey()): Promise<DailyGoalSettings> {
  const all = await db.goals.toArray();
  const prev = all.filter((g) => g.effectiveFrom <= effectiveFrom).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? defaultGoal();
  const next: DailyGoalSettings = { ...prev, ...patch, effectiveFrom, updatedAt: now() };
  await db.goals.put(next);
  return next;
}

export async function saveProfile(p: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<UserProfile, 'createdAt'>>, extra: Partial<DailyGoalSettings> = {}): Promise<UserProfile> {
  const existing = await db.profile.get('me');
  const profile: UserProfile = { ...p, id: 'me', createdAt: existing?.createdAt ?? p.createdAt ?? now(), updatedAt: now() };
  await db.profile.put(profile);
  const calc = calcGoal(profile);
  await saveGoals({
    baseKcal: Math.round(calc.target),
    method: calc.method,
    stepBaseline: extra.stepBaseline ?? ACTIVITY_LEVELS[profile.activityLevel].stepBaseline,
    calcSummary: calc.steps.join('\n'),
    ...extra,
  });
  return profile;
}

// ───────────────────────── Yemekler ─────────────────────────

export async function getFood(id: string): Promise<Food | undefined> {
  return BUILTIN_FOOD_MAP.get(id) ?? (await db.foods.get(id));
}

export interface FoodInput {
  name: string;
  categoryId?: string;
  basis?: 'g' | 'ml';
  per100?: Nutrients;
  /** Hızlı kayıt: yalnızca isim ve porsiyon kalorisi */
  quickKcalPerServing?: number;
  serving?: { unit: FoodServing['unit']; label: string; amount: number };
  aliases?: string[];
  description?: string;
  barcode?: string;
  brand?: string;
  imageId?: string;
  source?: Food['source'];
  confidence?: Food['confidence'];
  sourceNote?: string;
}

export async function saveUserFood(input: FoodInput, id?: string): Promise<Food> {
  const existing = id ? await db.foods.get(id) : undefined;
  const serving = input.serving ?? { unit: 'porsiyon' as const, label: '1 porsiyon', amount: 100 };
  let per100 = input.per100;
  if (!per100 && input.quickKcalPerServing !== undefined) {
    per100 = { kcal: (input.quickKcalPerServing / serving.amount) * 100, protein: 0, carb: 0, fat: 0, fiber: null, sugar: null };
  }
  if (!per100) throw new Error('Kalori bilgisi gerekli');
  const food: Food = {
    id: existing?.id ?? uid('u'),
    name: input.name.trim(),
    aliases: input.aliases ?? existing?.aliases ?? [],
    categoryId: input.categoryId ?? existing?.categoryId ?? 'kisisel',
    cuisine: existing?.cuisine ?? 'tr',
    basis: input.basis ?? existing?.basis ?? 'g',
    per100,
    servings: [{ id: 'u-0', ...serving, isDefault: true }],
    source: input.source ?? existing?.source ?? 'user',
    sourceNote: input.sourceNote ?? existing?.sourceNote,
    confidence: input.confidence ?? existing?.confidence ?? 'medium',
    isUser: true,
    barcode: input.barcode ?? existing?.barcode,
    brand: input.brand ?? existing?.brand,
    description: input.description ?? existing?.description,
    imageId: input.imageId ?? existing?.imageId,
    recipeId: existing?.recipeId,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.foods.put(food);
  return food;
}

/** Kullanıcı yemeğini arşivler (geçmiş günlük kayıtlar anlık görüntü taşıdığından etkilenmez) */
export async function archiveUserFood(id: string): Promise<void> {
  await db.foods.update(id, { archived: true, updatedAt: now() });
  await db.favorites.where('refId').equals(id).delete();
}

export async function saveUserServing(foodId: string, serving: Omit<FoodServing, 'id'> & { id?: string }): Promise<UserServing> {
  const s: UserServing = { ...serving, id: serving.id ?? uid('srv'), foodId, createdAt: now() };
  // Aynı kimlik yerleşik ölçünün gram karşılığını kişisel olarak değiştirir
  await db.userServings.put({ ...s, id: `${foodId}|${s.id}` } as UserServing);
  return s;
}

export async function getUserServings(foodId: string): Promise<UserServing[]> {
  const rows = await db.userServings.where('foodId').equals(foodId).toArray();
  return rows.map((r) => ({ ...r, id: r.id.includes('|') ? r.id.split('|').slice(1).join('|') : r.id }));
}

// ───────────────────────── Yemek günlüğü ─────────────────────────

export interface LogFoodInput {
  food: Food;
  serving: FoodServing;
  count: number;
  date: DateKey;
  mealId: string;
  time?: number;
  note?: string;
  photoId?: string;
}

export function buildMealEntry(i: LogFoodInput): MealEntry {
  const amount = amountFor(i.serving, i.count);
  const t = now();
  return {
    id: uid('m'),
    date: i.date,
    mealId: i.mealId,
    time: i.time ?? defaultTimeFor(i.date),
    foodId: i.food.id,
    recipeId: i.food.recipeId,
    name: i.food.name,
    brand: i.food.brand,
    basis: i.food.basis,
    servingLabel: servingText(i.serving, i.count, i.food.basis),
    servingCount: i.count,
    amount,
    per100: { ...i.food.per100 },
    totals: roundPrecise(scale(i.food.per100, amount)),
    source: i.food.source,
    photoId: i.photoId,
    note: i.note,
    createdAt: t,
    updatedAt: t,
  };
}

export async function logFood(i: LogFoodInput): Promise<MealEntry> {
  const e = buildMealEntry(i);
  await db.mealEntries.add(e);
  return e;
}

/**
 * Geçmiş kaydı düzenler. Besin değerleri kaydın kendi anlık görüntüsünden (per100) yeniden
 * hesaplanır; kaynak yemek sonradan değişmişse bile kayıt beklenmedik biçimde değişmez.
 */
export async function updateMealEntry(id: string, patch: { serving?: FoodServing; count?: number; amount?: number; mealId?: string; date?: DateKey; time?: number; note?: string }): Promise<void> {
  const e = await db.mealEntries.get(id);
  if (!e) return;
  let amount = e.amount;
  let servingLabel = e.servingLabel;
  let servingCount = e.servingCount;
  if (patch.serving && patch.count !== undefined) {
    amount = amountFor(patch.serving, patch.count);
    servingLabel = servingText(patch.serving, patch.count, e.basis);
    servingCount = patch.count;
  } else if (patch.amount !== undefined) {
    amount = patch.amount;
    servingLabel = `${Math.round(amount)} ${e.basis}`;
    servingCount = amount;
  }
  await db.mealEntries.put({
    ...e,
    amount,
    servingLabel,
    servingCount,
    totals: roundPrecise(scale(e.per100, amount)),
    mealId: patch.mealId ?? e.mealId,
    date: patch.date ?? e.date,
    time: patch.time ?? e.time,
    note: patch.note ?? e.note,
    updatedAt: now(),
  });
}

export async function deleteMealEntry(id: string): Promise<MealEntry | undefined> {
  const e = await db.mealEntries.get(id);
  await db.mealEntries.delete(id);
  return e;
}

export async function restoreMealEntry(e: MealEntry): Promise<void> {
  await db.mealEntries.put(e);
}

function cloneEntryTo(e: MealEntry, date: DateKey, mealId: string): MealEntry {
  const t = now();
  const sameDay = date === e.date;
  return { ...e, id: uid('m'), date, mealId, time: sameDay ? e.time : defaultTimeFor(date), createdAt: t, updatedAt: t };
}

/** Bir öğünü başka bir güne/öğüne kopyalar (ör. dünkü kahvaltıyı bugüne) */
export async function copyMeal(fromDate: DateKey, fromMeal: string, toDate: DateKey, toMeal: string): Promise<number> {
  const items = await db.mealEntries.where('[date+mealId]').equals([fromDate, fromMeal]).toArray();
  const bevs = (await db.beverageEntries.where('date').equals(fromDate).toArray()).filter((b) => b.mealId === fromMeal);
  await db.transaction('rw', db.mealEntries, db.beverageEntries, async () => {
    await db.mealEntries.bulkAdd(items.map((e) => cloneEntryTo(e, toDate, toMeal)));
    await db.beverageEntries.bulkAdd(bevs.map((b) => ({ ...b, id: uid('b'), date: toDate, mealId: toMeal, time: defaultTimeFor(toDate), createdAt: now(), updatedAt: now() })));
  });
  return items.length + bevs.length;
}

export async function copyEntry(id: string, toDate: DateKey, toMeal?: string): Promise<void> {
  const e = await db.mealEntries.get(id);
  if (e) await db.mealEntries.add(cloneEntryTo(e, toDate, toMeal ?? e.mealId));
}

// ───────────────────────── Şablonlar ─────────────────────────

export async function saveTemplate(name: string, date: DateKey, mealId: string): Promise<MealTemplate | null> {
  const items = await db.mealEntries.where('[date+mealId]').equals([date, mealId]).toArray();
  const bevs = (await db.beverageEntries.where('date').equals(date).toArray()).filter((b) => b.mealId === mealId);
  if (!items.length && !bevs.length) return null;
  const tpl: MealTemplate = {
    id: uid('tpl'),
    name,
    items: items.map(({ id: _i, date: _d, mealId: _m, time: _t, createdAt: _c, updatedAt: _u, ...rest }) => rest),
    beverages: bevs.map(({ id: _i, date: _d, time: _t, createdAt: _c, updatedAt: _u, mealId: _m, ...rest }) => rest),
    createdAt: now(),
  };
  await db.templates.add(tpl);
  return tpl;
}

export async function applyTemplate(templateId: string, date: DateKey, mealId: string): Promise<number> {
  const tpl = await db.templates.get(templateId);
  if (!tpl) return 0;
  const t = now();
  const time = defaultTimeFor(date);
  await db.transaction('rw', db.mealEntries, db.beverageEntries, async () => {
    await db.mealEntries.bulkAdd(tpl.items.map((i) => ({ ...i, id: uid('m'), date, mealId, time, createdAt: t, updatedAt: t })));
    await db.beverageEntries.bulkAdd(tpl.beverages.map((b) => ({ ...b, id: uid('b'), date, mealId, time, createdAt: t, updatedAt: t })));
  });
  return tpl.items.length + tpl.beverages.length;
}

// ───────────────────────── İçecekler ─────────────────────────

export async function getBeverage(id: string): Promise<Beverage | undefined> {
  return BUILTIN_BEVERAGE_MAP.get(id) ?? (await db.beverages.get(id));
}

export interface LogBeverageInput {
  beverage: Beverage;
  baseMl: number;
  addons?: BeverageAddons;
  date: DateKey;
  time?: number;
  mealId?: string;
  note?: string;
}

export function buildBeverageEntry(i: LogBeverageInput): BeverageEntry {
  const addons = i.addons ?? NO_ADDONS;
  const c = calcBeverageEntry(i.beverage, i.baseMl, addons);
  const t = now();
  return {
    id: uid('b'),
    date: i.date,
    time: i.time ?? defaultTimeFor(i.date),
    beverageId: i.beverage.id,
    name: i.beverage.name,
    type: i.beverage.type,
    ml: c.ml,
    baseMl: i.baseMl,
    addons,
    per100ml: { ...i.beverage.per100ml },
    caffeinePer100ml: i.beverage.caffeinePer100ml,
    totals: roundPrecise(c.totals),
    caffeineMg: c.caffeineMg === null ? null : Math.round(c.caffeineMg * 10) / 10,
    mealId: i.mealId,
    note: i.note,
    createdAt: t,
    updatedAt: t,
  };
}

/** İçecek tek bir kayıttır: hem sıvı hem kalori hesabı bu kayıttan okunur. */
export async function logBeverage(i: LogBeverageInput): Promise<BeverageEntry> {
  const e = buildBeverageEntry(i);
  await db.beverageEntries.add(e);
  return e;
}

export async function updateBeverageEntry(id: string, patch: { baseMl?: number; addons?: BeverageAddons; time?: number; date?: DateKey; note?: string; mealId?: string | null; caffeinePer100ml?: number | null }): Promise<void> {
  const e = await db.beverageEntries.get(id);
  if (!e) return;
  const baseMl = patch.baseMl ?? e.baseMl;
  const addons = patch.addons ?? e.addons;
  const caffeinePer100ml = patch.caffeinePer100ml !== undefined ? patch.caffeinePer100ml : e.caffeinePer100ml;
  const c = calcBeverageEntry({ per100ml: e.per100ml, caffeinePer100ml }, baseMl, addons);
  await db.beverageEntries.put({
    ...e,
    baseMl,
    addons,
    ml: c.ml,
    caffeinePer100ml,
    totals: roundPrecise(c.totals),
    caffeineMg: c.caffeineMg === null ? null : Math.round(c.caffeineMg * 10) / 10,
    time: patch.time ?? e.time,
    date: patch.date ?? e.date,
    note: patch.note ?? e.note,
    mealId: patch.mealId === null ? undefined : (patch.mealId ?? e.mealId),
    updatedAt: now(),
  });
}

export async function deleteBeverageEntry(id: string): Promise<BeverageEntry | undefined> {
  const e = await db.beverageEntries.get(id);
  await db.beverageEntries.delete(id);
  return e;
}

export async function restoreBeverageEntry(e: BeverageEntry): Promise<void> {
  await db.beverageEntries.put(e);
}

export interface BeverageDefInput {
  name: string;
  type: BeverageType;
  per100ml?: Nutrients;
  caffeinePer100ml?: number | null;
  ingredients?: BeverageIngredient[];
  defaultMl?: number;
  aliases?: string[];
}

/** Kişisel içecek. Bileşenlerden oluşturulursa ("Benim kahvem") toplam hacim ve değerler hesaplanır. */
export async function saveUserBeverage(input: BeverageDefInput, id?: string): Promise<Beverage> {
  const existing = id ? await db.beverages.get(id) : undefined;
  let per100ml = input.per100ml;
  let caffeine = input.caffeinePer100ml ?? null;
  let defaultMl = input.defaultMl ?? 250;
  if (input.ingredients?.length) {
    const c = composeBeverage(input.ingredients);
    per100ml = roundPrecise(c.per100ml);
    caffeine = c.caffeinePer100ml === null ? null : Math.round(c.caffeinePer100ml * 10) / 10;
    defaultMl = Math.round(c.totalMl);
  }
  if (!per100ml) throw new Error('İçecek değerleri gerekli');
  const bev: Beverage = {
    id: existing?.id ?? uid('ub'),
    name: input.name.trim(),
    aliases: input.aliases ?? [],
    type: input.type,
    per100ml,
    caffeinePer100ml: caffeine,
    defaultMl,
    servings: [{ label: 'Tarif miktarı', ml: defaultMl }],
    ingredients: input.ingredients,
    source: input.ingredients?.length ? 'recipe' : 'user',
    confidence: 'medium',
    isUser: true,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.beverages.put(bev);
  return bev;
}

/**
 * Kişisel içeceği siler: tanım arşivlenir, favori ve hızlı ekleme bağlantıları kaldırılır.
 * Geçmiş içecek kayıtları kendi anlık görüntüsünü taşıdığından günlük toplamlar tutarlı kalır.
 */
export async function archiveUserBeverage(id: string): Promise<void> {
  await db.beverages.update(id, { archived: true, updatedAt: now() });
  await db.favorites.where('refId').equals(id).delete();
  const s = await getSettings();
  await updateSettings({ quickDrinks: s.quickDrinks.filter((q) => q.beverageId !== id) });
}

// ───────────────────────── Aktivite & adım ─────────────────────────

export interface LogActivityInput {
  type: ActivityType;
  intensity: Intensity;
  durationMin: number;
  distanceKm?: number;
  met?: number;
  name?: string;
  date: DateKey;
  time?: number;
  note?: string;
  source?: 'manual' | 'health';
  externalId?: string;
}

export function buildActivity(i: LogActivityInput, weightKg: number, heightCm: number): ActivityEntry {
  const def = ACTIVITIES[i.type];
  const met = i.met ?? def.met[i.intensity];
  const { gross, net } = activityKcal(met, weightKg, i.durationMin);
  const t = now();
  return {
    id: uid('a'),
    date: i.date,
    time: i.time ?? defaultTimeFor(i.date),
    type: i.type,
    name: i.name?.trim() || def.label,
    durationMin: i.durationMin,
    intensity: i.intensity,
    distanceKm: i.distanceKm,
    met,
    grossKcal: Math.round(gross),
    netKcal: Math.round(net),
    estSteps: estimateActivitySteps(i.type, i.intensity, i.durationMin, i.distanceKm, heightCm),
    source: i.source ?? 'manual',
    externalId: i.externalId,
    note: i.note,
    createdAt: t,
    updatedAt: t,
  };
}

async function bodyStats(): Promise<{ weightKg: number; heightCm: number }> {
  const p = await db.profile.get('me');
  return { weightKg: p?.currentWeightKg ?? 70, heightCm: p?.heightCm ?? 170 };
}

export async function logActivity(i: LogActivityInput): Promise<ActivityEntry> {
  const { weightKg, heightCm } = await bodyStats();
  const a = buildActivity(i, weightKg, heightCm);
  await db.activities.add(a);
  return a;
}

export async function updateActivity(id: string, i: LogActivityInput): Promise<void> {
  const old = await db.activities.get(id);
  if (!old) return;
  const { weightKg, heightCm } = await bodyStats();
  const a = buildActivity(i, weightKg, heightCm);
  await db.activities.put({ ...a, id, createdAt: old.createdAt, source: old.source, externalId: old.externalId });
}

export async function deleteActivity(id: string): Promise<void> {
  await db.activities.delete(id);
}

export async function setSteps(date: DateKey, steps: number, source: 'manual' | 'health' = 'manual'): Promise<void> {
  const id = `${date}:${source}`;
  if (steps <= 0) await db.steps.delete(id);
  else await db.steps.put({ id, date, steps: Math.round(steps), source, updatedAt: now() });
}

// ───────────────────────── Kilo ─────────────────────────

export async function logWeight(w: Omit<WeightEntry, 'id' | 'createdAt' | 'time'> & { time?: number }): Promise<WeightEntry> {
  const entry: WeightEntry = { ...w, id: uid('w'), time: w.time ?? defaultTimeFor(w.date), createdAt: now() };
  await db.weights.add(entry);
  await syncCurrentWeight();
  return entry;
}

export async function deleteWeight(id: string): Promise<void> {
  await db.weights.delete(id);
  await syncCurrentWeight();
}

/** Profildeki güncel kilo = en son tarihli ölçüm. Hedef kalori otomatik değiştirilmez; kullanıcıya önerilir. */
async function syncCurrentWeight(): Promise<void> {
  const p = await db.profile.get('me');
  if (!p) return;
  const all = (await db.weights.toArray()).filter((w) => w.weightKg !== null).sort((a, b) => b.date.localeCompare(a.date) || b.time - a.time);
  const latest = all[0];
  await db.profile.put({ ...p, currentWeightKg: latest?.weightKg ?? p.startWeightKg, updatedAt: now() });
}

// ───────────────────────── Tarifler ─────────────────────────

export interface RecipeInput {
  name: string;
  categoryId?: string;
  ingredients: RecipeIngredient[];
  cookedWeightG: number | null;
  servings: number;
  note?: string;
}

/** Tarifi kaydeder ve aramada görünmesi/tek tıkla eklenebilmesi için bir yemek kaydı üretir. */
export async function saveRecipe(input: RecipeInput, id?: string): Promise<Recipe> {
  const existing = id ? await db.recipes.get(id) : undefined;
  const r = computeRecipe(input.ingredients, input.cookedWeightG, input.servings);
  const recipeId = existing?.id ?? uid('r');
  const foodId = existing?.foodId ?? uid('u');
  const servingG = Math.round(r.servingWeight);
  const food: Food = {
    id: foodId,
    name: input.name.trim(),
    aliases: [],
    categoryId: input.categoryId ?? 'kisisel',
    cuisine: 'tr',
    basis: 'g',
    per100: roundPrecise(r.per100),
    servings: [
      { id: 'tarif-porsiyon', unit: 'porsiyon', label: '1 porsiyon', amount: servingG, isDefault: true },
      { id: 'tarif-tamami', unit: 'ozel', label: 'Tarifin tamamı', amount: Math.round(r.finalWeight) },
    ],
    source: 'recipe',
    sourceNote: `${input.ingredients.length} malzemeden hesaplandı${input.cookedWeightG ? `; pişmiş ağırlık ${input.cookedWeightG} g` : '; pişmiş ağırlık girilmedi, çiğ toplam kullanıldı'}.`,
    confidence: 'medium',
    isUser: true,
    recipeId,
    description: input.note,
    createdAt: (await db.foods.get(foodId))?.createdAt ?? now(),
    updatedAt: now(),
  };
  const recipe: Recipe = {
    id: recipeId,
    name: food.name,
    categoryId: food.categoryId,
    ingredients: input.ingredients,
    cookedWeightG: input.cookedWeightG,
    servings: input.servings,
    note: input.note,
    foodId,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.transaction('rw', db.recipes, db.foods, async () => {
    await db.foods.put(food);
    await db.recipes.put(recipe);
  });
  return recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const r = await db.recipes.get(id);
  if (!r) return;
  await db.recipes.delete(id);
  await archiveUserFood(r.foodId);
}

// ───────────────────────── Favoriler ─────────────────────────

export async function toggleFavorite(kind: FavoriteKind, refId: string, label: string, preset?: FavoriteItem['preset']): Promise<boolean> {
  const existing = (await db.favorites.where('refId').equals(refId).toArray()).find((f) => f.kind === kind && JSON.stringify(f.preset ?? null) === JSON.stringify(preset ?? null));
  if (existing) {
    await db.favorites.delete(existing.id);
    return false;
  }
  const count = await db.favorites.count();
  await db.favorites.add({ id: uid('fav'), kind, refId, label, preset, order: count, createdAt: now() });
  return true;
}

// ───────────────────────── Yardımcılar ─────────────────────────

export async function setAllowance(pct: AllowancePct): Promise<void> {
  await saveGoals({ exerciseAllowancePct: pct });
}

export function yesterdayOf(date: DateKey): DateKey {
  return addDays(date, -1);
}
