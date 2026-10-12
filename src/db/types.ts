/**
 * KaloriDefteri veri modeli.
 *
 * Temel ilkeler:
 *  - Günlük kayıtlar (MealEntry, BeverageEntry) besin değerlerinin kayıt anındaki
 *    kopyasını taşır. Kaynak yemek sonradan düzenlense de geçmiş günler değişmez.
 *  - İçecekler YALNIZCA BeverageEntry tablosunda yaşar. Günlük kalori =
 *    yemek kayıtları + içecek kayıtları. Böylece bir içecek iki kez sayılamaz.
 *  - Bilinmeyen değerler (lif, şeker, kafein) `null` ile tutulur; asla 0 varsayılmaz.
 */

export type ID = string;
/** Yerel saat dilimine göre YYYY-MM-DD */
export type DateKey = string;

/** 100 g veya 100 ml başına (ya da bir kaydın toplamı için) besin değerleri */
export interface Nutrients {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
}

export type DataSource =
  | 'reference' // tek bileşenli gıda; USDA FDC SR Legacy referans değerleriyle uyumlu, yuvarlanmış
  | 'recipe-estimate' // standart tarif üzerinden hesaplanmış tahmini değer
  | 'label-typical' // piyasadaki ürünlerin tipik etiket değeri
  | 'user' // kullanıcı girişi
  | 'recipe' // kullanıcının tarif oluşturucusu
  | 'off' // Open Food Facts
  | 'ai-estimate' // görsel analiz tahmini (kullanıcı onaylı)
  | 'import'; // toplu içe aktarma

export type Confidence = 'high' | 'medium' | 'low';

export type Basis = 'g' | 'ml';

export type ServingUnit =
  | 'g'
  | 'ml'
  | 'adet'
  | 'porsiyon'
  | 'yarim'
  | 'kase'
  | 'tabak'
  | 'dilim'
  | 'kepce'
  | 'bardak'
  | 'yk'
  | 'tk'
  | 'avuc'
  | 'fincan'
  | 'kutu'
  | 'paket'
  | 'sis'
  | 'kupa'
  | 'sise'
  | 'ozel';

export interface FoodServing {
  id: string;
  unit: ServingUnit;
  label: string;
  /** Bu ölçünün temel birim (g veya ml) karşılığı */
  amount: number;
  isDefault?: boolean;
}

export interface FoodCategory {
  id: string;
  name: string;
  order: number;
}

export type Cuisine = 'tr' | 'world' | 'generic';

