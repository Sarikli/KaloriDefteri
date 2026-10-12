# Veri kaynakları, lisanslar ve doğruluk

Her yemek ve içecek kaydı `source`, `sourceNote` ve `confidence` alanlarını taşır; uygulama bunları
porsiyon ekranında gösterir.

| Kaynak kodu | Anlamı | Güvenilirlik |
|---|---|---|
| `reference` | Tek bileşenli gıda (meyve, sebze, et, tahıl, yağ…). USDA FoodData Central SR Legacy referans değerleriyle uyumlu, yuvarlanmış değer. | yüksek |
| `recipe-estimate` | Türk mutfağı ve karışık yemekler. Yaygın ev/lokanta tarifinden malzeme bazlı tahmin. Tarif, yağ miktarı ve porsiyona göre ±%20–30 değişebilir. | orta / düşük |
| `label-typical` | Paketli ürünlerde piyasadaki tipik etiket değeri. Marka için barkod araması önerilir. | orta |
| `off` | Open Food Facts'ten gelen ürün (ODbL). Eksik alanlar kayıtta not edilir. | orta / düşük |
| `user`, `recipe`, `import`, `ai-estimate` | Kullanıcı girişi, tarif oluşturucu, toplu içe aktarma, kullanıcı onaylı görsel tahmin | — |

## Önemli not

Bu sürümdeki başlangıç değerleri referans tablolardan derlenmiştir; canlı bir veri aktarımıyla
(API/indirme) çekilmemiştir. Tek bileşenli gıdalarda değerler USDA referanslarıyla uyumludur; Türk
yemeklerinde ise değerler tahmindir ve öyle işaretlenmiştir. Kayıt sayısına ulaşmak için değer
uydurulmamıştır; her kaydın kaynağı ve güven düzeyi açıkça belirtilir. Otomatik test, her kaydın
makro–kalori tutarlılığını (Atwater 4/4/9 kuralı) kontrol eder.

## Değerlendirilen kaynaklar

- **USDA FoodData Central** — kamu malı (CC0). API anahtarı ile (ücretsiz) toplu sorgu yapılabilir:
  https://fdc.nal.usda.gov/api-guide
- **TürKomp (Ulusal Gıda Kompozisyon Veri Tabanı)** — Türk gıdaları için en uygun kaynak. Verilerin
  yeniden dağıtımı için TürKomp'un kullanım koşullarına uyulmalıdır; bu nedenle uygulamaya gömülmemiştir.
  Kişisel kullanım için değerleri **Profil › Veri › Toplu yemek içe aktar** ile ekleyebilirsin; `kaynak`
  sütununa "TürKomp" yazarsan kayıtla birlikte saklanır.
- **Open Food Facts** — paketli ürünler; Open Database License (ODbL). Uygulama veriyi kaynak
  belirterek gösterir.
- **Compendium of Physical Activities** (Ainsworth ve ark.) — MET değerleri.

## Toplu içe aktarma biçimi (CSV)

```
ad;kategori;kcal;protein;karbonhidrat;yag;lif;seker;porsiyon_adi;porsiyon_g;kaynak;takma_adlar;barkod
Keşkek (köy usulü);sulu_yemek;145;9;15;5;1,8;;1 kase;250;TürKomp;keşkek|herle;
```

Değerler 100 g başınadır. Ayraç `;` veya `,` olabilir; ondalık için `,` ya da `.` kabul edilir.
Kategori kimlikleri `src/data/categories.ts` içindedir.
