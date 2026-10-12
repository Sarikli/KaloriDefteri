import Dexie, { type Table } from 'dexie';
import type {
  ActivityEntry,
  AppSettings,
  Beverage,
  BeverageEntry,
  DailyGoalSettings,
  FavoriteItem,
  Food,
  MealEntry,
  MealTemplate,
  PhotoRecord,
  Recipe,
  StepEntry,
  UserProfile,
  UserServing,
  WeightEntry,
} from './types';

/**
 * IndexedDB şeması. Yerleşik yemek/içecek veritabanı uygulama koduyla gelir (data/);
 * bu tablolar yalnızca kullanıcıya ait verileri tutar. Şema sürümleri ileride
 * `this.version(n).upgrade(...)` ile taşınabilir; bulut senkronizasyonu için her kayıtta
 * `updatedAt` bulunur.
 */
export class KaloriDB extends Dexie {
  foods!: Table<Food, string>;
  userServings!: Table<UserServing, string>;
  mealEntries!: Table<MealEntry, string>;
  beverages!: Table<Beverage, string>;
  beverageEntries!: Table<BeverageEntry, string>;
  activities!: Table<ActivityEntry, string>;
  steps!: Table<StepEntry, string>;
  weights!: Table<WeightEntry, string>;
  recipes!: Table<Recipe, string>;
  templates!: Table<MealTemplate, string>;
  favorites!: Table<FavoriteItem, string>;
  profile!: Table<UserProfile, string>;
  goals!: Table<DailyGoalSettings, string>;
  settings!: Table<AppSettings, string>;
  photos!: Table<PhotoRecord, string>;

  constructor(name = 'kaloridefteri') {
    super(name);
    this.version(1).stores({
      foods: 'id, name, categoryId, barcode, recipeId, updatedAt',
      userServings: 'id, foodId',
      mealEntries: 'id, date, mealId, foodId, [date+mealId], time',
      beverages: 'id, type, updatedAt',
      beverageEntries: 'id, date, type, beverageId, time',
      activities: 'id, date, source, externalId',
      steps: 'id, date, source',
      weights: 'id, date',
      recipes: 'id, name, foodId',
      templates: 'id',
      favorites: 'id, kind, refId',
      profile: 'id',
      goals: 'effectiveFrom',
      settings: 'id',
      photos: 'id, createdAt',
    });
  }
}

export let db = new KaloriDB();

/** Testlerde ayrı bir veritabanı kullanmak için */
export function useDatabase(instance: KaloriDB) {
  db = instance;
}

export const TABLE_NAMES = [
  'foods',
  'userServings',
  'mealEntries',
  'beverages',
  'beverageEntries',
  'activities',
  'steps',
  'weights',
  'recipes',
  'templates',
  'favorites',
  'profile',
  'goals',
  'settings',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