export interface Food {
  id: ID;
  name: string;
  aliases: string[];
  categoryId: string;
  cuisine: Cuisine;
  basis: Basis;
  per100: Nutrients;
  servings: FoodServing[];
  source: DataSource;
  sourceNote?: string;
  confidence: Confidence;
  /** Tarife göre farklılaşan yemeklerde ana kaydın kimliği */
  variantOf?: ID;
  variantLabel?: string;
  isUser: boolean;
  recipeId?: ID;
  barcode?: string;
  brand?: string;
  description?: string;
  imageId?: ID;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

/** Kullanıcının bir yemek için kaydettiği kişisel porsiyon (yerleşik yemekler dahil) */
export interface UserServing extends FoodServing {
  foodId: ID;
  createdAt: number;
}

export interface MealDef {
  id: string;
  name: string;
  order: number;
  builtin: boolean;
}

export interface MealEntry {
  id: ID;
  date: DateKey;
  mealId: string;
  time: number;
  foodId?: ID;
  recipeId?: ID;
  name: string;
  brand?: string;
  basis: Basis;
  servingLabel: string;
  servingCount: number;
  /** Tüketilen toplam miktar (g veya ml) */
  amount: number;
  /** Kayıt anındaki 100 birim değerleri (anlık görüntü) */
  per100: Nutrients;
  /** Kayıt anındaki toplam değerler */
  totals: Nutrients;
  source: DataSource;
  photoId?: ID;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type BeverageType =
  | 'su'
  | 'maden_suyu'
  | 'filtre_kahve'
  | 'espresso'
  | 'americano'
  | 'turk_kahvesi'
  | 'latte'
  | 'cappuccino'
  | 'soguk_kahve'
  | 'siyah_cay'
  | 'yesil_cay'
  | 'bitki_cayi'
  | 'sut'
  | 'ayran'
  | 'kefir'
  | 'meyve_suyu'
  | 'gazli'
  | 'enerji'
  | 'spor'
  | 'protein'
  | 'smoothie'
  | 'diger'
  | 'ozel';

export interface BeverageIngredient {
  kind: 'beverage' | 'food';
  refId: ID;
  name: string;
  amount: number;
  basis: Basis;
  per100: Nutrients;
  caffeinePer100: number | null;
  /** Hacme katkı sağlar mı (sıvılar evet, şeker/toz hayır) */
  addsVolume: boolean;
}

export interface Beverage {
  id: ID;
  name: string;
  aliases: string[];
  type: BeverageType;
  per100ml: Nutrients;
  /** 100 ml başına kafein (mg). null = bilinmiyor */
  caffeinePer100ml: number | null;
  caffeineNote?: string;
  defaultMl: number;
  servings: { label: string; ml: number }[];
  ingredients?: BeverageIngredient[];
  source: DataSource;
  sourceNote?: string;
  confidence: Confidence;
  isUser: boolean;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface BeverageAddons {
  /** Eklenen şeker (g) */
  sugarG: number;
  /** Eklenen tam yağlı süt (ml) */
  milkMl: number;
}

export interface BeverageEntry {
  id: ID;
  date: DateKey;
  time: number;
  beverageId: ID;
  name: string;
  type: BeverageType;
  /** İçilen toplam hacim (eklenen süt dahil) */
  ml: number;
  baseMl: number;
  addons: BeverageAddons;
  /** Kayıt anındaki içecek değerleri (düzenlemede yeniden hesap için anlık görüntü) */
  per100ml: Nutrients;
  caffeinePer100ml: number | null;
  /** Kayıt anındaki toplam besin değerleri */
  totals: Nutrients;
  caffeineMg: number | null;
  mealId?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type ActivityType =
  | 'yuruyus'
  | 'kosu'
  | 'bisiklet'
  | 'agirlik'
  | 'fitness'
  | 'yuzme'
  | 'yoga'
  | 'pilates'
  | 'futbol'
  | 'basketbol'
  | 'dans'
  | 'diger'
  | 'ozel';

export type Intensity = 'hafif' | 'orta' | 'yuksek';

export interface ActivityEntry {
  id: ID;
  date: DateKey;
  /** Başlangıç zamanı (ms) */
  time: number;
  type: ActivityType;
  name: string;
  durationMin: number;
  intensity: Intensity;
  distanceKm?: number;
  met: number;
  /** Brüt harcama: MET × kg × saat */
  grossKcal: number;
  /** Net harcama: (MET − 1) × kg × saat; dinlenme harcaması BMR'de zaten var */
  netKcal: number;
  /** Bu aktivitenin adım sayacına yansıdığı tahmini adım */
  estSteps: number;
  source: 'manual' | 'health';
  externalId?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StepEntry {
  /** `${date}:${source}` */
  id: string;
  date: DateKey;
  steps: number;
  source: 'manual' | 'health';
  updatedAt: number;
}

export interface WeightEntry {
  id: ID;
  date: DateKey;
  time: number;
  weightKg: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  neckCm?: number | null;
  custom?: Record<string, number>;
  note?: string;
  createdAt: number;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type GoalType = 'maintain' | 'lose' | 'gain' | 'manual';

export interface UserProfile {
  id: 'me';
  name?: string;
  birthYear: number;
  /** Mifflin–St Jeor formülünde kullanılan biyolojik değer */
  sex: Sex;
  heightCm: number;
  startWeightKg: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  targetWeightKg?: number;
  /** Haftalık hedef değişim (kg) */
  rateKgPerWeek: number;
  manualKcal?: number;
  /** Hamilelik/emzirme veya özel tıbbi durum bildirimi (yalnızca uyarı amaçlı) */
  specialCondition?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AllowancePct = 0 | 50 | 100;

/** Belirli bir tarihten itibaren geçerli hedefler. Geçmiş günler eski hedefi korur. */
export interface DailyGoalSettings {
  effectiveFrom: DateKey;
  baseKcal: number;
  method: 'mifflin' | 'manual';
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  waterMl: number;
  fluidMl: number;
  caffeineLimitMg: number | null;
  exerciseAllowancePct: AllowancePct;
  /** Seçilen aktivite düzeyinin zaten içerdiği günlük adım */
  stepBaseline: number;
  calcSummary?: string;
  updatedAt: number;
}

export interface QuickDrink {
  id: string;
  beverageId: ID;
  ml: number;
  label?: string;
}

export interface ReminderSettings {
  enabled: boolean;
  waterEveryMin: number | null;
  mealTimes: string[];
  weightTime: string | null;
  dailyReviewTime: string | null;
}

export interface AppSettings {
  id: 'app';
  theme: 'system' | 'light' | 'dark';
  meals: MealDef[];
  quickDrinks: QuickDrink[];
  reminders: ReminderSettings;
  visionApiKey?: string;
  lastBackupAt?: number;
  onboarded: boolean;
  caffeineTracking: boolean;
  updatedAt: number;
}

export type FavoriteKind = 'food' | 'beverage' | 'recipe' | 'template';

export interface FavoriteItem {
  id: ID;
  kind: FavoriteKind;
  refId: ID;
  label: string;
  /** Favori için kayıtlı miktar (ör. 300 ml filtre kahve, 1 kase çorba) */
  preset?: { servingId?: string; count?: number; ml?: number; addons?: BeverageAddons };
  order: number;
  createdAt: number;
}

export interface RecipeIngredient {
  kind: 'food' | 'beverage';
  refId: ID;
  name: string;
  /** g (yemek) veya ml (içecek) */
  amount: number;
  basis: Basis;
  per100: Nutrients;
}

export interface Recipe {
  id: ID;
  name: string;
  categoryId: string;
  ingredients: RecipeIngredient[];
  /** Pişmiş toplam ağırlık; bilinmiyorsa null (çiğ toplam kullanılır) */
  cookedWeightG: number | null;
  servings: number;
  note?: string;
  /** Aramada görünmesi için üretilen yemek kaydı */
  foodId: ID;
  createdAt: number;
  updatedAt: number;
}

export interface MealTemplate {
  id: ID;
  name: string;
  items: Array<Omit<MealEntry, 'id' | 'date' | 'mealId' | 'time' | 'createdAt' | 'updatedAt'>>;
  beverages: Array<Omit<BeverageEntry, 'id' | 'date' | 'time' | 'createdAt' | 'updatedAt' | 'mealId'>>;
  createdAt: number;
}

export interface PhotoRecord {
  id: ID;
  blob: Blob;
  createdAt: number;
  note?: string;
}
