import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Database, Download, HardDriveDownload, Plug, Plus, Target, Trash2, Upload, User, Utensils, CupSoda, Info } from 'lucide-react';
import type { AllowancePct, DailyGoalSettings } from '../../db/types';
import * as repo from '../../db/repo';
import { backupFileName, exportBackup, exportEntriesCSV, importFoods, markBackedUp, restoreBackup } from '../../db/backup';
import { ACTIVITY_LEVELS, ageFrom, bmi, GOAL_LABEL } from '../../engine/energy';
import { toDateKey } from '../../engine/dates';
import { healthStatus } from '../../integrations/health';
import { notificationSupport, requestNotificationPermission, type NotifySupport } from '../../integrations/notifications';
import { OFF_ATTRIBUTION } from '../../integrations/openFoodFacts';
import { VISION_MODEL } from '../../integrations/visionConfig';
import { useAllBeverages, useGoalFor, useProfile, useSettings } from '../hooks';
import { useApp } from '../store';
import { g1, kcal, ml, timeAgo } from '../format';
import { Button, Card, CardHeader, Field, Note, NumberInput, Segmented, Select, TextInput } from '../components/ui';
import { ProfileForm } from './ProfileForm';

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Section({ id, title, icon, children, sub }: { id: string; title: string; icon: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <Card>
      <div id={id} className="scroll-mt-20" />
      <CardHeader title={title} icon={icon} sub={sub} />
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function ProfileScreen() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const goal = useGoalFor(toDateKey());
  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-extrabold tracking-tight">Profil</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Section id="profil" title="Profil ve kalori hedefi" icon={<User size={18} className="text-teal" />}>
            {profile && !editing ? (
              <div className="space-y-3">
                <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
                  <dt className="text-muted">Yaş</dt>
                  <dd className="font-semibold">{ageFrom(profile.birthYear)}</dd>
                  <dt className="text-muted">Boy / kilo</dt>
                  <dd className="font-semibold">
                    {profile.heightCm} cm · {g1(profile.currentWeightKg)} kg
                  </dd>
                  <dt className="text-muted">Beden kitle indeksi</dt>
                  <dd className="font-semibold">{g1(bmi(profile.currentWeightKg, profile.heightCm))}</dd>
                  <dt className="text-muted">Aktivite düzeyi</dt>
                  <dd className="font-semibold">{ACTIVITY_LEVELS[profile.activityLevel].label}</dd>
                  <dt className="text-muted">Hedef</dt>
                  <dd className="font-semibold">
                    {GOAL_LABEL[profile.goal]}
                    {profile.goal === 'lose' || profile.goal === 'gain' ? ` · ${profile.rateKgPerWeek.toLocaleString('tr-TR')} kg/hafta` : ''}
                  </dd>
                  {profile.targetWeightKg && (
                    <>
                      <dt className="text-muted">Hedef kilo</dt>
                      <dd className="font-semibold">{g1(profile.targetWeightKg)} kg</dd>
                    </>
                  )}
                  <dt className="text-muted">Günlük temel hedef</dt>
                  <dd className="text-[16px] font-extrabold text-teal">{kcal(goal.baseKcal)} kcal</dd>
                </dl>
                {goal.calcSummary && (
                  <details className="rounded-xl bg-sunk px-3 py-2 text-[12.5px] text-muted">
                    <summary className="cursor-pointer font-semibold text-ink">Hesaplama nasıl yapıldı?</summary>
                    <pre className="num mt-2 whitespace-pre-wrap font-sans">{goal.calcSummary}</pre>
                    <p className="mt-2">Yetişkinler için Mifflin–St Jeor denklemi ve yaygın aktivite çarpanları kullanılır. Sonuçlar tahmindir.</p>
                  </details>
                )}
                {Math.abs(profile.currentWeightKg - profile.startWeightKg) >= 2 && <Note>Kilon başlangıçtan bu yana değişti. Hedefin güncel kiloyla yeniden hesaplanması için profili kaydedebilirsin.</Note>}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Profili düzenle
                </Button>
              </div>
            ) : (
              <ProfileForm profile={profile} onSaved={() => setEditing(false)} />
            )}
          </Section>
          <GoalsSection goal={goal} />
          <MealsSection />
          <QuickDrinksSection />
        </div>
        <div className="space-y-4">
          <DataSection />
          <IntegrationsSection />
          <RemindersSection />
          <AppearanceSection />
          <AboutSection />
        </div>
      </div>
    </div>
  );
}

