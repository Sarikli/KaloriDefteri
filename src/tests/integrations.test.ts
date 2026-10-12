import { describe, expect, it } from 'vitest';
import { parseOffProduct, validBarcode, offToFoodInput } from '../integrations/openFoodFacts';

// Open Food Facts API v2 yanıtından alınmış gerçek örnek (3017620422003)
const nutella = {
  product_name: 'Nutella',
  brands: 'Nutella, Ferrero',
  quantity: '400 g',
  serving_size: 'e',
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, fiber_100g: 0 },
  states_tags: ['en:complete'],
};

describe('Open Food Facts', () => {
  it('ürün değerlerini 100 g başına ayrıştırır', () => {
    const p = parseOffProduct('3017620422003', nutella);
    expect(p.name).toBe('Nutella');
    expect(p.brand).toBe('Nutella');
    expect(p.per100.kcal).toBe(539);
    expect(p.per100.sugar).toBe(56.3);
    expect(p.basis).toBe('g');
    expect(p.incomplete).toBe(false);
    expect(p.servingLabel).toBeUndefined();
    expect(offToFoodInput(p).serving.amount).toBe(100);
  });
  it('eksik değerleri işaretler, kJ’den kaloriye çevirir, içecekleri ml kabul eder', () => {
    const p = parseOffProduct('8690000000001', { product_name: 'Ayran', quantity: '300 ml', nutriments: { 'energy-kj_100g': 155 }, states_tags: ['en:nutrition-facts-to-be-completed'] });
    expect(p.per100.kcal).toBeCloseTo(37.05, 1);
    expect(p.incomplete).toBe(true);
    expect(p.missing).toEqual(['protein', 'karbonhidrat', 'yağ']);
    expect(p.unverified).toBe(true);
    expect(p.basis).toBe('ml');
  });
  it('barkod biçimini doğrular', () => {
    expect(validBarcode('3017620422003')).toBe(true);
    expect(validBarcode('12345')).toBe(false);
    expect(validBarcode('96385074')).toBe(true);
  });
});
