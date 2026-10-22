# KaloriDefteri

Çevrimdışı çalışan kalori, içecek, kafein, aktivite ve kilo takip uygulaması (PWA).
Üyelik yok; tüm veriler cihazda (IndexedDB) saklanır.

## Kurulum ve çalıştırma

Gereksinim: Node.js 20+.

```bash
npm install
npm run dev          # geliştirme: http://localhost:5173
npm test             # hesaplama, depolama ve entegrasyon testleri (Vitest)
npm run build        # üretim derlemesi + service worker → dist/
npm run preview      # derlenmiş sürümü yerelde dene: http://localhost:4173
```

### Android telefona PWA olarak yükleme

Service worker ve kamera **HTTPS** gerektirir (localhost hariç). Bu yüzden telefonda kullanmak için `dist/` klasörünü
HTTPS veren herhangi bir statik barındırmaya koy (ör. Netlify, Cloudflare Pages, GitHub Pages, Vercel):

1. `npm run build`
2. `dist/` klasörünü yayınla (SPA yönlendirmesi gerekmez; uygulama `#` ile gezinir).
3. Telefonda Chrome ile adresi aç → menü → **Ana ekrana ekle / Uygulamayı yükle**.
4. İlk açılıştan sonra uygulama internetsiz de açılır; kayıt ve hesaplamalar çevrimdışı çalışır.

> Veriler o tarayıcının/cihazın deposundadır. Profil › Veri bölümünden düzenli **JSON yedeği** al;
> başka cihaza geçerken bu yedeği **Geri yükle** ile aktarabilirsin.

## Mimari

```
src/
  engine/        Saf hesaplama motoru (UI'dan ve veritabanından bağımsız, test edilir)
    nutrition.ts   besin ölçekleme/toplama (bilinmeyen değer = null, 0 sayılmaz)
    portion.ts     ölçüler (gram, ml, adet, kase, tabak, dilim, kepçe, bardak, yarım/tam porsiyon…)
    recipe.ts      tarif: toplam, 100 g, porsiyon; pişmiş ağırlık / su kaybı
    beverage.ts    içecek kaydı, eklentiler (şeker/süt), saf su ↔ toplam sıvı, kafein özeti
    energy.ts      Mifflin–St Jeor BMR, TDEE, hedef, güvenli alt sınırlar ve uyarılar
    activity.ts    MET (brüt/net), adım ↔ egzersiz çift sayım önleme, sağlık verisi tekrar eleme
    daily.ts       günlük özet, tarih bazlı hedef seçimi
    stats.ts       gün serileri, kayıtsız günleri dışlayan ortalamalar, kilo eğilimi
    search.ts      Türkçe karakter normalleştirme + yazım hatası toleranslı arama
  data/          Başlangıç verisi: 419 yemek (257 Türk mutfağı), 32 içecek, 31 kategori, MET tablosu
  db/            Dexie (IndexedDB) şeması, kayıt işlemleri (repo), yedekleme/CSV/içe aktarma
  integrations/  Open Food Facts, kamera barkod, Claude görsel analiz, sağlık köprüsü, bildirimler
  ui/            React ekranları (Bugün, Yemekler, Analiz, Profil) ve alt pencereler
  tests/         Vitest testleri
```

### Veri modeli (db/types.ts)

`UserProfile`, `Food`, `FoodCategory`, `FoodServing` (+ kişisel `UserServing`), `Recipe`, `RecipeIngredient`,
`MealEntry`, `Beverage`, `BeverageEntry`, `BeverageIngredient`, `ActivityEntry`, `StepEntry`, `WeightEntry`,
`DailyGoalSettings`, `FavoriteItem`, `MealTemplate`, `AppSettings`, `PhotoRecord`.

Önemli tasarım kararları:

- **İçecekler tek kayıttır.** Bir içecek yalnızca `BeverageEntry` tablosunda yaşar; hem sıvı hem kalori
  hesabı aynı kayıttan okunur. Günlük kalori = yemek kayıtları + içecek kayıtları. Öğüne bağlansa bile
  ikinci bir kayıt oluşmaz, bu yüzden çift sayım yapısal olarak imkânsızdır. Silindiğinde ikisi birlikte gider.
- **Anlık görüntü.** Her günlük kayıt, eklendiği andaki 100 g/100 ml değerlerini ve toplamlarını taşır.
  Yemek ya da içecek tanımı sonradan düzenlense/silinse de geçmiş günler değişmez.
- **Tarihli hedefler.** `DailyGoalSettings` bir `effectiveFrom` tarihiyle saklanır; hedef değişikliği geçmiş
  günlerin istatistiklerini bozmaz.
- **Saf su ≠ toplam sıvı.** Saf su yalnızca `su` türüdür. Kahve, çay, ayran vb. toplam sıvıya eklenir,
  saf suya eklenmez. Bilimsel dayanağı olmayan "hidrasyon katsayısı" kullanılmaz.