function GoalsSection({ goal }: { goal: DailyGoalSettings }) {
  const { toast } = useApp();
  const [g, setG] = useState(goal);
  useEffect(() => setG(goal), [goal]);
  const sum = g.proteinPct + g.carbPct + g.fatPct;
  const dirty = JSON.stringify(g) !== JSON.stringify(goal);
  const set = <K extends keyof DailyGoalSettings>(k: K, v: DailyGoalSettings[K]) => setG((x) => ({ ...x, [k]: v }));
  return (
    <Section id="hedefler" title="Beslenme, sıvı ve aktivite hedefleri" icon={<Target size={18} className="text-teal" />} sub="Değişiklikler bugünden itibaren geçerli olur; geçmiş günler eski hedefi korur.">
      <div className="space-y-4">
        <Field label="Makro dağılımı (% enerji)" hint={sum !== 100 ? `Toplam %${sum} — %100 olmalı.` : `Temel hedefe göre: protein ${Math.round((goal.baseKcal * g.proteinPct) / 400)} g, karbonhidrat ${Math.round((goal.baseKcal * g.carbPct) / 400)} g, yağ ${Math.round((goal.baseKcal * g.fatPct) / 900)} g`}>
          <div className="grid grid-cols-3 gap-2">
            <NumberInput value={g.proteinPct} onChange={(v) => set('proteinPct', v ?? 0)} suffix="% P" ariaLabel="Protein yüzdesi" />
            <NumberInput value={g.carbPct} onChange={(v) => set('carbPct', v ?? 0)} suffix="% K" ariaLabel="Karbonhidrat yüzdesi" />
            <NumberInput value={g.fatPct} onChange={(v) => set('fatPct', v ?? 0)} suffix="% Y" ariaLabel="Yağ yüzdesi" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saf su hedefi">
            <NumberInput value={g.waterMl} onChange={(v) => set('waterMl', v ?? 0)} suffix="ml" ariaLabel="Saf su hedefi" />
          </Field>
          <Field label="Toplam sıvı hedefi">
            <NumberInput value={g.fluidMl} onChange={(v) => set('fluidMl', v ?? 0)} suffix="ml" ariaLabel="Toplam sıvı hedefi" />
          </Field>
          <Field label="Kafein hedefi (isteğe bağlı)" hint="Boş bırakılırsa sınır gösterilmez">
            <NumberInput value={g.caffeineLimitMg} onChange={(v) => set('caffeineLimitMg', v)} suffix="mg" ariaLabel="Kafein hedefi" />
          </Field>
          <Field label="Taban adım" hint="Aktivite düzeyinin zaten içerdiği günlük adım">
            <NumberInput value={g.stepBaseline} onChange={(v) => set('stepBaseline', v ?? 0)} ariaLabel="Taban adım" />
          </Field>
        </div>
        <Field label="Aktivite kalorisinin hedefe yansıyan kısmı" hint="Egzersiz harcaması tahmini olduğundan birçok kişi %50 ile başlar.">
          <Segmented<AllowancePct>
            value={g.exerciseAllowancePct}
            onChange={(v) => set('exerciseAllowancePct', v)}
            options={[
              { value: 0, label: '%0' },
              { value: 50, label: '%50' },
              { value: 100, label: '%100' },
            ]}
          />
        </Field>
        <Button
          disabled={!dirty || sum !== 100}
          onClick={async () => {
            const { effectiveFrom: _e, updatedAt: _u, ...patch } = g;
            await repo.saveGoals(patch);
            toast('Hedefler bugünden itibaren güncellendi');
          }}
        >
          Hedefleri kaydet
        </Button>
      </div>
    </Section>
  );
}

function MealsSection() {
  const settings = useSettings();
  const [name, setName] = useState('');
  if (!settings) return null;
  const meals = [...settings.meals].sort((a, b) => a.order - b.order);
  return (
    <Section id="ogunler" title="Öğünler" icon={<Utensils size={18} className="text-teal" />} sub="Kendi öğünlerini ekleyebilirsin (ör. Gece atıştırması, Antrenman sonrası).">
      <ul className="space-y-2">
        {meals.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <TextInput
              value={m.name}
              aria-label="Öğün adı"
              disabled={m.builtin}
              onChange={(e) => repo.updateSettings({ meals: settings.meals.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)) })}
            />
            {!m.builtin && (
              <Button variant="danger" aria-label={`${m.name} öğününü kaldır`} onClick={() => repo.updateSettings({ meals: settings.meals.filter((x) => x.id !== m.id) })}>
                <Trash2 size={16} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          repo.updateSettings({ meals: [...settings.meals, { id: repo.uid('meal'), name: name.trim(), order: settings.meals.length, builtin: false }] });
          setName('');
        }}
      >
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Yeni öğün adı" aria-label="Yeni öğün adı" />
        <Button type="submit" variant="soft">
          <Plus size={16} /> Ekle
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-muted">Kaldırılan bir öğünün geçmiş kayıtları silinmez; Bugün ekranında “Diğer” altında görünür.</p>
    </Section>
  );
}

