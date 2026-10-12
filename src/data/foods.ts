/**
 * Başlangıç yemek veritabanı.
 *
 * KAYNAK VE GÜVENİLİRLİK (her kayıtta saklanır):
 *  - 'reference' (R): Tek bileşenli gıdalar. USDA FoodData Central (SR Legacy) referans değerleriyle
 *    uyumlu, yuvarlanmış değerler. Bu sürümde canlı bir veri aktarımıyla değil, referans değerlerden
 *    derlenmiştir; doğruluk düzeyi "yüksek" olarak işaretlenmiştir.
 *  - 'recipe-estimate' (E): Türk mutfağı ve karışık yemekler. Yaygın ev/lokanta tarifleri üzerinden
 *    malzeme bazlı tahmin. Tarif, yağ miktarı ve porsiyona göre ±%20–30 değişebilir. "Orta" ya da
 *    çok değişken yemeklerde "düşük" güvenilirlik.
 *  - 'label-typical' (L): Paketli ürünlerde piyasadaki tipik etiket değerleri. Marka bazında
 *    kesin değer için barkod ile Open Food Facts araması kullanılmalıdır.
 *
 * TürKomp (Ulusal Gıda Kompozisyon Veri Tabanı) değerleriyle doğrulama ve toplu içe aktarma için
 * Profil › Veri › "Yemek içe aktar" (JSON/CSV) kullanılabilir. Bkz. docs/VERI_KAYNAKLARI.md
 *
 * Satır biçimi: [id, ad, kategori, kcal, protein, karbonhidrat, yağ, lif|null, ölçüler, takma adlar, bayraklar]
 * Değerler 100 g başınadır. Ölçüler: "birim:miktar[*][:etiket]" — '*' varsayılan ölçü.
 * Bayraklar: R | E | E- | L (kaynak/güven), t | w | g (mutfak), sN (100 g'da şeker), v=<ana id>:<varyasyon adı>
 */
import type { Confidence, Cuisine, DataSource, Food, FoodServing, ServingUnit } from '../db/types';
import { UNIT_LABEL } from '../engine/portion';

type Row = [string, string, string, number, number, number, number, number | null, string, string?, string?];