- **Bilinmeyen ≠ sıfır.** Kafeini bilinmeyen içecekler `null` taşır; toplam "en az X mg" olarak gösterilir.
- **Çift sayım yok (aktivite).** Aktivite düzeyi yalnızca günlük yaşamı kapsar (taban adım dahil).
  Egzersiz **net** (MET − 1) eklenir. Günlük adımdan taban adım ve kayıtlı yürüyüş/koşunun tahmini adımları
  düşülür; kalan "ek adım" ayrıca hesaplanır. Sağlık platformu ve manuel adım toplanmaz. Hedefe yansıma
  oranı %0 / %50 / %100 seçilebilir.
- **Gelecek için hazır.** Her kayıtta `updatedAt` vardır; Dexie şema sürümlemesi ve JSON yedek biçimi
  (`format`, `version`) ileride senkronizasyon/bulut yedeği eklenmesine uygundur.

## Özellik durumu

| Özellik | Durum |
|---|---|
| Profil, BMR/TDEE, hedefler, formül açıklaması, uyarılar | Çalışıyor |
| Yemek veritabanı, Türkçe/yazım hatası toleranslı arama, kategoriler, varyasyonlar | Çalışıyor |
| Porsiyon ekranı (ölçüler, gram karşılığı düzenleme, kişisel ölçü kaydı) | Çalışıyor |
| Kişisel yemek (hızlı: ad + kalori, ayrıntılı), tarif oluşturucu | Çalışıyor |
| Öğünler + kullanıcı tanımlı öğünler, düzenle/kopyala/sil, dünden kopyala, şablonlar | Çalışıyor |
| Su ve içecek takibi, eklentiler (şeker/süt), "Benim kahvem", hızlı düğmeler, favoriler | Çalışıyor |
| Kafein takibi (kahve/çay ayrımı, son saat, bilinmeyen işaretleme, hedef) | Çalışıyor |
| Aktivite (MET), adım, dinamik hedef, çift sayım önleme | Çalışıyor |
| Kilo ve vücut ölçüleri, haftalık ortalama, eğilim/projeksiyon | Çalışıyor |
| İstatistikler (bugün / 7 / 30 gün / özel aralık), içecek analizi, tablo görünümü | Çalışıyor |
| JSON yedek/geri yükleme, CSV dışa aktarma, toplu yemek içe aktarma (CSV/JSON) | Çalışıyor |
| PWA, service worker, çevrimdışı açılış | Çalışıyor (HTTPS'te yüklenebilir) |
| Açık/koyu tema, mobil alt menü + (+) menüsü | Çalışıyor |
| Barkod: Open Food Facts araması | Çalışıyor (internet gerekir, anahtar gerekmez) |
| Barkod: kamera ile okuma | HTTPS + kamera izni gerekir; yoksa barkod elle girilir |
| Fotoğrafla yemek tanıma (Claude API) | **Yapılandırma gerekir:** Profil › Entegrasyonlar'a kendi Anthropic API anahtarını gir. Anahtar yoksa fotoğraf manuel kayda eklenir |
| Health Connect / Apple Health | **Yerel katman gerekir** (bkz. docs/SAGLIK_ENTEGRASYONU.md). PWA'da yok; manuel adım/aktivite tam çalışır |
| Bildirimler | Yalnızca uygulama açıkken. Uygulama kapalıyken zamanlanmış bildirim için Web Push sunucusu gerekir (yok) |

## Testler

`npm test` şunları doğrular (40 test):

- Miktar değişince kalori; yarım porsiyon; kişisel ölçünün gram karşılığı
- Kişisel yemeğin kalıcılığı (yeniden bağlanınca okunur); yemek düzenlenince eski kayıt değişmez
- Tarif toplamı, 100 g ve porsiyon değerleri; pişmiş ağırlık etkisi
- 1.580 ml örneğinin türlere ayrılması; 300 ml filtre kahvenin saf suyu artırmaması
- Sütlü/şekerli kahve kalorisi; "Benim kahvem" bileşim hesabı; içeceklerin kaloriye bir kez girmesi
- Kahve/çay/su ayrı istatistik; bilinmeyen kafeinin sıfır sayılmaması
- Egzersiz kalorisinin hedefi %0/%50/%100 güncellemesi; adım + yürüyüş çift sayımı; sağlık verisi tekrar eleme
- Gece yarısı/ay sonu tarihleri; kayıtsız günlerin ortalamaya sıfır girmemesi; hedef geçmişi
- JSON yedek → geri yükleme; CSV içe aktarma; Open Food Facts yanıt ayrıştırma
- Veritabanı: ≥250 kayıt, ≥150 Türk mutfağı, benzersiz kimlik, kaynak/güvenilirlik alanı, makro–kalori tutarlılığı

Tarayıcıda elle doğrulananlar: ilk kurulum, yemek/içecek/aktivite ekleme, tarif oluşturma, analiz grafikleri,
375 px genişlikte yatay taşma olmaması, açık/koyu tema, geri tuşunun açık pencereyi kapatması, sunucu kapalıyken
uygulamanın service worker'dan açılması.