function QuickDrinksSection() {
  const settings = useSettings();
  const bevs = useAllBeverages();
  if (!settings) return null;
  const q = settings.quickDrinks;
  const update = (list: typeof q) => repo.updateSettings({ quickDrinks: list });
  return (
    <Section id="hizli" title="Hızlı içecek düğmeleri" icon={<CupSoda size={18} className="text-coffee" />} sub="Bugün ekranında tek dokunuşla eklenir.">
      <ul className="space-y-2">
        {q.map((item) => (
          <li key={item.id} className="grid grid-cols-[1fr_110px_auto] gap-2">
            <Select ariaLabel="İçecek" value={item.beverageId} onChange={(v) => update(q.map((x) => (x.id === item.id ? { ...x, beverageId: v, label: undefined } : x)))} options={bevs.map((b) => ({ value: b.id, label: b.name }))} />
            <NumberInput value={item.ml} onChange={(v) => update(q.map((x) => (x.id === item.id ? { ...x, ml: v ?? 0, label: undefined } : x)))} suffix="ml" ariaLabel="Miktar" />
            <Button variant="danger" aria-label="Düğmeyi kaldır" onClick={() => update(q.filter((x) => x.id !== item.id))}>
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>
      {q.length < 6 && (
        <Button variant="soft" size="sm" className="mt-3" onClick={() => update([...q, { id: repo.uid('q'), beverageId: 'bv:su', ml: 330 }])}>
          <Plus size={16} /> Düğme ekle
        </Button>
      )}
      <p className="mt-2 text-[12px] text-muted">Örnek: her sabah 300 ml filtre kahve içiyorsan bir düğme ekle; ya da içecek ekranında yıldıza dokunarak sütlü/şekerli halini favoriye kaydet.</p>
    </Section>
  );
}

function DataSection() {
  const settings = useSettings();
  const { toast } = useApp();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmReplace, setConfirmReplace] = useState<File | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const last = settings?.lastBackupAt;
  const stale = !last || Date.now() - last > 7 * 86_400_000;

  const doRestore = async (file: File, m: 'merge' | 'replace') => {
    try {
      const data = JSON.parse(await file.text());
      const r = await restoreBackup(data, m);
      toast(`Geri yüklendi: ${Object.values(r.counts).reduce((a, b) => a + b, 0)} kayıt`);
    } catch (e) {
      toast(`Geri yükleme başarısız: ${(e as Error).message}`);
    }
  };

  return (
    <Section id="veri" title="Veri, yedekleme ve dışa aktarma" icon={<Database size={18} className="text-teal" />}>
      <div className="space-y-3">
        <Note tone={stale ? 'warn' : 'ok'}>
          Verilerin yalnızca bu cihazda (tarayıcı depolamasında) saklanır; üyelik ve bulut yedeği yoktur. Tarayıcı verilerini temizlemek veya uygulamayı kaldırmak kayıtları siler.{' '}
          {last ? `Son yedek: ${timeAgo(last)}.` : 'Henüz yedek almadın.'} Düzenli JSON yedeği almanı öneririz.
        </Note>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Kalıcı depolama:</span>
          <b>{persisted === null ? 'bilinmiyor' : persisted ? 'etkin (tarayıcı otomatik silmez)' : 'etkin değil'}</b>
          {persisted === false && (
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                const ok = await navigator.storage?.persist?.();
                setPersisted(!!ok);
                toast(ok ? 'Kalıcı depolama etkinleştirildi' : 'Tarayıcı kalıcı depolamaya izin vermedi (uygulamayı ana ekrana eklemek genelde yardımcı olur)');
              }}
            >
              Etkinleştir
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={async () => {
              download(backupFileName('json'), JSON.stringify(await exportBackup()), 'application/json');
              await markBackedUp();
              toast('Yedek dosyası indirildi');
            }}
          >
            <HardDriveDownload size={18} /> JSON yedeği al
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              download(backupFileName('csv'), await exportEntriesCSV(), 'text/csv;charset=utf-8');
              toast('CSV indirildi');
            }}
          >
            <Download size={18} /> CSV dışa aktar
          </Button>
        </div>
        <div className="rounded-2xl border border-line p-3">
          <div className="mb-2 text-[13px] font-semibold">Yedeği geri yükle</div>
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'merge', label: 'Birleştir' },
              { value: 'replace', label: 'Mevcut verinin yerine koy' },
            ]}
          />
          <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-[14px] font-semibold hover:bg-sunk">
            <Upload size={18} /> JSON dosyası seç
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (mode === 'replace') setConfirmReplace(f);
                else await doRestore(f, 'merge');
              }}
            />
          </label>
          {confirmReplace && (
            <div className="mt-2 rounded-xl bg-danger/10 p-3 text-[13px] text-danger">
              Mevcut tüm kayıtlar silinip “{confirmReplace.name}” yüklenecek. Emin misin?
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await doRestore(confirmReplace, 'replace');
                    setConfirmReplace(null);
                  }}
                >
                  Evet, yerine koy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(null)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line p-3">
          <div className="text-[13px] font-semibold">Toplu yemek içe aktar (CSV / JSON)</div>
          <p className="mt-1 text-[12px] text-muted">
            Sütunlar: ad; kategori; kcal; protein; karbonhidrat; yag; lif; seker; porsiyon_adi; porsiyon_g; kaynak; takma_adlar; barkod — değerler 100 g başına. Kaynak (ör. “TürKomp”) her kayıtla saklanır.
          </p>
          <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-[14px] font-semibold hover:bg-sunk">
            <Upload size={18} /> Dosya seç
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const r = await importFoods(await f.text());
                  toast(`${r.added} yemek eklendi${r.skipped.length ? `, ${r.skipped.length} satır atlandı (ör. satır ${r.skipped[0].row}: ${r.skipped[0].reason})` : ''}`);
                } catch {
                  toast('Dosya okunamadı. Biçimi kontrol et.');
                }
              }}
            />
          </label>
        </div>
      </div>
    </Section>
  );
}