const ROWS: Row[] = [
  // ───────────── ÇORBALAR ─────────────
  ['mercimek-corbasi', 'Mercimek çorbası', 'corba', 62, 3.6, 9.0, 1.5, 1.6, 'kase:250*|kepce:125', 'kırmızı mercimek çorbası, süzme mercimek'],
  ['ezogelin-corbasi', 'Ezogelin çorbası', 'corba', 66, 3.2, 10.2, 1.6, 1.8, 'kase:250*|kepce:125', 'ezo gelin'],
  ['tarhana-corbasi', 'Tarhana çorbası', 'corba', 58, 2.2, 8.5, 1.8, 0.8, 'kase:250*|kepce:125'],
  ['yayla-corbasi', 'Yayla çorbası', 'corba', 54, 2.4, 6.8, 2.0, 0.3, 'kase:250*|kepce:125', 'yoğurt çorbası'],
  ['domates-corbasi', 'Domates çorbası', 'corba', 48, 1.2, 6.2, 2.1, 0.8, 'kase:250*|kepce:125'],
  ['iskembe-corbasi', 'İşkembe çorbası', 'corba', 68, 6.0, 3.0, 3.6, 0.1, 'kase:300*', 'iskembe', 'E- t'],
  ['tavuk-suyu-corbasi', 'Tavuk suyu çorbası (şehriyeli)', 'corba', 45, 3.2, 5.0, 1.3, 0.3, 'kase:250*|kepce:125', 'tavuk çorbası, şehriye çorbası'],
  ['kelle-paca', 'Kelle paça çorbası', 'corba', 75, 7.0, 2.0, 4.4, 0.1, 'kase:300*', 'paça', 'E- t'],
  ['sehriye-corbasi', 'Şehriye çorbası (domatesli)', 'corba', 52, 1.6, 8.0, 1.6, 0.4, 'kase:250*'],
  ['mantar-corbasi', 'Kremalı mantar çorbası', 'corba', 60, 1.5, 5.0, 3.8, 0.5, 'kase:250*'],
  ['sebze-corbasi', 'Sebze çorbası', 'corba', 42, 1.3, 6.5, 1.3, 1.2, 'kase:250*'],
  ['dugun-corbasi', 'Düğün çorbası', 'corba', 70, 5.0, 4.0, 3.8, 0.2, 'kase:250*'],
  ['brokoli-corbasi', 'Kremalı brokoli çorbası', 'corba', 55, 2.0, 5.0, 3.0, 1.0, 'kase:250*'],
  ['beyran', 'Beyran çorbası', 'corba', 85, 7.5, 6.0, 3.5, 0.3, 'kase:350*', 'beyran', 'E- t'],
  ['balik-corbasi', 'Balık çorbası', 'corba', 55, 5.0, 4.0, 2.0, 0.3, 'kase:250*'],
  ['ayran-asi', 'Ayran aşı çorbası', 'corba', 60, 3.0, 7.0, 2.2, 1.0, 'kase:250*', 'ayran aşı'],

  // ───────────── KIRMIZI ET ─────────────
  ['et-sote', 'Et sote', 'kirmizi_et', 175, 18, 4, 9.5, 0.8, 'porsiyon:200*', 'dana sote'],
  ['kuzu-tandir', 'Kuzu tandır', 'kirmizi_et', 230, 22, 0, 15.5, 0, 'porsiyon:200*', 'tandır'],
  ['hunkar-begendi', 'Hünkar beğendi', 'kirmizi_et', 165, 9, 7, 11, 0.6, 'porsiyon:300*'],
  ['tas-kebabi', 'Tas kebabı', 'kirmizi_et', 150, 12, 5, 9, 0.8, 'porsiyon:250*'],
  ['izgara-kofte', 'Izgara köfte', 'kirmizi_et', 245, 17, 6, 17, 0.4, 'porsiyon:150*:1 porsiyon (6 adet)|adet:25', 'kasap köfte, köfte'],
  ['inegol-kofte', 'İnegöl köfte', 'kirmizi_et', 260, 17, 5, 19, 0.3, 'porsiyon:150*|adet:25'],
  ['kadinbudu-kofte', 'Kadınbudu köfte', 'kirmizi_et', 250, 13, 12, 16.5, 0.4, 'adet:70*'],
  ['izmir-kofte', 'İzmir köfte', 'kirmizi_et', 140, 7.5, 9, 8.5, 1.4, 'porsiyon:300*'],
  ['sulu-kofte', 'Sulu köfte (ekşili)', 'kirmizi_et', 105, 6.5, 8, 5.2, 0.8, 'kase:300*', 'ekşili köfte'],
  ['icli-kofte', 'İçli köfte (kızartma)', 'kirmizi_et', 265, 10, 26, 13, 2.5, 'adet:80*', 'içli köfte'],
  ['icli-kofte-haslama', 'İçli köfte (haşlama)', 'kirmizi_et', 190, 10, 25, 5.5, 2.8, 'adet:80*', 'haşlama içli köfte', 'E t v=icli-kofte:Haşlama'],
  ['kiymali-patates', 'Kıymalı patates yemeği', 'kirmizi_et', 115, 5.5, 10, 6, 1.2, 'porsiyon:250*'],
  ['ciger-tava', 'Arnavut ciğeri / ciğer tava', 'kirmizi_et', 210, 22, 8, 10, 0.3, 'porsiyon:150*', 'ciğer'],
  ['kavurma', 'Kavurma', 'kirmizi_et', 300, 22, 0, 23.5, 0, 'porsiyon:100*', 'et kavurma', 'E- t'],
  ['dana-bonfile', 'Dana bonfile (ızgara)', 'kirmizi_et', 200, 28, 0, 9.5, 0, 'porsiyon:150*', 'biftek, steak', 'R g'],
  ['kuzu-pirzola', 'Kuzu pirzola (ızgara)', 'kirmizi_et', 290, 25, 0, 21, 0, 'adet:40|porsiyon:180*', 'pirzola', 'E t'],
  ['kiyma-cig', 'Dana kıyma (çiğ, %15–20 yağ)', 'kirmizi_et', 250, 17.5, 0, 20, 0, 'g:100*:100 g', 'kıyma', 'R g'],
  ['kusbasi-cig', 'Dana kuşbaşı (çiğ, orta yağlı)', 'kirmizi_et', 190, 20, 0, 12, 0, 'g:100*:100 g', 'kuşbaşı et', 'E g'],
  ['kuzu-incik', 'Kuzu incik', 'kirmizi_et', 210, 20, 2, 13.5, 0.3, 'porsiyon:250*'],
  ['etli-guvec', 'Etli güveç', 'kirmizi_et', 120, 9, 6, 6.8, 1.5, 'porsiyon:300*', 'güveç'],

  // ───────────── TAVUK ─────────────
  ['tavuk-gogsu-izgara', 'Tavuk göğsü (ızgara, derisiz)', 'tavuk', 165, 31, 0, 3.6, 0, 'porsiyon:150*|adet:170:1 göğüs', 'ızgara tavuk', 'R g'],
  ['tavuk-but-izgara', 'Tavuk but (derisiz, ızgara)', 'tavuk', 179, 24.8, 0, 8.2, 0, 'adet:100|porsiyon:200*', 'pirzola tavuk, but', 'R g'],
  ['tavuk-sote', 'Tavuk sote', 'tavuk', 130, 14, 4.5, 6.2, 0.9, 'porsiyon:250*'],
  ['tavuk-sis', 'Tavuk şiş', 'tavuk', 170, 25, 2, 7, 0.2, 'porsiyon:180*|sis:90', 'şiş tavuk'],
  ['tavuk-kanat', 'Tavuk kanat (ızgara)', 'tavuk', 260, 25, 0.5, 17.5, 0, 'adet:30|porsiyon:180*', 'kanat'],
  ['firin-tavuk-patates', 'Fırında tavuk ve patates', 'tavuk', 145, 12, 9, 7, 1.1, 'porsiyon:350*'],
  ['tavuk-haslama', 'Tavuk haşlama', 'tavuk', 177, 27, 0, 6.7, 0, 'porsiyon:150*', 'haşlanmış tavuk', 'R g'],
  ['cerkez-tavugu', 'Çerkez tavuğu', 'tavuk', 210, 14, 6, 15, 1.2, 'porsiyon:150*'],
  ['tavuk-sinitzel', 'Tavuk şinitzel', 'tavuk', 260, 17, 14, 15, 0.8, 'adet:150*', 'şinitzel', 'E w'],
  ['tavuk-gogsu-cig', 'Tavuk göğsü (çiğ)', 'tavuk', 120, 22.5, 0, 2.6, 0, 'g:100*:100 g', '', 'R g'],
  ['tavuk-but-cig', 'Tavuk but eti (çiğ, derisiz)', 'tavuk', 121, 19.7, 0, 4.1, 0, 'g:100*:100 g', '', 'R g'],
  ['tavuklu-bezelye', 'Tavuklu bezelye', 'tavuk', 95, 8, 8, 3.5, 2.8, 'porsiyon:250*'],

  // ───────────── BALIK ─────────────
  ['hamsi-tava', 'Hamsi tava', 'balik', 250, 17, 8, 17, 0.4, 'porsiyon:200*', 'hamsi'],
  ['levrek-izgara', 'Levrek (ızgara)', 'balik', 124, 23.6, 0, 2.6, 0, 'porsiyon:200*', 'levrek', 'R g'],
  ['cupra-izgara', 'Çipura (ızgara)', 'balik', 140, 21, 0, 6, 0, 'porsiyon:200*', 'çipura', 'E g'],
  ['somon-izgara', 'Somon (ızgara)', 'balik', 206, 22, 0, 12.4, 0, 'porsiyon:150*', 'somon', 'R g'],
  ['uskumru-izgara', 'Uskumru (ızgara)', 'balik', 262, 23.9, 0, 17.8, 0, 'porsiyon:200*', 'uskumru', 'R g'],
  ['palamut-izgara', 'Palamut (ızgara)', 'balik', 165, 24, 0, 7.5, 0, 'porsiyon:200*', 'palamut', 'E- g'],
  ['alabalik-izgara', 'Alabalık (ızgara)', 'balik', 168, 23.8, 0, 7.4, 0, 'porsiyon:200*', 'alabalık', 'R g'],
  ['ton-baligi', 'Ton balığı konserve (yağı süzülmüş)', 'balik', 198, 29, 0, 8.2, 0, 'kutu:120*|yk:15', 'ton balığı', 'R g'],
  ['karides-guvec', 'Karides güveç', 'balik', 155, 13, 4, 9.5, 0.6, 'porsiyon:200*', 'karides'],
  ['kalamar-tava', 'Kalamar tava', 'balik', 220, 13, 15, 12, 0.5, 'porsiyon:150*', 'kalamar'],
  ['midye-tava', 'Midye tava', 'balik', 250, 11, 20, 14, 0.6, 'porsiyon:150*'],
  ['sardalya-izgara', 'Sardalya (ızgara)', 'balik', 208, 24.6, 0, 11.5, 0, 'porsiyon:150*', 'sardalya', 'R g'],

  // ───────────── KEBAP ─────────────
  ['adana-kebap', 'Adana kebap', 'kebap', 280, 17, 2, 23, 0.2, 'porsiyon:180*|sis:90', 'adana'],
  ['urfa-kebap', 'Urfa kebap', 'kebap', 270, 17.5, 2, 21.5, 0.2, 'porsiyon:180*|sis:90', 'urfa'],
  ['iskender', 'İskender kebap', 'kebap', 225, 12, 14, 13.5, 0.8, 'porsiyon:400*|yarim:200:Yarım porsiyon', 'iskender, bursa kebabı'],
  ['beyti', 'Beyti sarma', 'kebap', 260, 15, 15, 15.5, 0.6, 'porsiyon:300*'],
  ['et-doner-porsiyon', 'Et döner (porsiyon, ekmeksiz)', 'kebap', 250, 19, 3, 18, 0.2, 'porsiyon:150*', 'döner, gyros'],
  ['tavuk-doner-porsiyon', 'Tavuk döner (porsiyon, ekmeksiz)', 'kebap', 200, 20, 3, 12, 0.2, 'porsiyon:150*', 'tavuk döner'],
  ['cop-sis', 'Çöp şiş', 'kebap', 230, 22, 1, 15, 0, 'porsiyon:150*'],
  ['kuzu-sis', 'Kuzu şiş', 'kebap', 240, 22, 1, 16.5, 0, 'porsiyon:180*|sis:90'],
  ['patlican-kebabi', 'Patlıcan kebabı', 'kebap', 180, 10, 6, 13, 1.8, 'porsiyon:300*'],
  ['ali-nazik', 'Ali nazik', 'kebap', 165, 10, 5, 12, 1.5, 'porsiyon:300*'],
  ['testi-kebabi', 'Testi kebabı', 'kebap', 145, 12, 5, 8.5, 1.0, 'porsiyon:300*'],
  ['cag-kebabi', 'Cağ kebabı', 'kebap', 260, 21, 1, 19, 0, 'sis:40|porsiyon:200*', 'cağ'],
  ['orman-kebabi', 'Orman kebabı', 'kebap', 130, 10, 6, 7.5, 1.2, 'porsiyon:300*'],
  ['tavuk-adana', 'Tavuk Adana', 'kebap', 210, 19, 2, 14, 0.2, 'porsiyon:180*|sis:90'],

  // ───────────── SULU EV YEMEKLERİ ─────────────
  ['karniyarik', 'Karnıyarık', 'sulu_yemek', 125, 5, 7, 8.5, 2.2, 'adet:200*|porsiyon:250'],
  ['musakka', 'Patlıcan musakka', 'sulu_yemek', 130, 6, 6.5, 9, 1.8, 'porsiyon:250*', 'musakka'],
  ['etli-taze-fasulye', 'Etli taze fasulye', 'sulu_yemek', 85, 4, 6, 5, 2.0, 'porsiyon:250*'],
  ['etli-bezelye', 'Etli bezelye', 'sulu_yemek', 95, 5, 9, 4.5, 3.0, 'porsiyon:250*'],
  ['etli-turlu', 'Türlü (etli)', 'sulu_yemek', 85, 4, 7, 4.8, 1.8, 'porsiyon:250*', 'türlü'],
  ['kiymali-ispanak', 'Ispanak yemeği (kıymalı)', 'sulu_yemek', 80, 4.5, 4.5, 5, 2.2, 'porsiyon:250*', 'ıspanak'],
  ['kapuska', 'Kapuska (etli lahana)', 'sulu_yemek', 70, 3, 6, 4, 2.0, 'porsiyon:250*'],
  ['etli-yaprak-sarma', 'Etli yaprak sarma', 'sulu_yemek', 150, 7, 13, 7.5, 2.0, 'adet:25|porsiyon:200*', 'etli sarma'],
  ['etli-biber-dolmasi', 'Etli biber dolması', 'sulu_yemek', 120, 5.5, 11, 6, 1.5, 'adet:120*', 'dolma'],
  ['kabak-dolmasi', 'Etli kabak dolması', 'sulu_yemek', 95, 5, 8, 4.5, 1.2, 'adet:150*'],
  ['lahana-sarmasi', 'Etli lahana sarması', 'sulu_yemek', 110, 5, 11, 5, 2.0, 'porsiyon:250*|adet:50'],
  ['keskek', 'Keşkek', 'sulu_yemek', 140, 9, 15, 4.8, 1.8, 'kase:250*'],
  ['etli-patates', 'Etli patates yemeği', 'sulu_yemek', 105, 5.5, 10, 5, 1.3, 'porsiyon:250*'],

  // ───────────── SEBZE YEMEKLERİ ─────────────
  ['ispanak-zeytinyagli', 'Ispanak (zeytinyağlı, pirinçli)', 'sebze_yemek', 70, 2.5, 6, 4, 2.3, 'porsiyon:200*'],
  ['karnabahar-yemegi', 'Karnabahar yemeği', 'sebze_yemek', 65, 2, 6, 3.8, 2.0, 'porsiyon:200*'],
  ['bamya', 'Bamya yemeği', 'sebze_yemek', 70, 2, 7, 4, 3.0, 'porsiyon:200*'],
  ['mucver', 'Kabak mücver', 'sebze_yemek', 180, 6, 13, 11.5, 1.4, 'adet:50*', 'mücver'],
  ['patlican-kizartmasi', 'Patlıcan kızartması', 'sebze_yemek', 200, 1.5, 9, 18, 3.0, 'porsiyon:150*', 'kızartma', 'E- t'],
  ['firin-sebze', 'Fırında sebze', 'sebze_yemek', 85, 1.8, 9, 4.7, 2.5, 'porsiyon:250*'],
  ['kabak-yemegi', 'Kabak yemeği (zeytinyağlı)', 'sebze_yemek', 55, 1.5, 6, 3, 1.3, 'porsiyon:200*'],
  ['bezelye-zeytinyagli', 'Bezelye (zeytinyağlı)', 'sebze_yemek', 85, 3.5, 10, 3.5, 4.0, 'porsiyon:200*'],
  ['mantar-sote', 'Mantar sote', 'sebze_yemek', 75, 3, 4, 5.5, 1.5, 'porsiyon:150*'],
  ['patates-oturtma', 'Patates oturtma (kıymasız)', 'sebze_yemek', 120, 2, 14, 6.5, 1.8, 'porsiyon:250*'],

  // ───────────── ZEYTİNYAĞLILAR ─────────────
  ['taze-fasulye-zy', 'Zeytinyağlı taze fasulye', 'zeytinyagli', 75, 1.8, 7, 4.5, 2.6, 'porsiyon:200*', 'taze fasulye'],
  ['imam-bayildi', 'İmam bayıldı', 'zeytinyagli', 120, 1.5, 8, 9.5, 2.8, 'adet:200*'],
  ['yaprak-sarma-zy', 'Zeytinyağlı yaprak sarma', 'zeytinyagli', 160, 2.5, 20, 8, 2.2, 'adet:20|porsiyon:150*', 'sarma, yaprak dolma'],
  ['biber-dolmasi-zy', 'Zeytinyağlı biber dolması', 'zeytinyagli', 145, 2.5, 18, 7, 1.8, 'adet:100*'],
  ['pirasa-zy', 'Zeytinyağlı pırasa', 'zeytinyagli', 75, 1.4, 9, 4, 1.6, 'porsiyon:200*', 'pırasa'],
  ['enginar-zy', 'Zeytinyağlı enginar', 'zeytinyagli', 85, 2.5, 9, 4.5, 4.5, 'adet:150*', 'enginar'],
  ['barbunya-pilaki', 'Barbunya pilaki', 'zeytinyagli', 115, 5.5, 14, 4.2, 5.0, 'porsiyon:200*', 'barbunya'],
  ['zy-turlu', 'Zeytinyağlı türlü', 'zeytinyagli', 80, 1.8, 8, 4.8, 2.5, 'porsiyon:250*'],
  ['kereviz-zy', 'Zeytinyağlı kereviz', 'zeytinyagli', 80, 1.2, 9, 4.5, 2.5, 'porsiyon:200*', 'kereviz'],
  ['fasulye-pilaki', 'Kuru fasulye pilaki', 'zeytinyagli', 120, 6, 14.5, 4.3, 5.0, 'porsiyon:200*'],
  ['zy-bakla', 'Zeytinyağlı taze bakla', 'zeytinyagli', 90, 4, 9, 4.5, 4.0, 'porsiyon:200*', 'bakla'],

  // ───────────── BAKLAGİLLER ─────────────
  ['kuru-fasulye', 'Kuru fasulye (etli)', 'baklagil', 125, 6.5, 14, 4.6, 5.0, 'porsiyon:250*|kase:250|kepce:125', 'kuru fasulye, etli kuru'],
  ['kuru-fasulye-etsiz', 'Kuru fasulye (etsiz, zeytinyağlı)', 'baklagil', 105, 5.5, 14, 3.0, 5.2, 'porsiyon:250*|kepce:125', 'etsiz kuru fasulye', 'E t v=kuru-fasulye:Etsiz'],
  ['nohut-yemegi', 'Nohut yemeği (etli)', 'baklagil', 130, 6.5, 15, 4.8, 4.5, 'porsiyon:250*|kepce:125', 'etli nohut, nohut'],
  ['nohut-yemegi-etsiz', 'Nohut yemeği (etsiz)', 'baklagil', 115, 5.5, 16, 3.3, 4.8, 'porsiyon:250*|kepce:125', 'etsiz nohut', 'E t v=nohut-yemegi:Etsiz'],
  ['yesil-mercimek-yemegi', 'Yeşil mercimek yemeği', 'baklagil', 110, 6.5, 15, 2.8, 4.5, 'porsiyon:250*', 'mercimek yemeği'],
  ['nohut-haslanmis', 'Nohut (haşlanmış)', 'baklagil', 164, 8.9, 27.4, 2.6, 7.6, 'kase:160*|yk:15', 'haşlanmış nohut', 'R g'],
  ['mercimek-haslanmis', 'Mercimek (haşlanmış)', 'baklagil', 116, 9, 20, 0.4, 7.9, 'kase:200*|yk:15', '', 'R g'],
  ['fasulye-haslanmis', 'Kuru fasulye (haşlanmış)', 'baklagil', 127, 8.7, 22.8, 0.5, 6.4, 'kase:180*', '', 'R g'],
  ['kirmizi-mercimek-cig', 'Kırmızı mercimek (çiğ)', 'baklagil', 352, 24.6, 63.4, 1.1, 10.7, 'g:100*:100 g|bardak:180:1 su bardağı', '', 'R g'],
  ['nohut-cig', 'Nohut (kuru, çiğ)', 'baklagil', 378, 20.5, 62.9, 6.0, 12.2, 'g:100*:100 g|bardak:170:1 su bardağı', '', 'R g'],
  ['kuru-fasulye-cig', 'Kuru fasulye (kuru, çiğ)', 'baklagil', 333, 23.6, 60, 0.8, 15.2, 'g:100*:100 g|bardak:180:1 su bardağı', '', 'R g'],

  // ───────────── PİLAV ─────────────
  ['pirinc-pilavi', 'Pirinç pilavı (tereyağlı)', 'pilav', 165, 2.8, 28, 4.6, 0.4, 'porsiyon:150*|tabak:200|kepce:100', 'pilav'],
  ['sehriyeli-pilav', 'Şehriyeli pirinç pilavı', 'pilav', 170, 3, 28.5, 5, 0.5, 'porsiyon:150*|kepce:100', '', 'E t v=pirinc-pilavi:Şehriyeli'],
  ['bulgur-pilavi', 'Bulgur pilavı (domatesli)', 'pilav', 135, 3.5, 23, 3.5, 4.5, 'porsiyon:150*|kepce:100', 'bulgur'],
  ['ic-pilav', 'İç pilav', 'pilav', 190, 4, 30, 6, 1.2, 'porsiyon:150*'],
  ['nohutlu-pilav', 'Nohutlu pilav', 'pilav', 175, 4.5, 28, 5, 2.2, 'porsiyon:150*'],
  ['tavuklu-pilav', 'Tavuklu pilav (pilav üstü tavuk)', 'pilav', 170, 9, 21, 5.5, 0.6, 'porsiyon:300*', 'pilav üstü, nohutlu tavuklu pilav'],
  ['perde-pilavi', 'Perde pilavı', 'pilav', 230, 8, 27, 10, 1.2, 'dilim:200*'],
  ['pirinc-haslanmis', 'Pirinç (haşlanmış, sade)', 'pilav', 130, 2.7, 28, 0.3, 0.4, 'kase:160*', 'beyaz pirinç', 'R g'],
  ['kuskus', 'Kuskus (pişmiş)', 'pilav', 112, 3.8, 23, 0.2, 1.4, 'porsiyon:150*', '', 'R g'],
  ['pirinc-cig', 'Pirinç (çiğ)', 'pilav', 365, 7.1, 80, 0.7, 1.3, 'g:100*:100 g|bardak:180:1 su bardağı', '', 'R g'],
  ['bulgur-cig', 'Bulgur (çiğ)', 'pilav', 342, 12.3, 75.9, 1.3, 12.5, 'g:100*:100 g|bardak:170:1 su bardağı', '', 'R g'],

  // ───────────── MAKARNA ─────────────
  ['makarna-haslanmis', 'Makarna (haşlanmış, sade)', 'makarna', 158, 5.8, 31, 0.9, 1.8, 'porsiyon:200*', 'spagetti', 'R g'],
  ['makarna-salcali', 'Salçalı makarna', 'makarna', 160, 5, 28, 3.2, 1.8, 'porsiyon:250*'],
  ['makarna-bolonez', 'Kıymalı makarna (bolonez)', 'makarna', 155, 7.5, 21, 4.8, 1.6, 'porsiyon:300*', 'bolonez, spagetti bolonez'],
  ['firin-makarna', 'Fırın makarna (beşamelli)', 'makarna', 175, 7, 20, 7.5, 1.0, 'porsiyon:250*'],
  ['eriste', 'Erişte (tereyağlı)', 'makarna', 175, 6, 28, 4.5, 1.4, 'porsiyon:200*'],
  ['kremali-makarna', 'Kremalı mantarlı makarna', 'makarna', 190, 5.5, 23, 8.5, 1.3, 'porsiyon:300*', 'alfredo', 'E w'],
  ['manti', 'Mantı (yoğurtlu, tereyağı soslu)', 'makarna', 175, 8, 22, 6.2, 1.0, 'porsiyon:300*|yarim:150:Yarım porsiyon', 'kayseri mantısı'],
  ['makarna-cig', 'Makarna (kuru, çiğ)', 'makarna', 371, 13, 74.7, 1.5, 3.2, 'g:100*:100 g', '', 'R g'],

  // ───────────── BÖREK VE HAMUR İŞLERİ ─────────────
  ['su-boregi', 'Su böreği', 'borek', 270, 11, 22, 15.5, 0.8, 'dilim:150*'],
  ['sigara-boregi', 'Sigara böreği', 'borek', 290, 9, 24, 18, 1.0, 'adet:30*'],
  ['kol-boregi', 'Kol böreği (patatesli)', 'borek', 300, 6.5, 32, 16.5, 1.4, 'dilim:120*'],
  ['ispanakli-borek', 'Ispanaklı börek', 'borek', 250, 8, 22, 14.5, 1.6, 'dilim:120*'],
  ['kiymali-borek', 'Kıymalı börek', 'borek', 300, 11, 24, 18, 1.0, 'dilim:120*'],
  ['tepsi-boregi', 'Tepsi böreği (peynirli)', 'borek', 260, 9.5, 26, 13, 1.0, 'dilim:120*', 'peynirli börek'],
  ['talas-boregi', 'Talaş böreği', 'borek', 330, 11, 25, 21, 1.0, 'adet:120*'],
  ['pacanga-boregi', 'Paçanga böreği', 'borek', 310, 13, 22, 19, 0.8, 'adet:80*'],
  ['gozleme-peynirli', 'Gözleme (peynirli)', 'borek', 245, 10, 31, 9, 1.4, 'adet:200*', 'gözleme'],
  ['gozleme-patatesli', 'Gözleme (patatesli)', 'borek', 230, 5.5, 37, 7, 2.0, 'adet:220*', '', 'E t v=gozleme-peynirli:Patatesli'],
  ['gozleme-kiymali', 'Gözleme (kıymalı)', 'borek', 250, 11, 31, 9.5, 1.5, 'adet:220*', '', 'E t v=gozleme-peynirli:Kıymalı'],
  ['pogaca-peynirli', 'Poğaça (peynirli)', 'borek', 360, 8.5, 40, 18.5, 1.3, 'adet:70*', 'poğaça'],
  ['pogaca-zeytinli', 'Poğaça (zeytinli)', 'borek', 370, 7, 42, 19, 1.6, 'adet:70*', '', 'E t v=pogaca-peynirli:Zeytinli'],
  ['acma', 'Açma', 'borek', 380, 7.5, 45, 19, 1.4, 'adet:80*'],
  ['pisi', 'Pişi', 'borek', 340, 7, 42, 16, 1.2, 'adet:60*', 'hamur kızartması'],
  ['kete', 'Kete', 'borek', 400, 7, 45, 21, 1.4, 'adet:90*'],
  ['puf-boregi', 'Puf böreği', 'borek', 330, 9, 30, 19, 1.0, 'adet:60*'],
  ['boyoz', 'Boyoz', 'borek', 380, 8, 42, 20, 1.5, 'adet:60*'],

  // ───────────── KAHVALTI ─────────────
  ['bal', 'Bal', 'kahvalti', 304, 0.3, 82.4, 0, 0.2, 'yk:21*|tk:7', '', 'R t s82'],
  ['tahin', 'Tahin', 'kahvalti', 595, 17, 21, 54, 9.3, 'yk:15*', '', 'R t'],
  ['pekmez', 'Üzüm pekmezi', 'kahvalti', 293, 0.5, 74, 0.1, 0, 'yk:20*', 'pekmez', 'E t s70'],
  ['tahin-pekmez', 'Tahin-pekmez (1:1)', 'kahvalti', 444, 8.8, 47.5, 27, 4.6, 'yk:20*'],
  ['recel', 'Reçel', 'kahvalti', 260, 0.4, 64, 0.1, 1.0, 'yk:20*|tk:8', 'marmelat', 'R t s48'],
  ['kaymak', 'Kaymak', 'kahvalti', 430, 3, 3.5, 45, 0, 'yk:20*', '', 'E- t'],
  ['siyah-zeytin', 'Siyah zeytin (Gemlik tipi)', 'kahvalti', 280, 2, 4.5, 28, 3.5, 'adet:20*:5 adet|adet:4:1 adet', 'zeytin, gemlik', 'E- t'],
  ['yesil-zeytin', 'Yeşil zeytin', 'kahvalti', 145, 1, 3.8, 15.3, 3.3, 'adet:20*:5 adet|adet:4:1 adet', '', 'R t'],
  ['muhlama', 'Muhlama / kuymak', 'kahvalti', 330, 9, 15, 26, 0.3, 'porsiyon:200*', 'kuymak, mıhlama'],
  ['yulaf-ezmesi', 'Yulaf ezmesi', 'kahvalti', 389, 16.9, 66, 6.9, 10.6, 'porsiyon:40*|yk:10', 'yulaf', 'R g'],
  ['fistik-ezmesi', 'Fıstık ezmesi', 'kahvalti', 588, 25, 20, 50, 6.0, 'yk:16*', '', 'R g'],
  ['pastirma', 'Pastırma', 'kahvalti', 250, 30, 1, 14, 0, 'dilim:8*|porsiyon:50', '', 'E- t'],
  ['sucuk', 'Sucuk', 'kahvalti', 430, 18, 2, 39, 0, 'dilim:10*|porsiyon:60', '', 'E- t'],
  ['kahvalti-tabagi', 'Serpme kahvaltı tabağı (kişi başı, ekmeksiz)', 'kahvalti', 270, 13, 8, 21, 1.2, 'porsiyon:250*', 'serpme kahvaltı', 'E- t'],

  // ───────────── PEYNİR ─────────────
  ['beyaz-peynir', 'Beyaz peynir (tam yağlı)', 'peynir', 270, 16, 2, 22, 0, 'dilim:30*|porsiyon:50', 'ezine, beyaz peynir'],
  ['beyaz-peynir-yarim', 'Beyaz peynir (yarım yağlı)', 'peynir', 200, 18, 2, 13, 0, 'dilim:30*', '', 'E t v=beyaz-peynir:Yarım yağlı'],
  ['kasar', 'Kaşar peyniri (taze)', 'peynir', 360, 25, 1.5, 28.5, 0, 'dilim:20*', 'kaşar'],
  ['eski-kasar', 'Eski kaşar', 'peynir', 400, 28, 1, 32, 0, 'dilim:20*'],
  ['tulum', 'Tulum peyniri', 'peynir', 360, 22, 1.5, 30, 0, 'dilim:30*'],
  ['lor', 'Lor peyniri', 'peynir', 100, 13, 3, 4, 0, 'yk:20|porsiyon:50*'],
  ['cokelek', 'Çökelek', 'peynir', 100, 15, 4, 2.5, 0, 'porsiyon:50*'],
  ['labne', 'Labne', 'peynir', 220, 6, 4, 20, 0, 'yk:20*', '', 'L t'],
  ['hellim', 'Hellim', 'peynir', 320, 21, 2, 25, 0, 'dilim:25*', '', 'L t'],
  ['dil-peyniri', 'Dil peyniri', 'peynir', 290, 22, 2, 21.5, 0, 'porsiyon:40*'],
  ['mozzarella', 'Mozzarella', 'peynir', 300, 22.2, 2.2, 22.4, 0, 'dilim:25*', '', 'R w'],
  ['cheddar', 'Cheddar', 'peynir', 403, 24.9, 1.3, 33.1, 0, 'dilim:20*', '', 'R w'],
  ['parmesan', 'Parmesan', 'peynir', 392, 35.8, 3.2, 25.8, 0, 'yk:5*', '', 'R w'],

  // ───────────── YUMURTA ─────────────
  ['haslanmis-yumurta', 'Haşlanmış yumurta', 'yumurta', 155, 12.6, 1.1, 10.6, 0, 'adet:50*', 'yumurta', 'R g'],
  ['yumurta-cig', 'Yumurta (çiğ, bütün)', 'yumurta', 143, 12.6, 0.7, 9.5, 0, 'adet:50*', '', 'R g'],
  ['yumurta-beyazi', 'Yumurta beyazı', 'yumurta', 52, 10.9, 0.7, 0.2, 0, 'adet:33*', '', 'R g'],
  ['sahanda-yumurta', 'Sahanda yumurta (tereyağlı)', 'yumurta', 200, 12, 1, 16.5, 0, 'adet:55*', 'sahanda'],
  ['menemen', 'Menemen', 'yumurta', 95, 5, 5, 6.3, 1.2, 'porsiyon:250*'],
  ['sucuklu-yumurta', 'Sucuklu yumurta', 'yumurta', 260, 15, 2, 21.5, 0, 'porsiyon:150*'],
  ['omlet', 'Omlet (sade)', 'yumurta', 154, 10.6, 0.6, 11.7, 0, 'adet:120*:1 adet (2 yumurta)', '', 'R g'],
  ['peynirli-omlet', 'Peynirli omlet', 'yumurta', 210, 13, 1.2, 17, 0, 'adet:150*:1 adet (2 yumurta)'],
  ['cilbir', 'Çılbır', 'yumurta', 160, 9, 4, 12, 0, 'porsiyon:250*'],
  ['pastirmali-yumurta', 'Pastırmalı yumurta', 'yumurta', 230, 16, 1.5, 18, 0, 'porsiyon:150*'],

  // ───────────── EKMEK ─────────────
  ['beyaz-ekmek', 'Ekmek (beyaz, francala)', 'ekmek', 266, 8.9, 49, 3.3, 2.7, 'dilim:30*|ozel:62:Çeyrek ekmek', 'ekmek, somun', 'R t'],
  ['tam-bugday-ekmek', 'Tam buğday ekmeği', 'ekmek', 254, 12.3, 43, 3.5, 6.0, 'dilim:30*', 'tam buğday', 'R g'],
  ['kepekli-ekmek', 'Kepekli ekmek', 'ekmek', 245, 10, 44, 3.5, 7.0, 'dilim:30*', '', 'E g'],
  ['cavdar-ekmek', 'Çavdar ekmeği', 'ekmek', 259, 8.5, 48, 3.3, 5.8, 'dilim:30*', '', 'R g'],
  ['lavas', 'Lavaş', 'ekmek', 285, 9, 56, 2, 2.2, 'adet:60*', '', 'E- t'],
  ['bazlama', 'Bazlama', 'ekmek', 260, 8, 50, 2.5, 2.0, 'adet:130*'],
  ['ramazan-pidesi', 'Ramazan pidesi', 'ekmek', 270, 9, 52, 2.5, 2.2, 'ozel:75*:Çeyrek pide', 'pide ekmeği'],
  ['simit', 'Simit', 'ekmek', 315, 10, 56, 6, 2.5, 'adet:110*|yarim:55:Yarım simit', 'gevrek'],
  ['tost-ekmegi', 'Tost ekmeği', 'ekmek', 270, 8.5, 50, 3.5, 2.5, 'dilim:25*', '', 'R g'],
  ['misir-ekmegi', 'Mısır ekmeği', 'ekmek', 260, 6, 45, 6, 3.0, 'dilim:60*', '', 'E- t'],
  ['un-beyaz', 'Buğday unu (beyaz)', 'ekmek', 364, 10.3, 76.3, 1.0, 2.7, 'g:100*:100 g|bardak:110:1 su bardağı|yk:10', 'un', 'R g'],
  ['yufka', 'Yufka (pişmemiş)', 'ekmek', 300, 9, 60, 2, 2.0, 'adet:100*:1 yaprak', '', 'E- t'],

  // ───────────── SOKAK LEZZETLERİ ─────────────
  ['cig-kofte', 'Çiğ köfte (etsiz)', 'sokak', 170, 4.5, 31, 3.2, 4.5, 'porsiyon:150*|adet:25', 'çiğköfte'],
  ['cig-kofte-durum', 'Çiğ köfte dürüm', 'sokak', 190, 5.5, 33, 4, 4.0, 'adet:250*'],
  ['kokorec', 'Kokoreç (yarım ekmek)', 'sokak', 280, 15, 14, 18.5, 0.8, 'adet:300*', 'kokoreç', 'E- t'],
  ['midye-dolma', 'Midye dolma', 'sokak', 180, 7, 21, 7.5, 0.6, 'adet:25*:1 adet|adet:250:10 adet'],
  ['tantuni', 'Tantuni dürüm', 'sokak', 210, 13, 20, 8.5, 1.5, 'adet:250*'],
  ['tavuk-doner-durum', 'Tavuk döner dürüm', 'sokak', 215, 12, 24, 8, 1.2, 'adet:300*', 'tavuk dürüm'],
  ['et-doner-durum', 'Et döner dürüm', 'sokak', 235, 13, 23, 10.5, 1.2, 'adet:300*', 'et dürüm'],
  ['doner-ekmek', 'Tavuk döner (yarım ekmek)', 'sokak', 220, 11, 27, 7.5, 1.4, 'adet:300*', 'döner ekmek arası'],
  ['balik-ekmek', 'Balık ekmek', 'sokak', 230, 12, 24, 9.5, 1.4, 'adet:300*'],
  ['islak-hamburger', 'Islak hamburger', 'sokak', 280, 10, 30, 13, 1.2, 'adet:120*'],
  ['kumpir', 'Kumpir', 'sokak', 175, 5, 20, 8.5, 2.0, 'adet:500*', '', 'E- t'],
  ['kasarli-tost', 'Kaşarlı tost', 'sokak', 300, 13, 30, 14, 1.5, 'adet:150*', 'tost'],
  ['karisik-tost', 'Karışık tost', 'sokak', 290, 14, 28, 14, 1.4, 'adet:170*', '', 'E t v=kasarli-tost:Karışık'],
  ['misir-haslama', 'Haşlanmış mısır', 'sokak', 96, 3.4, 21, 1.5, 2.4, 'adet:150*:1 koçan (yenilebilir)', 'mısır', 'R g'],
  ['patso', 'Patso', 'sokak', 220, 8, 25, 10, 2.0, 'adet:200*'],
  ['kumru', 'Kumru', 'sokak', 250, 13, 25, 11, 1.2, 'adet:220*'],
  ['sucuk-ekmek', 'Sucuk ekmek', 'sokak', 300, 13, 26, 16, 1.2, 'adet:200*'],
  ['kestane-kebap', 'Kestane kebap', 'sokak', 245, 3.2, 53, 2.2, 5.1, 'adet:80*:10 adet|adet:8:1 adet', 'kestane', 'R t'],

  // ───────────── PİDE, LAHMACUN, PİZZA ─────────────
  ['lahmacun', 'Lahmacun', 'pide', 235, 11, 32, 7, 2.2, 'adet:130*'],
  ['kiymali-pide', 'Kıymalı pide', 'pide', 250, 11, 30, 9, 1.6, 'adet:300*:1 pide|dilim:50', 'pide'],
  ['kasarli-pide', 'Kaşarlı pide', 'pide', 285, 12, 31, 12.5, 1.4, 'adet:300*:1 pide|dilim:50'],
  ['kusbasili-pide', 'Kuşbaşılı pide', 'pide', 245, 12, 29, 9, 1.5, 'adet:320*:1 pide|dilim:55'],
  ['karisik-pide', 'Karışık pide', 'pide', 265, 12, 29, 11, 1.4, 'adet:320*:1 pide|dilim:55'],
  ['karadeniz-pidesi', 'Karadeniz pidesi (tereyağlı, yumurtalı)', 'pide', 300, 11, 30, 15, 1.2, 'adet:300*:1 pide'],
  ['etli-ekmek', 'Etli ekmek (Konya)', 'pide', 230, 12, 28, 8, 1.6, 'adet:300*'],
  ['pizza-margarita', 'Pizza (margarita)', 'pide', 266, 11.4, 33, 9.7, 2.3, 'dilim:100*', 'pizza', 'R w'],
  ['pizza-karisik', 'Pizza (karışık)', 'pide', 270, 12, 30, 11.5, 2.0, 'dilim:110*', 'karışık pizza', 'E w'],

  // ───────────── FAST FOOD ─────────────
  ['hamburger', 'Hamburger', 'fastfood', 255, 13, 30, 9.5, 1.5, 'adet:110*', '', 'E w'],
  ['cheeseburger', 'Cheeseburger', 'fastfood', 265, 14, 28, 11.5, 1.5, 'adet:120*', '', 'E w'],
  ['buyuk-burger', 'Büyük burger (çift köfteli)', 'fastfood', 250, 13, 20, 13.5, 1.5, 'adet:220*', 'big burger', 'E w'],
  ['tavuk-burger', 'Tavuk burger', 'fastfood', 250, 12, 27, 10.5, 1.5, 'adet:150*', '', 'E w'],
  ['patates-kizartmasi', 'Patates kızartması', 'fastfood', 312, 3.4, 41, 15, 3.8, 'porsiyon:115*:Orta boy|porsiyon:150:Büyük boy', 'patates', 'R g'],
  ['nugget', 'Tavuk nugget', 'fastfood', 296, 15.4, 16, 19.6, 1.0, 'adet:17*', 'nugget', 'R w'],
  ['sosisli', 'Sosisli sandviç', 'fastfood', 270, 10, 25, 14.5, 1.0, 'adet:120*', 'hot dog', 'E w'],
  ['tavuk-wrap', 'Tavuk wrap', 'fastfood', 220, 12, 23, 9, 1.5, 'adet:220*', 'wrap', 'E w'],
  ['sogan-halkasi', 'Soğan halkası', 'fastfood', 400, 5, 40, 24, 2.4, 'porsiyon:90*', '', 'E w'],
  ['kizarmis-kanat', 'Kızarmış tavuk kanat (acılı)', 'fastfood', 290, 22, 8, 19, 0.3, 'adet:35*', 'hot wings', 'E w'],

  // ───────────── SALATALAR ─────────────
  ['coban-salata', 'Çoban salata', 'salata', 50, 1, 4, 3.5, 1.3, 'porsiyon:200*'],
  ['mevsim-salata', 'Mevsim salata (zeytinyağlı)', 'salata', 55, 1.2, 4, 4, 1.8, 'porsiyon:200*'],
  ['kisir', 'Kısır', 'salata', 170, 3.5, 25, 6.5, 4.0, 'porsiyon:150*', 'bulgur salatası'],
  ['piyaz', 'Piyaz', 'salata', 140, 6, 15, 6.5, 5.0, 'porsiyon:200*'],
  ['gavurdagi', 'Gavurdağı salatası', 'salata', 120, 2.5, 6, 10, 2.2, 'porsiyon:200*'],
  ['patates-salatasi', 'Patates salatası', 'salata', 120, 2, 16, 5.5, 2.0, 'porsiyon:200*'],
  ['roka-salatasi', 'Roka salatası', 'salata', 60, 2, 3.5, 4.5, 1.6, 'porsiyon:150*'],
  ['sezar-salata', 'Sezar salata', 'salata', 150, 7, 7, 10.5, 1.5, 'porsiyon:250*', '', 'E w'],
  ['ton-salata', 'Ton balıklı salata', 'salata', 120, 9, 5, 7, 1.8, 'porsiyon:250*', '', 'E g'],
  ['tavuklu-salata', 'Tavuklu salata', 'salata', 110, 10, 4, 6, 1.4, 'porsiyon:250*', '', 'E g'],
  ['yesil-salata', 'Yeşil salata (sossuz)', 'salata', 17, 1.2, 3, 0.2, 1.5, 'porsiyon:150*', 'marul salatası', 'R g'],
  ['mercimek-salatasi', 'Yeşil mercimek salatası', 'salata', 125, 6.5, 15, 4.5, 4.5, 'porsiyon:200*'],

  // ───────────── MEZELER ─────────────
  ['cacik', 'Cacık', 'meze', 45, 2.5, 3.5, 2.2, 0.4, 'kase:200*'],
  ['haydari', 'Haydari', 'meze', 150, 6, 4, 12, 0.3, 'porsiyon:50*|yk:30'],
  ['humus', 'Humus', 'meze', 166, 7.9, 14.3, 9.6, 6.0, 'porsiyon:50*|yk:15', 'humus', 'R t'],
  ['acili-ezme', 'Acılı ezme', 'meze', 75, 1.5, 7, 4.8, 1.8, 'porsiyon:50*', 'ezme'],
  ['muhammara', 'Muhammara', 'meze', 330, 6, 20, 26, 4.0, 'porsiyon:50*', 'cevizli biber'],
  ['babagannus', 'Babagannuş / mutabbel', 'meze', 120, 1.8, 7, 9.5, 3.0, 'porsiyon:50*', 'baba ganuş, mutabbel'],
  ['fava', 'Fava', 'meze', 140, 7, 17, 5, 5.0, 'dilim:70*'],
  ['patlican-salatasi', 'Közlenmiş patlıcan salatası', 'meze', 85, 1.2, 7, 6, 3.0, 'porsiyon:100*'],
  ['mercimek-koftesi', 'Mercimek köftesi', 'meze', 160, 6, 27, 3.5, 4.0, 'adet:25*|porsiyon:125:5 adet'],
  ['semizotu-yogurtlu', 'Yoğurtlu semizotu', 'meze', 75, 3, 4, 5, 1.0, 'porsiyon:100*'],
  ['deniz-borulcesi', 'Deniz börülcesi', 'meze', 60, 1.5, 6, 3.5, 2.0, 'porsiyon:100*'],
  ['saksuka', 'Şakşuka', 'meze', 110, 1.5, 8, 8.5, 2.3, 'porsiyon:100*'],
  ['tarama', 'Tarama', 'meze', 450, 5, 8, 45, 0.3, 'yk:20*', '', 'E- t'],
  ['tursu', 'Turşu (karışık)', 'meze', 15, 0.6, 2.5, 0.2, 1.2, 'porsiyon:50*'],
  ['koz-biber', 'Közlenmiş biber (zeytinyağlı)', 'meze', 60, 1, 6, 3.5, 1.5, 'porsiyon:80*'],
  ['atom', 'Atom (yoğurtlu acı biber)', 'meze', 140, 4, 6, 11, 1.0, 'porsiyon:50*', '', 'E- t'],

  // ───────────── ÇEREZ VE KURUYEMİŞ ─────────────
  ['findik', 'Fındık', 'cerez', 628, 15, 16.7, 60.8, 9.7, 'avuc:30*|adet:1.5:1 adet', '', 'R t'],
  ['antep-fistigi', 'Antep fıstığı (iç)', 'cerez', 560, 20.2, 27.2, 45.3, 10.6, 'avuc:30*', 'fıstık', 'R t'],
  ['badem', 'Badem', 'cerez', 579, 21.2, 21.6, 49.9, 12.5, 'avuc:30*|adet:1.2:1 adet', '', 'R g'],
  ['ceviz', 'Ceviz içi', 'cerez', 654, 15.2, 13.7, 65.2, 6.7, 'avuc:30*|adet:5:1 bütün ceviz içi', 'ceviz', 'R t'],
  ['kaju', 'Kaju', 'cerez', 553, 18.2, 30.2, 43.8, 3.3, 'avuc:30*', '', 'R g'],
  ['yer-fistigi', 'Yer fıstığı (kavrulmuş)', 'cerez', 585, 24, 21.5, 49.5, 8.0, 'avuc:30*', 'tuzlu fıstık', 'R g'],
  ['leblebi', 'Leblebi (sarı)', 'cerez', 370, 19, 57, 6, 12, 'avuc:30*', 'leblebi', 'E t'],
  ['ay-cekirdegi', 'Ay çekirdeği içi (kavrulmuş)', 'cerez', 582, 19.3, 24, 49.8, 11.1, 'avuc:30*', 'çekirdek', 'R t'],
  ['kabak-cekirdegi', 'Kabak çekirdeği içi (kavrulmuş)', 'cerez', 574, 29.8, 14.7, 49, 6.5, 'avuc:30*', '', 'R t'],
  ['kuru-uzum', 'Kuru üzüm', 'cerez', 299, 3.1, 79.2, 0.5, 3.7, 'avuc:30*', '', 'R t s59'],
  ['kuru-kayisi', 'Kuru kayısı', 'cerez', 241, 3.4, 62.6, 0.5, 7.3, 'adet:8*|avuc:40', 'gün kurusu', 'R t s53'],
  ['kuru-incir', 'Kuru incir', 'cerez', 249, 3.3, 63.9, 0.9, 9.8, 'adet:20*', '', 'R t s48'],
  ['hurma', 'Hurma (medjool)', 'cerez', 277, 1.8, 75, 0.2, 6.7, 'adet:24*', 'hurma', 'R g s66'],
  ['karisik-kuruyemis', 'Karışık kuruyemiş', 'cerez', 600, 18, 22, 52, 7.0, 'avuc:30*', 'çerez', 'E g'],
  ['patlamis-misir', 'Patlamış mısır (yağlı)', 'cerez', 500, 9, 57, 28, 10, 'kase:25*', 'popcorn', 'E g'],

  // ───────────── MEYVELER ─────────────
  ['elma', 'Elma', 'meyve', 52, 0.3, 13.8, 0.2, 2.4, 'adet:180*', '', 'R g s10.4'],
  ['armut', 'Armut', 'meyve', 57, 0.4, 15.2, 0.1, 3.1, 'adet:180*', '', 'R g s9.8'],
  ['muz', 'Muz', 'meyve', 89, 1.1, 22.8, 0.3, 2.6, 'adet:120*', '', 'R g s12.2'],
  ['portakal', 'Portakal', 'meyve', 47, 0.9, 11.8, 0.1, 2.4, 'adet:150*', '', 'R g s9.4'],
  ['mandalina', 'Mandalina', 'meyve', 53, 0.8, 13.3, 0.3, 1.8, 'adet:75*', '', 'R g s10.6'],
  ['greyfurt', 'Greyfurt', 'meyve', 42, 0.8, 10.7, 0.1, 1.6, 'yarim:120*:Yarım greyfurt', '', 'R g s6.9'],
  ['karpuz', 'Karpuz', 'meyve', 30, 0.6, 7.6, 0.2, 0.4, 'dilim:300*', '', 'R g s6.2'],
  ['kavun', 'Kavun', 'meyve', 34, 0.8, 8.2, 0.2, 0.9, 'dilim:250*', '', 'R g s7.9'],
  ['uzum', 'Üzüm', 'meyve', 69, 0.7, 18.1, 0.2, 0.9, 'kase:150*', '', 'R g s15.5'],
  ['cilek', 'Çilek', 'meyve', 32, 0.7, 7.7, 0.3, 2.0, 'kase:150*|adet:12', '', 'R g s4.9'],
  ['kiraz', 'Kiraz', 'meyve', 63, 1.1, 16, 0.2, 2.1, 'kase:140*', '', 'R g s12.8'],
  ['visne', 'Vişne', 'meyve', 50, 1, 12.2, 0.3, 1.6, 'kase:140*', '', 'R g s8.5'],
  ['seftali', 'Şeftali', 'meyve', 39, 0.9, 9.5, 0.3, 1.5, 'adet:150*', '', 'R g s8.4'],
  ['kayisi', 'Kayısı (taze)', 'meyve', 48, 1.4, 11.1, 0.4, 2.0, 'adet:35*', '', 'R g s9.2'],
  ['erik', 'Erik', 'meyve', 46, 0.7, 11.4, 0.3, 1.4, 'adet:30*', 'can erik', 'R g s9.9'],
  ['incir', 'İncir (taze)', 'meyve', 74, 0.8, 19.2, 0.3, 2.9, 'adet:50*', '', 'R g s16.3'],
  ['nar', 'Nar', 'meyve', 83, 1.7, 18.7, 1.2, 4.0, 'kase:170*:1 kase tane', '', 'R g s13.7'],
  ['kivi', 'Kivi', 'meyve', 61, 1.1, 14.7, 0.5, 3.0, 'adet:75*', '', 'R g s9'],
  ['ananas', 'Ananas', 'meyve', 50, 0.5, 13.1, 0.1, 1.4, 'dilim:85*', '', 'R g s9.9'],
  ['avokado', 'Avokado', 'meyve', 160, 2, 8.5, 14.7, 6.7, 'yarim:70*:Yarım avokado', '', 'R g s0.7'],
  ['ayva', 'Ayva', 'meyve', 57, 0.4, 15.3, 0.1, 1.9, 'adet:200*', '', 'R g'],
  ['dut', 'Dut', 'meyve', 43, 1.4, 9.8, 0.4, 1.7, 'kase:140*', '', 'R g s8.1'],
  ['mango', 'Mango', 'meyve', 60, 0.8, 15, 0.4, 1.6, 'adet:200*', '', 'R g s13.7'],
  ['trabzon-hurmasi', 'Trabzon hurması', 'meyve', 70, 0.6, 18.6, 0.2, 3.6, 'adet:170*', 'cennet hurması', 'R g s12.5'],
  ['yaban-mersini', 'Yaban mersini', 'meyve', 57, 0.7, 14.5, 0.3, 2.4, 'kase:150*', 'blueberry', 'R g s10'],

  // ───────────── SEBZELER ─────────────
  ['domates', 'Domates', 'sebze', 18, 0.9, 3.9, 0.2, 1.2, 'adet:120*', '', 'R g s2.6'],
  ['salatalik', 'Salatalık', 'sebze', 15, 0.7, 3.6, 0.1, 0.5, 'adet:150*', 'hıyar', 'R g s1.7'],
  ['sivri-biber', 'Yeşil biber (sivri/çarliston)', 'sebze', 20, 0.9, 4.6, 0.2, 1.7, 'adet:20*', 'biber', 'R g'],
  ['kapya-biber', 'Kırmızı biber (kapya)', 'sebze', 31, 1, 6, 0.3, 2.1, 'adet:150*', 'kapya', 'R g'],
  ['marul', 'Marul', 'sebze', 15, 1.4, 2.9, 0.2, 1.3, 'kase:50*', '', 'R g'],
  ['havuc', 'Havuç', 'sebze', 41, 0.9, 9.6, 0.2, 2.8, 'adet:70*', '', 'R g s4.7'],
  ['sogan', 'Kuru soğan', 'sebze', 40, 1.1, 9.3, 0.1, 1.7, 'adet:110*', 'soğan', 'R g s4.2'],
  ['patates-haslanmis', 'Patates (haşlanmış)', 'sebze', 86, 1.7, 20, 0.1, 1.8, 'adet:150*', 'haşlanmış patates', 'R g'],
  ['patates-cig', 'Patates (çiğ)', 'sebze', 77, 2.1, 17.5, 0.1, 2.1, 'adet:170*', '', 'R g'],
  ['patlican', 'Patlıcan (çiğ)', 'sebze', 25, 1, 5.9, 0.2, 3.0, 'adet:250*', '', 'R g'],
  ['kabak', 'Kabak (çiğ)', 'sebze', 17, 1.2, 3.1, 0.3, 1.0, 'adet:200*', '', 'R g'],
  ['brokoli', 'Brokoli (haşlanmış)', 'sebze', 35, 2.4, 7.2, 0.4, 3.3, 'kase:150*', '', 'R g'],
  ['ispanak', 'Ispanak (çiğ)', 'sebze', 23, 2.9, 3.6, 0.4, 2.2, 'kase:30*', '', 'R g'],
  ['karnabahar', 'Karnabahar (çiğ)', 'sebze', 25, 1.9, 5, 0.3, 2.0, 'kase:100*', '', 'R g'],
  ['mantar', 'Mantar (kültür, çiğ)', 'sebze', 22, 3.1, 3.3, 0.3, 1.0, 'kase:70*', '', 'R g'],
  ['roka', 'Roka', 'sebze', 25, 2.6, 3.7, 0.7, 1.6, 'kase:20*', '', 'R g'],
  ['maydanoz', 'Maydanoz', 'sebze', 36, 3, 6.3, 0.8, 3.3, 'yk:4*:1 yemek kaşığı (kıyılmış)|ozel:60:1 demet', '', 'R g'],
  ['taze-fasulye', 'Taze fasulye (çiğ)', 'sebze', 31, 1.8, 7, 0.2, 2.7, 'kase:110*', '', 'R g'],
  ['bezelye', 'Bezelye (haşlanmış)', 'sebze', 84, 5.4, 15.6, 0.2, 5.5, 'kase:160*', '', 'R g'],
  ['sarimsak', 'Sarımsak', 'sebze', 149, 6.4, 33.1, 0.5, 2.1, 'ozel:3*:1 diş', '', 'R g'],
  ['pirasa', 'Pırasa (çiğ)', 'sebze', 61, 1.5, 14.2, 0.3, 1.8, 'adet:90*', '', 'R g'],
  ['lahana', 'Lahana (çiğ)', 'sebze', 25, 1.3, 5.8, 0.1, 2.5, 'kase:90*', '', 'R g'],
  ['pancar', 'Kırmızı pancar', 'sebze', 43, 1.6, 9.6, 0.2, 2.8, 'adet:80*', '', 'R g'],
  ['turp', 'Turp', 'sebze', 16, 0.7, 3.4, 0.1, 1.6, 'adet:30*', '', 'R g'],

  // ───────────── SÜT ÜRÜNLERİ ─────────────
  ['yogurt', 'Yoğurt (tam yağlı)', 'sut', 61, 3.5, 4.7, 3.3, 0, 'kase:200*|yk:30', 'yoğurt', 'R t s4.7'],
  ['yogurt-yarim', 'Yoğurt (yarım yağlı)', 'sut', 50, 3.8, 5, 1.5, 0, 'kase:200*', '', 'L t s5'],
  ['suzme-yogurt', 'Süzme yoğurt (tam yağlı)', 'sut', 120, 7, 4, 8.5, 0, 'kase:150*|yk:30', 'süzme', 'L t s4'],
  ['krema', 'Krema (sıvı, %35)', 'sut', 340, 2.8, 2.7, 36.1, 0, 'yk:15*', '', 'R g'],
  ['puding', 'Puding (sütlü, kakaolu)', 'sut', 120, 3, 20, 3, 0.5, 'kase:150*', '', 'E g'],

  // ───────────── TATLILAR ─────────────
  ['baklava', 'Baklava (fıstıklı)', 'tatli', 430, 7, 45, 25, 2.0, 'dilim:35*:1 dilim/adet', 'baklava'],
  ['cevizli-baklava', 'Baklava (cevizli)', 'tatli', 440, 6.5, 44, 27, 2.0, 'dilim:35*:1 dilim/adet', '', 'E t v=baklava:Cevizli'],
  ['kunefe', 'Künefe', 'tatli', 330, 7.5, 40, 16, 0.6, 'porsiyon:180*'],
  ['sutlac', 'Sütlaç', 'tatli', 125, 3.4, 21, 3, 0.1, 'kase:200*', 'sütlaç'],
  ['firin-sutlac', 'Fırın sütlaç', 'tatli', 135, 3.6, 22, 3.5, 0.1, 'kase:200*', '', 'E t v=sutlac:Fırın'],
  ['kazandibi', 'Kazandibi', 'tatli', 150, 4, 25, 4, 0.2, 'porsiyon:150*'],
  ['tavuk-gogsu-tatli', 'Tavuk göğsü (tatlı)', 'tatli', 140, 5, 22, 3.5, 0, 'porsiyon:150*'],
  ['muhallebi', 'Muhallebi', 'tatli', 120, 3.5, 20, 3, 0, 'kase:200*'],
  ['revani', 'Revani', 'tatli', 320, 5, 55, 9, 0.8, 'dilim:100*'],
  ['sekerpare', 'Şekerpare', 'tatli', 400, 5, 55, 18, 0.8, 'adet:30*'],
  ['tulumba', 'Tulumba', 'tatli', 350, 3, 50, 15.5, 0.6, 'adet:25*'],
  ['lokma', 'Lokma', 'tatli', 330, 3.5, 48, 14, 0.6, 'adet:15*'],
  ['lokum', 'Lokum', 'tatli', 360, 0.2, 90, 0.2, 0.2, 'adet:15*', 'türk lokumu', 'E t s75'],
  ['asure', 'Aşure', 'tatli', 150, 3, 30, 2.5, 2.5, 'kase:200*'],
  ['kadayif', 'Tel kadayıf', 'tatli', 380, 5.5, 50, 18, 1.2, 'porsiyon:100*', 'kadayıf'],
  ['ekmek-kadayifi', 'Ekmek kadayıfı (kaymaklı)', 'tatli', 340, 5, 50, 13.5, 0.5, 'porsiyon:120*'],
  ['irmik-helvasi', 'İrmik helvası', 'tatli', 330, 4, 45, 15, 1.0, 'porsiyon:100*'],
  ['tahin-helvasi', 'Tahin helvası', 'tatli', 515, 12.5, 55, 28, 4.5, 'dilim:40*', 'helva'],
  ['un-helvasi', 'Un helvası', 'tatli', 420, 5, 52, 21, 1.2, 'porsiyon:80*'],
  ['kemalpasa', 'Kemalpaşa tatlısı', 'tatli', 300, 6, 55, 6, 0.5, 'adet:25*'],
  ['gullac', 'Güllaç', 'tatli', 140, 4, 27, 2, 0.2, 'dilim:150*'],
  ['trilece', 'Trileçe', 'tatli', 220, 5, 32, 8, 0.2, 'dilim:150*'],
  ['katmer', 'Katmer (fıstıklı)', 'tatli', 450, 9, 45, 27, 1.8, 'porsiyon:150*', '', 'E- t'],
  ['dondurma', 'Dondurma (sade)', 'tatli', 207, 3.5, 23.6, 11, 0.7, 'ozel:50*:1 top|kase:130', 'dondurma', 'R g'],
  ['maras-dondurmasi', 'Maraş dondurması', 'tatli', 220, 4, 27, 11, 0.3, 'ozel:60*:1 top', '', 'E- t'],
  ['ayva-tatlisi', 'Ayva tatlısı', 'tatli', 180, 0.5, 42, 2, 2.0, 'adet:200*:Yarım ayva'],
  ['kabak-tatlisi', 'Kabak tatlısı', 'tatli', 150, 0.7, 36, 0.5, 1.5, 'porsiyon:150*'],
  ['profiterol', 'Profiterol', 'tatli', 260, 5, 30, 13.5, 1.0, 'porsiyon:150*', '', 'E w'],
  ['supangle', 'Supangle', 'tatli', 140, 3.5, 22, 4.5, 1.0, 'kase:200*'],
  ['kek', 'Kek (ev yapımı, sade)', 'tatli', 370, 6, 52, 15.5, 0.8, 'dilim:60*'],
  ['kurabiye', 'Kurabiye (un kurabiyesi)', 'tatli', 480, 6, 60, 24, 1.5, 'adet:20*'],
  ['yas-pasta', 'Yaş pasta', 'tatli', 300, 4.5, 38, 14.5, 0.8, 'dilim:120*', 'pasta'],
  ['cheesecake', 'Cheesecake', 'tatli', 321, 5.5, 25.5, 22.5, 0.4, 'dilim:120*', '', 'R w'],
  ['pismaniye', 'Pişmaniye', 'tatli', 470, 4.5, 72, 18, 0.5, 'porsiyon:30*', '', 'E- t'],

  // ───────────── DÜNYA MUTFAĞI ─────────────
  ['sushi', 'Suşi (California roll)', 'dunya', 145, 3.5, 22, 4.5, 1.0, 'adet:30*', 'sushi', 'E w'],
  ['lazanya', 'Lazanya (etli)', 'dunya', 140, 8, 13, 6, 1.0, 'porsiyon:300*', '', 'E w'],
  ['risotto', 'Risotto (mantarlı)', 'dunya', 140, 3.5, 20, 5, 0.5, 'porsiyon:250*', '', 'E w'],
  ['noodle', 'Sebzeli noodle (kızarmış)', 'dunya', 160, 4.5, 22, 6, 1.5, 'porsiyon:300*', 'noodle', 'E w'],
  ['tavuk-curry', 'Tavuk köri (pilavsız)', 'dunya', 130, 11, 6, 7, 1.2, 'porsiyon:250*', 'curry', 'E w'],
  ['falafel', 'Falafel', 'dunya', 333, 13.3, 31.8, 17.8, 4.9, 'adet:17*', '', 'R w'],
  ['burrito', 'Burrito', 'dunya', 210, 8.5, 26, 8, 3.0, 'adet:250*', '', 'E w'],
  ['taco', 'Taco', 'dunya', 220, 9, 20, 11.5, 2.5, 'adet:90*', '', 'E w'],
  ['quesadilla', 'Quesadilla', 'dunya', 290, 13, 26, 15, 1.5, 'adet:180*', '', 'E w'],
  ['pad-thai', 'Pad thai', 'dunya', 170, 7, 22, 6.5, 1.2, 'porsiyon:300*', '', 'E w'],
  ['pankek', 'Pankek', 'dunya', 227, 6.4, 28.3, 9.7, 1.0, 'adet:40*', 'pancake', 'R w'],
  ['krep', 'Krep (sade)', 'dunya', 225, 6.5, 28, 9.5, 0.8, 'adet:50*', 'krep', 'E w'],
  ['waffle', 'Waffle (sade)', 'dunya', 291, 7.9, 32.9, 14.1, 1.0, 'adet:75*', '', 'R w'],
  ['kruvasan', 'Kruvasan', 'dunya', 406, 8.2, 45.8, 21, 2.6, 'adet:60*', 'croissant', 'R w'],
  ['teriyaki-tavuk', 'Teriyaki tavuk (pilavlı)', 'dunya', 150, 9.5, 20, 3.5, 0.8, 'porsiyon:350*', '', 'E w'],
  ['hindi-sandvic', 'Hindi füme sandviç', 'dunya', 230, 12, 28, 7.5, 2.0, 'adet:180*', 'sandviç', 'E w'],

  // ───────────── PAKETLİ ÜRÜNLER ─────────────
  ['cips', 'Patates cipsi', 'paketli', 536, 6.6, 53, 34, 4.4, 'paket:40*:Küçük paket (40 g)|paket:107:Büyük paket', 'cips', 'L g'],
  ['misir-cipsi', 'Mısır cipsi (tortilla)', 'paketli', 500, 7, 63, 24, 5.0, 'paket:40*', '', 'L g'],
  ['petibor', 'Bisküvi (petibör tipi)', 'paketli', 440, 7, 74, 13, 2.5, 'adet:6*', 'bisküvi', 'L g'],
  ['kremali-biskuvi', 'Kremalı çikolatalı bisküvi', 'paketli', 480, 5.5, 69, 20, 2.5, 'adet:12*', '', 'L g'],
  ['gofret', 'Çikolatalı gofret', 'paketli', 530, 6, 60, 29, 2.0, 'adet:35*', 'gofret', 'L g'],
  ['kraker', 'Tuzlu kraker', 'paketli', 460, 9, 68, 16, 3.0, 'paket:40*', 'kraker', 'L g'],
  ['protein-bar', 'Protein bar', 'paketli', 360, 30, 35, 12, 6.0, 'adet:50*', '', 'L g'],
  ['granola', 'Granola', 'paketli', 470, 10, 64, 20, 6.0, 'kase:50*', '', 'L g'],
  ['misir-gevregi', 'Mısır gevreği', 'paketli', 357, 7.5, 84, 0.4, 3.3, 'kase:30*', 'corn flakes', 'R g'],
  ['findik-kremasi', 'Kakaolu fındık kreması', 'paketli', 540, 6, 57, 31, 3.4, 'yk:20*|tk:8', 'nutella', 'L g s56'],
  ['sutlu-cikolata', 'Sütlü çikolata', 'paketli', 535, 7.7, 59.4, 29.7, 3.4, 'ozel:5*:1 kare|ozel:80:1 tablet', 'çikolata', 'R g s51.5'],
  ['bitter-cikolata', 'Bitter çikolata (%70–85)', 'paketli', 598, 7.8, 45.9, 42.6, 10.9, 'ozel:5*:1 kare|ozel:80:1 tablet', 'bitter', 'R g s24'],
  ['paket-kek', 'Paketli kek', 'paketli', 420, 5, 55, 20, 1.0, 'adet:40*', '', 'L g'],
  ['tavuk-sosis', 'Piliç sosis', 'paketli', 230, 12, 4, 18.5, 0, 'adet:40*', 'sosis', 'L g'],
  ['salam', 'Salam (dana)', 'paketli', 300, 13, 2, 27, 0, 'dilim:10*', '', 'L g'],
  ['hindi-fume', 'Hindi füme (dilim)', 'paketli', 105, 17, 3, 2.5, 0, 'dilim:10*', '', 'L g'],

  // ───────────── SOSLAR, YAĞLAR, ŞEKER ─────────────
  ['zeytinyagi', 'Zeytinyağı', 'sos_yag', 884, 0, 0, 100, 0, 'yk:13.5*|tk:4.5', 'yağ', 'R t s0'],
  ['aycicek-yagi', 'Ayçiçek yağı', 'sos_yag', 884, 0, 0, 100, 0, 'yk:13.5*|tk:4.5', 'sıvı yağ', 'R g s0'],
  ['tereyagi', 'Tereyağı', 'sos_yag', 717, 0.9, 0.1, 81, 0, 'tk:5*|yk:13', '', 'R t s0.1'],
  ['margarin', 'Margarin', 'sos_yag', 717, 0.2, 0.7, 80.7, 0, 'tk:5*', '', 'R g'],
  ['mayonez', 'Mayonez', 'sos_yag', 680, 1, 0.6, 74.9, 0, 'yk:14*', '', 'R g'],
  ['ketcap', 'Ketçap', 'sos_yag', 101, 1, 27.4, 0.1, 0.3, 'yk:17*', '', 'R g s21'],
  ['hardal', 'Hardal', 'sos_yag', 60, 3.7, 5.8, 3.3, 4.0, 'tk:5*', '', 'R g'],
  ['domates-salcasi', 'Domates salçası', 'sos_yag', 82, 4.3, 18.9, 0.5, 4.1, 'yk:16*', 'salça', 'R t'],
  ['biber-salcasi', 'Biber salçası', 'sos_yag', 85, 3, 15, 1.5, 4.0, 'yk:16*', '', 'E- t'],
  ['nar-eksisi', 'Nar ekşisi', 'sos_yag', 270, 0.5, 67, 0, 0.5, 'yk:15*', '', 'E- t'],
  ['soya-sosu', 'Soya sosu', 'sos_yag', 53, 8.1, 4.9, 0.6, 0.8, 'yk:16*', '', 'R w'],
  ['barbeku-sos', 'Barbekü sos', 'sos_yag', 172, 0.8, 40.8, 0.6, 0.9, 'yk:17*', '', 'R w'],
  ['limon-suyu', 'Limon suyu', 'sos_yag', 22, 0.4, 6.9, 0.2, 0.3, 'yk:15*', '', 'R g'],
  ['seker', 'Toz şeker', 'sos_yag', 387, 0, 100, 0, 0, 'tk:5*:1 tatlı kaşığı|ozel:5:1 küp|yk:12', 'şeker, küp şeker', 'R g s100'],
];

