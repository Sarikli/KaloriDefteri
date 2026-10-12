import type { FoodCategory } from '../db/types';

const names: Array<[string, string]> = [
  ['corba', 'Çorbalar'],
  ['kirmizi_et', 'Kırmızı et yemekleri'],
  ['tavuk', 'Tavuk yemekleri'],
  ['balik', 'Balık ve deniz ürünleri'],
  ['kebap', 'Kebap çeşitleri'],
  ['sulu_yemek', 'Sulu ev yemekleri'],
  ['sebze_yemek', 'Sebze yemekleri'],
  ['zeytinyagli', 'Zeytinyağlılar'],
  ['baklagil', 'Baklagiller'],
  ['pilav', 'Pilav çeşitleri'],
  ['makarna', 'Makarna ve erişteler'],
  ['borek', 'Börek ve hamur işleri'],
  ['kahvalti', 'Türk kahvaltısı'],
  ['peynir', 'Peynir çeşitleri'],
  ['yumurta', 'Yumurtalı yemekler'],
  ['ekmek', 'Ekmek çeşitleri'],
  ['sokak', 'Sokak lezzetleri'],
  ['pide', 'Pide, lahmacun ve pizza'],
  ['fastfood', 'Fast food'],
  ['salata', 'Salatalar'],
  ['meze', 'Mezeler'],
  ['cerez', 'Çerez ve kuruyemişler'],
  ['meyve', 'Meyveler'],
  ['sebze', 'Sebzeler'],
  ['sut', 'Süt ürünleri'],
  ['tatli', 'Türk tatlıları ve tatlılar'],
  ['dunya', 'Dünya mutfağı'],
  ['paketli', 'Paketli ürünler'],
  ['icecek', 'İçecekler'],
  ['sos_yag', 'Soslar, yağlar ve şeker'],
  ['kisisel', 'Kişisel yemekler ve tarifler'],
];

export const CATEGORIES: FoodCategory[] = names.map(([id, name], i) => ({ id, name, order: i }));
export const CATEGORY_NAME: Record<string, string> = Object.fromEntries(names);
