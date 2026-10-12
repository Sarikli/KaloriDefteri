import type { Confidence, DataSource } from '../db/types';

const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export const kcal = (n: number) => nf0.format(Math.round(n));
export const g1 = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf1.format(n));
export const int = (n: number) => nf0.format(Math.round(n));

export function ml(n: number): string {
  if (Math.abs(n) >= 1000) return `${nf1.format(n / 1000)} L`;
  return `${nf0.format(Math.round(n))} ml`;
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  reference: 'Referans veri',
  'recipe-estimate': 'Tarif tahmini',
  'label-typical': 'Tipik etiket',
  user: 'Kişisel',
  recipe: 'Tarifim',
  off: 'Open Food Facts',
  'ai-estimate': 'Görsel tahmin',
  import: 'İçe aktarıldı',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = { high: 'yüksek', medium: 'orta', low: 'düşük' };

export function timeAgo(ts: number): string {
  const d = Math.round((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'bugün';
  if (d === 1) return 'dün';
  return `${d} gün önce`;
}