function IntegrationsSection() {
  const settings = useSettings();
  const { toast } = useApp();
  const [key, setKey] = useState('');
  const health = healthStatus();
  return (
    <Section id="entegrasyonlar" title="Entegrasyonlar" icon={<Plug size={18} className="text-teal" />}>
      <div className="space-y-4 text-[14px]">
        <div>
          <div className="font-semibold">Barkod araması · Open Food Facts</div>
          <p className="text-[13px] text-muted">Etkin. İnternet bağlantısı gerektirir; anahtar gerekmez. {OFF_ATTRIBUTION}. Kamera yalnızca HTTPS üzerinde çalışır; aksi halde barkod elle girilir.</p>
        </div>
        <div>
          <div className="font-semibold">Fotoğrafla yemek tanıma · Claude API</div>
          {settings?.visionApiKey ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-md bg-leafsoft px-2 py-0.5 font-semibold text-leaf">Yapılandırıldı</span>
              <span className="text-muted">Model: {VISION_MODEL}</span>
              <Button size="sm" variant="ghost" onClick={() => repo.updateSettings({ visionApiKey: undefined })}>
                Anahtarı kaldır
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-muted">Yapılandırılmadı. Otomatik tanıma için kendi Anthropic API anahtarını gir. Anahtar yalnızca bu cihazda saklanır; istekler doğrudan api.anthropic.com’a gider ve kullanım ücreti hesabına yansır.</p>
              <form
                className="mt-2 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!key.trim().startsWith('sk-')) return toast('Geçerli bir API anahtarı gir (sk- ile başlar).');
                  await repo.updateSettings({ visionApiKey: key.trim() });
                  setKey('');
                  toast('Görsel analiz yapılandırıldı');
                }}
              >
                <TextInput type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API anahtarı" />
                <Button type="submit" variant="soft">
                  Kaydet
                </Button>
              </form>
            </>
          )}
        </div>
        <div>
          <div className="font-semibold">Adım ve sağlık verisi · Health Connect / Apple Health</div>
          <p className="text-[13px] text-muted">{health.available ? `Bağlı: ${health.platform}` : health.reason}</p>
        </div>
      </div>
    </Section>
  );
}

