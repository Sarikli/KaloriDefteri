/**
 * Sağlık platformu entegrasyon katmanı.
 *
 * Bir PWA; Android Health Connect veya Apple Health verisine doğrudan ERİŞEMEZ. Bu veriler
 * yalnızca yerel (native) bir uygulama katmanı üzerinden okunabilir. Mimari, uygulama
 * Capacitor ile paketlendiğinde bir yerel eklentinin `window.KaloriHealthBridge` nesnesini
 * sağlamasına göre kurulmuştur (bkz. docs/SAGLIK_ENTEGRASYONU.md).
 *
 * Köprü yoksa sağlayıcı "kullanılamıyor" döner; uygulama manuel adım/aktivite girişiyle eksiksiz çalışır.
 * Gelen veriler `source: 'health'` ile kaydedilir; manuel kayıtlarla çakışma motor katmanında
 * (dedupeActivities, stepsForDay) çözülür.
 */
import type { ActivityType, DateKey } from '../db/types';

export interface HealthActivity {
  externalId: string;
  type: ActivityType;
  start: number;
  durationMin: number;
  distanceKm?: number;
}

export interface HealthBridge {
  platform: 'health-connect' | 'apple-health';
  requestPermissions(): Promise<boolean>;
  getSteps(date: DateKey): Promise<number | null>;
  getActivities(date: DateKey): Promise<HealthActivity[]>;
}

export type HealthStatus = { available: false; reason: string } | { available: true; platform: HealthBridge['platform'] };

export function getHealthBridge(): HealthBridge | null {
  const w = typeof window !== 'undefined' ? (window as unknown as { KaloriHealthBridge?: HealthBridge }) : {};
  return w.KaloriHealthBridge ?? null;
}

export function healthStatus(): HealthStatus {
  const b = getHealthBridge();
  if (b) return { available: true, platform: b.platform };
  return {
    available: false,
    reason: 'Tarayıcıda/PWA olarak çalışırken telefonun sağlık verilerine erişilemez. Otomatik adım için uygulamanın Capacitor ile yerel paketlenmesi gerekir. Şimdilik adımları manuel girebilirsin.',
  };
}