const CUISINE_FLAG: Record<string, Cuisine> = { t: 'tr', w: 'world', g: 'generic' };
const DEFAULT_CUISINE: Record<string, Cuisine> = { meyve: 'generic', sebze: 'generic', cerez: 'generic', paketli: 'generic', sos_yag: 'generic', dunya: 'world', fastfood: 'world' };

function parseServings(spec: string): FoodServing[] {
  return spec.split('|').map((part, i) => {
    const [unitRaw, amountRaw, label] = part.split(':');
    const unit = unitRaw as ServingUnit;
    const isDefault = amountRaw.endsWith('*');
    const amount = Number(amountRaw.replace('*', ''));
    return {
      id: `${unit}-${i}`,
      unit,
      amount,
      label: label ?? `1 ${UNIT_LABEL[unit] ?? unit}`,
      ...(isDefault ? { isDefault: true } : {}),
    };
  });
}

function parseFlags(flags: string | undefined, cat: string): { source: DataSource; confidence: Confidence; cuisine: Cuisine; sugar: number | null; variantOf?: string; variantLabel?: string } {
  let source: DataSource = 'recipe-estimate';
  let confidence: Confidence = 'medium';
  let cuisine: Cuisine = DEFAULT_CUISINE[cat] ?? 'tr';
  let sugar: number | null = null;
  let variantOf: string | undefined;
  let variantLabel: string | undefined;
  const rest = flags ?? '';
  const vIdx = rest.indexOf('v=');
  const head = vIdx >= 0 ? rest.slice(0, vIdx) : rest;
  if (vIdx >= 0) {
    const [id, lbl] = rest.slice(vIdx + 2).split(':');
    variantOf = id;
    variantLabel = lbl;
  }
  for (const tok of head.split(/\s+/).filter(Boolean)) {
    if (tok === 'R') [source, confidence] = ['reference', 'high'];
    else if (tok === 'E') [source, confidence] = ['recipe-estimate', 'medium'];
    else if (tok === 'E-') [source, confidence] = ['recipe-estimate', 'low'];
    else if (tok === 'L') [source, confidence] = ['label-typical', 'medium'];
    else if (CUISINE_FLAG[tok]) cuisine = CUISINE_FLAG[tok];
    else if (tok.startsWith('s')) sugar = Number(tok.slice(1));
  }
  return { source, confidence, cuisine, sugar, variantOf, variantLabel };
}

