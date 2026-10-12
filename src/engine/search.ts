/** Türkçe karakter duyarlı, yazım hatasına toleranslı arama */

const MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıiöşüâîû]/g, (ch) => MAP[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Damerau–Levenshtein (komşu harf yer değişimi dahil), `max` aşılınca erken çıkar */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

function allowedTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

export interface Searchable {
  id: string;
  name: string;
  aliases?: string[];
}

/** 0 = eşleşme yok. Yüksek puan önce gelir. */
export function scoreText(query: string, target: string): number {
  const q = normalizeTr(query);
  const t = normalizeTr(target);
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const words = t.split(' ');
  if (words.some((w) => w.startsWith(q))) return 80;
  if (t.includes(q)) return 70;
  // Çok kelimeli sorgu: her kelime hedefte (yaklaşık) bulunmalı
  const qWords = q.split(' ');
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const w of words) {
      if (w.startsWith(qw)) best = Math.max(best, 60);
      else if (w.includes(qw) && qw.length >= 3) best = Math.max(best, 50);
      else {
        const tol = allowedTypos(qw.length);
        if (tol > 0) {
          const cmp = w.slice(0, Math.max(qw.length, Math.min(w.length, qw.length + 1)));
          const d = Math.min(editDistance(qw, w, tol), editDistance(qw, cmp, tol));
          if (d <= tol) best = Math.max(best, 45 - d * 10);
        }
      }
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / qWords.length;
}

export function scoreItem(query: string, item: Searchable): number {
  let best = scoreText(query, item.name);
  for (const a of item.aliases ?? []) best = Math.max(best, scoreText(query, a) - 2);
  return best;
}

export function search<T extends Searchable>(items: T[], query: string, opts: { limit?: number; boost?: (item: T) => number } = {}): T[] {
  const q = query.trim();
  const scored: Array<{ item: T; s: number }> = [];
  for (const item of items) {
    const s = q ? scoreItem(q, item) : 1;
    if (s > 0) scored.push({ item, s: s + (opts.boost?.(item) ?? 0) });
  }
  scored.sort((a, b) => b.s - a.s || a.item.name.localeCompare(b.item.name, 'tr'));
  return scored.slice(0, opts.limit ?? 200).map((x) => x.item);
}
