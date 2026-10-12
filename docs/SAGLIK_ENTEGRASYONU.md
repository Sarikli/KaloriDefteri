# Sağlık platformu entegrasyonu (Health Connect / Apple Health)

## Neden PWA'da yok?

Tarayıcıda çalışan bir web uygulaması (PWA), Android Health Connect veya Apple HealthKit verilerine
erişemez; bu API'ler yalnızca yerel (native) uygulamalara açıktır. Uygulama bu yüzden adım ve
aktiviteyi manuel girişle eksiksiz destekler ve sağlık verisi varmış gibi davranmaz.

## Mimari hazırlık

`src/integrations/health.ts` bir köprü arayüzü tanımlar:

```ts
interface HealthBridge {
  platform: 'health-connect' | 'apple-health';
  requestPermissions(): Promise<boolean>;
  getSteps(date: string): Promise<number | null>;
  getActivities(date: string): Promise<HealthActivity[]>;
}
```

Uygulama Capacitor ile paketlendiğinde, bir yerel eklenti `window.KaloriHealthBridge` nesnesini bu
arayüzle sağlar. Gelen veriler şöyle kaydedilir:

- Adım: `setSteps(date, steps, 'health')` — aynı gün manuel giriş varsa **toplanmaz**; ölçülmüş değer kullanılır.
- Aktivite: `logActivity({ ..., source: 'health', externalId })` — aynı `externalId` tekrar gelirse
  ya da aynı türde ve zaman aralığının yarısından fazlası örtüşen manuel kayıt varsa mükerrer sayılır
  (`engine/activity.ts › dedupeActivities`, testli).

## Yapılacaklar (yerel katman)

1. `npm i @capacitor/core @capacitor/cli @capacitor/android` ve `npx cap init`, `npx cap add android`.
2. Health Connect için bir Capacitor eklentisi (topluluk eklentisi ya da küçük bir Kotlin eklentisi) ekle;
   `READ_STEPS` ve `READ_EXERCISE` izinlerini manifest'e yaz.
3. Eklentiyi `window.KaloriHealthBridge` olarak sar ve uygulama açılışında/ön plana gelişte bugünün
   verisini çekip yukarıdaki fonksiyonlarla kaydet.
4. iOS için aynı arayüzü HealthKit eklentisiyle uygula.
