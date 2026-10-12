/**
 * Open Food Facts entegrasyonu (gerçek API, anahtar gerektirmez).
 * Veriler Open Food Facts katkıcılarına aittir ve Open Database License (ODbL) ile lisanslıdır.
 * https://world.openfoodfacts.org — ürün verileri gönüllülerce girilir; eksik/hatalı olabilir.
 */
import type { Food, Nutrients } from '../db/types';

export const OFF_ATTRIBUTION = 'Ürün verisi: Open Food Facts katkıcıları (ODbL lisansı)';

export interface OffProduct {
  barcode: string;
  name: string;
  brand?: string;
  per100: Nutrients;
  /** 100 g mı 100 ml mi (etikette içecekler genelde 100 ml) */
  basis: 'g' | 'ml';
  servingLabel?: string;
  servingAmount?: number;
  imageUrl?: string;
  /** Kalori veya makrolardan biri eksikse true */
  incomplete: boolean;
  missing: string[];
  unverified: boolean;
}

type OffNutriments = Record<string, number | string | undefined>;

function n(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

export function validBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(code.trim());
}

export function parseOffProduct(barcode: string, p: Record<string, unknown>): OffProduct {
  const nut = (p.nutriments ?? {}) as OffNutriments;
  let kcal = n(nut['energy-kcal_100g']);
  if (kcal === null) {
    const kj = n(nut['energy-kj_100g'] ?? nut['energy_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = n(nut['proteins_100g']);
  const carb = n(nut['carbohydrates_100g']);
  const fat = n(nut['fat_100g']);
  const missing: string[] = [];
  if (kcal === null) missing.push('kalori');
  if (protein === null) missing.push('protein');
  if (carb === null) missing.push('karbonhidrat');
  if (fat === null) missing.push('yağ');
  const states = Array.isArray(p.states_tags) ? (p.states_tags as string[]) : [];
  const quantity = String(p.quantity ?? '').toLowerCase();
  const basis: 'g' | 'ml' = /\d\s*(ml|cl|l)\b/.test(quantity) ? 'ml' : 'g';
  const servingQty = n(p.serving_quantity);
  return {
    barcode,
    name: String(p.product_name_tr || p.product_name || p.generic_name || 'Adı bilinmeyen ürün').trim(),
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    per100: { kcal: kcal ?? 0, protein: protein ?? 0, carb: carb ?? 0, fat: fat ?? 0, fiber: n(nut['fiber_100g']), sugar: n(nut['sugars_100g']) },
    basis,
    servingLabel: p.serving_size && /\d/.test(String(p.serving_size)) ? String(p.serving_size) : undefined,
    servingAmount: servingQty && servingQty > 0 ? servingQty : undefined,
    imageUrl: p.image_front_small_url ? String(p.image_front_small_url) : undefined,
    incomplete: missing.length > 0,
    missing,
    unverified: states.includes('en:nutrition-facts-to-be-completed') || states.includes('en:to-be-checked'),
  };
}

export type OffLookup = { status: 'found'; product: OffProduct } | { status: 'not_found' } | { status: 'offline' } | { status: 'error'; message: string };

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<OffLookup> {
  const code = barcode.trim();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const fields = 'product_name,product_name_tr,generic_name,brands,nutriments,serving_size,serving_quantity,quantity,image_front_small_url,states_tags';
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', message: `Sunucu yanıtı: ${res.status}` };
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (data.status !== 1 || !data.product) return { status: 'not_found' };
    return { status: 'found', product: parseOffProduct(code, data.product) };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error', message: 'Bağlantı kurulamadı' } as OffLookup;
  }
}

export function offToFoodInput(p: OffProduct): Pick<Food, 'name' | 'brand' | 'barcode' | 'basis' | 'per100'> & { serving: { unit: 'porsiyon' | 'paket'; label: string; amount: number } } {
  return {
    name: p.name,
    brand: p.brand,
    barcode: p.barcode,
    basis: p.basis,
    per100: p.per100,
    serving: p.servingAmount ? { unit: 'porsiyon', label: p.servingLabel ? `1 porsiyon (${p.servingLabel})` : '1 porsiyon', amount: p.servingAmount } : { unit: 'porsiyon', label: `100 ${p.basis}`, amount: 100 },
  };
}
