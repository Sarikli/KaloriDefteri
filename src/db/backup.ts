import { db, TABLE_NAMES, type TableName } from './database';
import type { Food, Nutrients } from './types';
import { uid, updateSettings } from './repo';
import { BEVERAGE_TYPES } from '../engine/beverage';
import { toDateKey } from '../engine/dates';

export const BACKUP_FORMAT = 'kaloridefteri-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

/** Tüm kullanıcı verisini JSON olarak dışa aktarır (fotoğraflar hariç). */
export async function exportBackup(): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export async function markBackedUp(): Promise<void> {
  await updateSettings({ lastBackupAt: Date.now() });
}

export function validateBackup(data: unknown): data is BackupFile {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<BackupFile>;
  return d.format === BACKUP_FORMAT && typeof d.version === 'number' && !!d.tables && typeof d.tables === 'object';
}

/**
 * Yedeği geri yükler.
 *  - replace: mevcut veriler silinir, yedek yüklenir
 *  - merge: aynı kimlikli kayıtlar yedekteki ile güncellenir, diğerleri korunur
 */
export async function restoreBackup(data: unknown, mode: 'replace' | 'merge'): Promise<{ counts: Record<string, number> }> {
  if (!validateBackup(data)) throw new Error('Bu dosya bir KaloriDefteri yedeği değil.');
  if (data.version > BACKUP_VERSION) throw new Error('Yedek, bu uygulama sürümünden daha yeni bir sürümle oluşturulmuş.');
  const counts: Record<string, number> = {};
  const tables = TABLE_NAMES.map((n) => db.table(n));
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      const rows = data.tables[name];
      if (mode === 'replace') await db.table(name).clear();
      if (Array.isArray(rows) && rows.length) {
        await db.table(name).bulkPut(rows);
        counts[name] = rows.length;
      }
    }
  });
  return { counts };
}

// ───────────────────────── CSV ─────────────────────────

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Türkçe Excel uyumu için ; ayraç ve ondalık virgül; BOM ile UTF-8 */
export function toCSV(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

export async function exportEntriesCSV(): Promise<string> {
  const [meals, bevs, acts, weights, settings] = await Promise.all([
    db.mealEntries.toArray(),
    db.beverageEntries.toArray(),
    db.activities.toArray(),
    db.weights.toArray(),
    db.settings.get('app'),
  ]);
  const mealName = new Map((settings?.meals ?? []).map((m) => [m.id, m.name]));
  const time = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const rows: unknown[][] = [];
  for (const m of meals) rows.push([m.date, time(m.time), 'Yemek', mealName.get(m.mealId) ?? m.mealId, m.name, m.servingLabel, m.amount, m.basis, m.totals.kcal, m.totals.protein, m.totals.carb, m.totals.fat, m.totals.fiber, m.totals.sugar, '', '', m.note ?? '']);
  for (const b of bevs)
    rows.push([b.date, time(b.time), 'İçecek', BEVERAGE_TYPES[b.type].label, b.name, `${b.ml} ml`, b.ml, 'ml', b.totals.kcal, b.totals.protein, b.totals.carb, b.totals.fat, '', b.totals.sugar, b.caffeineMg ?? 'bilinmiyor', '', b.note ?? '']);
  for (const a of acts) rows.push([a.date, time(a.time), 'Aktivite', a.intensity, a.name, `${a.durationMin} dk`, a.durationMin, 'dk', -a.netKcal, '', '', '', '', '', '', a.grossKcal, a.note ?? '']);
  for (const w of weights) rows.push([w.date, time(w.time), 'Kilo', '', 'Ölçüm', w.weightKg ?? '', w.weightKg ?? '', 'kg', '', '', '', '', '', '', '', '', [w.waistCm && `bel ${w.waistCm}`, w.hipCm && `kalça ${w.hipCm}`, w.neckCm && `boyun ${w.neckCm}`].filter(Boolean).join(', ')]);
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  return toCSV(
    ['Tarih', 'Saat', 'Tür', 'Öğün/Alt tür', 'Ad', 'Miktar', 'Değer', 'Birim', 'kcal (aktivitede net harcama, −)', 'Protein g', 'Karbonhidrat g', 'Yağ g', 'Lif g', 'Şeker g', 'Kafein mg', 'Brüt aktivite kcal', 'Not'],
    rows,
  );
}

export function backupFileName(ext: 'json' | 'csv'): string {
  return `kaloridefteri-${toDateKey()}.${ext}`;
}

// ───────────────────────── Toplu yemek içe aktarma ─────────────────────────

export interface ImportResult {
  added: number;
  skipped: Array<{ row: number; reason: string }>;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV (başlıklı, ; veya , ayraçlı) ya da JSON dizisi.
 * Alanlar: ad, kategori, kcal, protein, karbonhidrat, yag, lif, seker, porsiyon_adi, porsiyon_g, kaynak, takma_adlar, barkod
 * Değerler 100 g başınadır. Kaynak alanı kayıtla birlikte saklanır (ör. "TürKomp 2023, kod 01.234").
 */
export async function importFoods(text: string): Promise<ImportResult> {
  let records: Record<string, unknown>[] = [];
  const trimmed = text.trim().replace(/^﻿/, '');
  if (trimmed.startsWith('[')) {
    records = JSON.parse(trimmed);
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    records = lines.slice(1).map((l) => {
      const cells = l.split(sep);
      return Object.fromEntries(header.map((h, i) => [h, cells[i]?.trim() ?? '']));
    });
  }
  const result: ImportResult = { added: 0, skipped: [] };
  const foods: Food[] = [];
  records.forEach((r, i) => {
    const name = String(r.ad ?? r.name ?? '').trim();
    const kcal = num(r.kcal ?? r.kalori);
    if (!name) return result.skipped.push({ row: i + 2, reason: 'Ad eksik' });
    if (kcal === null || kcal < 0 || kcal > 950) return result.skipped.push({ row: i + 2, reason: 'Geçersiz kalori (100 g başına 0–950)' });
    const per100: Nutrients = {
      kcal,
      protein: num(r.protein) ?? 0,
      carb: num(r.karbonhidrat ?? r.carb) ?? 0,
      fat: num(r.yag ?? r.fat) ?? 0,
      fiber: num(r.lif ?? r.fiber),
      sugar: num(r.seker ?? r.sugar),
    };
    const servingG = num(r.porsiyon_g) ?? 100;
    const t = Date.now();
    foods.push({
      id: uid('u'),
      name,
      aliases: String(r.takma_adlar ?? '').split(/[|,]/).map((s) => s.trim()).filter(Boolean),
      categoryId: String(r.kategori ?? 'kisisel') || 'kisisel',
      cuisine: 'tr',
      basis: 'g',
      per100,
      servings: [{ id: 'imp-0', unit: 'porsiyon', label: String(r.porsiyon_adi || '1 porsiyon'), amount: servingG, isDefault: true }],
      source: 'import',
      sourceNote: String(r.kaynak ?? '') || 'Toplu içe aktarma',
      confidence: 'medium',
      isUser: true,
      barcode: r.barkod ? String(r.barkod) : undefined,
      createdAt: t,
      updatedAt: t,
    });
    result.added++;
  });
  if (foods.length) await db.foods.bulkAdd(foods);
  return result;
}