function RemindersSection() {
  const settings = useSettings();
  const [support, setSupport] = useState<NotifySupport>(notificationSupport());
  if (!settings) return null;
  const r = settings.reminders;
  const set = (patch: Partial<typeof r>) => repo.updateSettings({ reminders: { ...r, ...patch } });
  return (
    <Section id="hatirlatici" title="Hatırlatıcılar" icon={<Bell size={18} className="text-teal" />}>
      <div className="space-y-3 text-[14px]">
        <Note>Web bildirimleri yalnızca uygulama açıkken (ya da arka planda sekmesi açıkken) gösterilebilir. Uygulama tamamen kapalıyken zamanlanmış bildirim bu sürümde yoktur.</Note>
        {support === 'unsupported' ? (
          <p className="text-muted">Bu tarayıcı bildirimleri desteklemiyor.</p>
        ) : support !== 'granted' ? (
          <Button variant="soft" onClick={async () => setSupport(await requestNotificationPermission())} disabled={support === 'denied'}>
            {support === 'denied' ? 'Bildirim izni reddedildi (tarayıcı ayarlarından açılabilir)' : 'Bildirim izni ver'}
          </Button>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={r.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--teal))]" />
              Hatırlatıcıları aç
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Su hatırlatıcısı">
                <Select
                  value={String(r.waterEveryMin ?? 0)}
                  onChange={(v) => set({ waterEveryMin: Number(v) || null })}
                  options={[
                    { value: '0', label: 'Kapalı' },
                    { value: '60', label: 'Her saat' },
                    { value: '90', label: '90 dakikada bir' },
                    { value: '120', label: '2 saatte bir' },
                  ]}
                />
              </Field>
              <Field label="Kilo ölçümü">
                <input type="time" value={r.weightTime ?? ''} onChange={(e) => set({ weightTime: e.target.value || null })} className="num h-11 w-full rounded-xl border border-line bg-surface px-3" />
              </Field>
              <Field label="Öğün kaydı saatleri" hint="Virgülle ayır: 09:00, 13:00, 20:00">
                <TextInput defaultValue={r.mealTimes.join(', ')} onBlur={(e) => set({ mealTimes: e.target.value.split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)) })} />
              </Field>
              <Field label="Günlük değerlendirme">
                <input type="time" value={r.dailyReviewTime ?? ''} onChange={(e) => set({ dailyReviewTime: e.target.value || null })} className="num h-11 w-full rounded-xl border border-line bg-surface px-3" />
              </Field>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <Section id="gorunum" title="Görünüm ve tercihler" icon={<Info size={18} className="text-teal" />}>
      <div className="space-y-3 text-[14px]">
        <Field label="Tema">
          <Segmented
            value={settings.theme}
            onChange={(v) => repo.updateSettings({ theme: v })}
            options={[
              { value: 'system', label: 'Sistem' },
              { value: 'light', label: 'Açık' },
              { value: 'dark', label: 'Koyu' },
            ]}
          />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.caffeineTracking} onChange={(e) => repo.updateSettings({ caffeineTracking: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--teal))]" />
          Kafein takibini göster
        </label>
      </div>
    </Section>
  );
}

function AboutSection() {
  return (
    <Section id="hakkinda" title="Veri kaynakları ve sınırlar" icon={<Info size={18} className="text-muted" />}>
      <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-muted">
        <li>Tek bileşenli gıdalar: USDA FoodData Central (SR Legacy) referans değerleriyle uyumlu, yuvarlanmış değerler (kamu malı).</li>
        <li>Türk mutfağı yemekleri: yaygın tarifler üzerinden malzeme bazlı tahmin; her kayıtta kaynak ve güvenilirlik düzeyi gösterilir. TürKomp gibi kaynaklardan toplu içe aktarma desteklenir.</li>
        <li>Paketli ürünler: Open Food Facts (ODbL). Kullanıcı katkılı veridir; eksik veya hatalı olabilir.</li>
        <li>Aktivite: Compendium of Physical Activities MET değerleri. Enerji: Mifflin–St Jeor + aktivite çarpanı.</li>
        <li>Tüm hesaplamalar tahmindir; tıbbi teşhis ya da tedavi önerisi değildir.</li>
      </ul>
      <p className="num mt-3 text-[12px] text-muted">Su hedefi ve toplam sıvı ayrı izlenir: kahve, çay ve diğer içecekler toplam sıvıya eklenir, saf suya eklenmez. Örneğin {ml(300)} filtre kahve yalnızca toplam sıvıyı artırır.</p>
    </Section>
  );
}