const SOURCE_NOTE: Record<string, string> = {
  reference: 'USDA FoodData Central (SR Legacy) referans değerleriyle uyumlu, yuvarlanmış değer.',
  'recipe-estimate': 'Yaygın tarif üzerinden malzeme bazlı tahmin; tarif, yağ ve porsiyona göre değişir.',
  'label-typical': 'Piyasadaki ürünlerin tipik etiket değeri; marka için barkod araması önerilir.',
};

export const BUILTIN_FOODS: Food[] = ROWS.map(([id, name, cat, kcal, protein, carb, fat, fiber, servings, aliases, flags]) => {
  const f = parseFlags(flags, cat);
  return {
    id: `tr:${id}`,
    name,
    aliases: (aliases ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    categoryId: cat,
    cuisine: f.cuisine,
    basis: 'g',
    per100: { kcal, protein, carb, fat, fiber, sugar: f.sugar },
    servings: parseServings(servings),
    source: f.source,
    sourceNote: SOURCE_NOTE[f.source],
    confidence: f.confidence,
    ...(f.variantOf ? { variantOf: `tr:${f.variantOf}`, variantLabel: f.variantLabel } : {}),
    isUser: false,
    createdAt: 0,
    updatedAt: 0,
  };
});

export const BUILTIN_FOOD_MAP = new Map(BUILTIN_FOODS.map((f) => [f.id, f]));
