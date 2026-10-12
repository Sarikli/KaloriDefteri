/**
 * Yerleşik içecekler (100 ml başına). Kafein: mg/100 ml; null = bilinmiyor.
 * Kafein değerleri demleme yöntemi, çekirdek/yaprak türü ve porsiyona göre geniş aralıkta değişir.
 */
import type { Beverage, BeverageType, Confidence, DataSource } from '../db/types';

type Row = [
  id: string,
  name: string,
  type: BeverageType,
  kcal: number,
  protein: number,
  carb: number,
  fat: number,
  sugar: number | null,
  caffeine: number | null,
  defaultMl: number,
  servings: string,
  aliases: string,
  src: 'R' | 'E' | 'E-' | 'L',
  caffeineNote?: string,
];

const ROWS: Row[] = [
  ['su', 'Su', 'su', 0, 0, 0, 0, 0, 0, 250, 'Su bardağı:200|Büyük bardak:300|Küçük şişe:330|Şişe:500|Büyük şişe:1500', 'içme suyu, damacana', 'R'],
  ['maden-suyu', 'Maden suyu (sade)', 'maden_suyu', 0, 0, 0, 0, 0, 0, 200, 'Şişe:200|Büyük şişe:330', 'soda, mineralli su', 'R'],
  ['filtre-kahve', 'Filtre kahve (sade)', 'filtre_kahve', 1, 0.1, 0, 0, 0, 40, 300, 'Fincan:150|Kupa:250|Büyük kupa:350', 'kahve, drip', 'R', 'Ortalama ~40 mg/100 ml; demleme oranına göre 30–60 mg/100 ml arası değişir.'],
  ['espresso', 'Espresso', 'espresso', 9, 0.1, 1.7, 0.2, 0, 212, 30, 'Tek shot:30|Double:60', 'espresso', 'R', 'Bir shot (~30 ml) yaklaşık 60–65 mg.'],
  ['americano', 'Americano', 'americano', 2, 0.1, 0.3, 0, 0, 40, 300, 'Küçük:240|Orta:350|Büyük:470', '', 'E-', 'Shot sayısına bağlı; tahmini değer.'],
  ['turk-kahvesi', 'Türk kahvesi (sade)', 'turk_kahvesi', 4, 0.2, 0.7, 0, 0, 80, 70, 'Fincan:70', 'türk kahvesi, köpüklü kahve', 'E-', 'Fincan başına yaklaşık 50–65 mg; kahve miktarına göre çok değişir.'],
  ['latte', 'Latte (tam yağlı süt)', 'latte', 51, 2.8, 4.2, 2.7, 4.2, 21, 350, 'Küçük:240|Orta:350|Büyük:470', 'caffe latte', 'E', 'Tek/çift shot ve bardak boyuna göre değişir.'],
  ['cappuccino', 'Cappuccino (tam yağlı süt)', 'cappuccino', 40, 2.2, 3.4, 2.1, 3.3, 21, 240, 'Küçük:180|Orta:240|Büyük:350', '', 'E', 'Tek/çift shot ve bardak boyuna göre değişir.'],
  ['soguk-kahve', 'Soğuk kahve (cold brew, sade)', 'soguk_kahve', 2, 0.1, 0.2, 0, 0, null, 350, 'Bardak:350|Büyük:470', 'cold brew, iced americano, buzlu kahve', 'E-', 'Demleme süresine göre çok değişir; değer bilinmiyor olarak işaretli. Biliyorsan düzenle.'],
  ['buzlu-latte', 'Buzlu latte (yarım yağlı süt)', 'soguk_kahve', 35, 2.3, 3.6, 1.2, 3.6, 18, 400, 'Orta:400|Büyük:500', 'iced latte', 'E'],
  ['siyah-cay', 'Siyah çay (demli, şekersiz)', 'siyah_cay', 1, 0, 0.3, 0, 0, 20, 100, 'İnce belli bardak:100|Kupa:250', 'çay, demli çay', 'R', 'Demin koyuluğuna göre 15–40 mg/100 ml.'],
  ['yesil-cay', 'Yeşil çay', 'yesil_cay', 1, 0.2, 0, 0, 0, 12, 200, 'Fincan:200|Kupa:300', '', 'R'],
  ['bitki-cayi', 'Bitki çayı (ıhlamur, adaçayı, papatya…)', 'bitki_cayi', 1, 0, 0.2, 0, 0, 0, 200, 'Fincan:200|Kupa:300', 'ıhlamur, adaçayı, papatya, kuşburnu, nane limon', 'R', 'Gerçek bitki çaylarında kafein yoktur (mate ve karışımlar hariç).'],
  ['sut', 'Süt (tam yağlı)', 'sut', 61, 3.2, 4.8, 3.3, 5.1, 0, 200, 'Su bardağı:200|Kupa:250', 'süt', 'R'],
  ['sut-yarim', 'Süt (yarım yağlı, %1,5)', 'sut', 46, 3.3, 4.8, 1.5, 4.8, 0, 200, 'Su bardağı:200|Kupa:250', 'light süt', 'L'],
  ['ayran', 'Ayran', 'ayran', 37, 1.7, 2.7, 2.1, 2.7, 0, 200, 'Bardak:200|Küçük kutu:170|Büyük kutu:300', 'ayran', 'L'],
  ['kefir', 'Kefir (sade)', 'kefir', 58, 3.3, 4.3, 3.0, 4.3, 0, 200, 'Bardak:200|Şişe:500', 'kefir', 'L'],
  ['portakal-suyu', 'Portakal suyu (%100)', 'meyve_suyu', 45, 0.7, 10.4, 0.2, 8.4, 0, 200, 'Bardak:200|Kutu:250', 'taze sıkma portakal', 'R'],
  ['meyve-nektari', 'Meyve nektarı (karışık)', 'meyve_suyu', 55, 0.2, 13.5, 0, 13, 0, 200, 'Kutu:200|Bardak:250', 'meyve suyu, nektar', 'L'],
  ['kola', 'Kola', 'gazli', 42, 0, 10.6, 0, 10.6, 10, 330, 'Kutu:330|Küçük şişe:250|Şişe:500|Bardak:200', 'kola, cola', 'L', 'Markaya göre ~9–10 mg/100 ml.'],
  ['kola-sekersiz', 'Kola (şekersiz)', 'gazli', 0.3, 0, 0, 0, 0, 11, 330, 'Kutu:330|Şişe:500', 'zero, light kola', 'L', 'Markaya göre ~9–13 mg/100 ml.'],
  ['gazoz', 'Gazoz (limonlu)', 'gazli', 40, 0, 10, 0, 10, 0, 250, 'Şişe:250|Kutu:330', 'gazoz, limonata gazlı', 'L'],
  ['enerji-icecegi', 'Enerji içeceği', 'enerji', 46, 0, 11, 0, 11, 32, 250, 'Kutu:250|Büyük kutu:500', 'red bull', 'L', 'Yaygın ürünlerde ~32 mg/100 ml (250 ml kutuda ~80 mg).'],
  ['spor-icecegi', 'Spor içeceği (izotonik)', 'spor', 26, 0, 6.4, 0, 6, 0, 500, 'Şişe:500', 'izotonik', 'L'],
  ['protein-icecegi', 'Protein içeceği (hazır)', 'protein', 48, 6, 3, 1.2, 2.5, 0, 330, 'Şişe:330', 'protein shake', 'L'],
  ['smoothie', 'Smoothie (meyveli)', 'smoothie', 60, 0.8, 14, 0.3, 11, 0, 300, 'Bardak:300|Büyük:450', '', 'E'],
  ['limonata', 'Limonata (ev yapımı, şekerli)', 'diger', 45, 0.1, 11.5, 0, 11, 0, 250, 'Bardak:250', 'limonata', 'E'],
  ['salgam', 'Şalgam suyu', 'diger', 10, 0.3, 2, 0, null, 0, 250, 'Bardak:250|Şişe:300', 'şalgam', 'E-'],
  ['boza', 'Boza', 'diger', 100, 1.2, 23, 0.3, null, 0, 200, 'Bardak:200', '', 'E-'],
  ['sahlep', 'Sahlep (sütlü)', 'diger', 100, 3.2, 15, 3, 12, 0, 200, 'Fincan:200|Kupa:300', 'salep', 'E-'],
  ['sicak-cikolata', 'Sıcak çikolata', 'diger', 80, 3.2, 11, 2.8, 9, 2, 250, 'Kupa:250', '', 'E'],
  ['ice-tea', 'Soğuk çay (şeftalili, şekerli)', 'diger', 30, 0, 7.5, 0, 7.4, null, 330, 'Kutu:330|Şişe:500', 'ice tea, buzlu çay', 'L', 'Ürüne göre değişir; bilinmiyor olarak işaretli.'],
];

