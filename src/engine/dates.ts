import type { DateKey } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Yerel saat dilimine göre tarih anahtarı. UTC kullanılmaz; gece yarısı kaymalarını önler. */
export function toDateKey(d: Date | number = new Date()): DateKey {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  const ms = parseDateKey(a).getTime() - parseDateKey(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** a..b (dahil) arasındaki tüm günler */
export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  let k = from;
  let guard = 0;
  while (k <= to && guard < 3700) {
    out.push(k);
    k = addDays(k, 1);
    guard++;
  }
  return out;
}

/** Seçilen gün + saat:dakika → zaman damgası (kayıt doğru günde kalsın diye) */
export function timeOnDate(key: DateKey, hhmm: string): number {
  const d = parseDateKey(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Bugün için şimdiki saat, başka gün için 12:00 */
export function defaultTimeFor(key: DateKey, now = new Date()): number {
  if (key === toDateKey(now)) return now.getTime();
  return timeOnDate(key, '12:00');
}

const DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export function weekdayShort(key: DateKey): string {
  return DAYS_SHORT[parseDateKey(key).getDay()];
}

export function formatDateTR(key: DateKey, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', weekday: 'long' }): string {
  return parseDateKey(key).toLocaleDateString('tr-TR', opts);
}

export function shortDateTR(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Pazartesi başlangıçlı hafta anahtarı */
export function weekStart(key: DateKey): DateKey {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toDateKey(d);
}
