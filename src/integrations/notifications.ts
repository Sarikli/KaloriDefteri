/**
 * Hatırlatıcılar. Web Notification API yalnızca uygulama (veya service worker) çalışırken
 * bildirim gösterebilir. Uygulama kapalıyken zamanlanmış bildirim için sunucu tarafı Web Push
 * ya da yerel uygulama katmanı gerekir; bu sürümde yoktur ve öyleymiş gibi gösterilmez.
 */
import type { ReminderSettings } from '../db/types';

export type NotifySupport = 'unsupported' | 'denied' | 'default' | 'granted';

export function notificationSupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifySupport;
}

export async function requestNotificationPermission(): Promise<NotifySupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  return (await Notification.requestPermission()) as NotifySupport;
}

async function show(title: string, body: string) {
  if (notificationSupport() !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (reg) await reg.showNotification(title, { body, icon: '/pwa-192.png', tag: title });
  else new Notification(title, { body, icon: '/pwa-192.png' });
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Uygulama açıkken dakikada bir kontrol eden zamanlayıcı. Durdurma fonksiyonu döner. */
export function startReminderLoop(get: () => ReminderSettings | undefined): () => void {
  let lastWater = Date.now();
  const fired = new Set<string>();
  const id = setInterval(() => {
    const r = get();
    if (!r?.enabled) return;
    const now = new Date();
    const key = (k: string) => `${now.toDateString()}-${k}`;
    if (r.waterEveryMin && Date.now() - lastWater >= r.waterEveryMin * 60_000) {
      lastWater = Date.now();
      show('Su zamanı', 'Bir bardak su içmeye ne dersin?');
    }
    for (const t of r.mealTimes) if (t === hm(now) && !fired.has(key(t))) {
      fired.add(key(t));
      show('Öğün kaydı', 'Bu öğünde yediklerini kaydetmeyi unutma.');
    }
    if (r.weightTime === hm(now) && !fired.has(key('w'))) {
      fired.add(key('w'));
      show('Kilo ölçümü', 'Günlük kilonu kaydetmek ister misin?');
    }
    if (r.dailyReviewTime === hm(now) && !fired.has(key('r'))) {
      fired.add(key('r'));
      show('Günün özeti', 'Bugünkü beslenme ve hareket özetine göz at.');
    }
  }, 30_000);
  return () => clearInterval(id);
}