const SRC: Record<Row[12], [DataSource, Confidence]> = {
  R: ['reference', 'high'],
  E: ['recipe-estimate', 'medium'],
  'E-': ['recipe-estimate', 'low'],
  L: ['label-typical', 'medium'],
};

export const BUILTIN_BEVERAGES: Beverage[] = ROWS.map(([id, name, type, kcal, protein, carb, fat, sugar, caffeine, defaultMl, servings, aliases, src, caffeineNote]) => {
  const [source, confidence] = SRC[src];
  return {
    id: `bv:${id}`,
    name,
    aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
    type,
    per100ml: { kcal, protein, carb, fat, fiber: 0, sugar },
    caffeinePer100ml: caffeine,
    caffeineNote,
    defaultMl,
    servings: servings.split('|').map((s) => {
      const [label, ml] = s.split(':');
      return { label, ml: Number(ml) };
    }),
    source,
    confidence,
    isUser: false,
    createdAt: 0,
    updatedAt: 0,
  };
});

export const BUILTIN_BEVERAGE_MAP = new Map(BUILTIN_BEVERAGES.map((b) => [b.id, b]));

export const DEFAULT_QUICK_DRINKS = [
  { id: 'q1', beverageId: 'bv:su', ml: 250 },
  { id: 'q2', beverageId: 'bv:su', ml: 500 },
  { id: 'q3', beverageId: 'bv:siyah-cay', ml: 200, label: '2 bardak çay' },
  { id: 'q4', beverageId: 'bv:filtre-kahve', ml: 300 },
];
