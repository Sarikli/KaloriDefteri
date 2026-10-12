import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookmarkPlus, ChevronLeft, ChevronRight, Copy, Dumbbell, Flame, Footprints, GlassWater, LayoutTemplate, Plus, Scale, Utensils } from 'lucide-react';
import type { AllowancePct, Food, MealDef, MealEntry } from '../../db/types';
import * as repo from '../../db/repo';
import { db } from '../../db/database';
import { BUILTIN_BEVERAGE_MAP } from '../../data/beverages';
import { ACTIVITIES } from '../../data/activities';
import { summarizeDay, type DaySummary } from '../../engine/daily';
import { BEVERAGE_TYPES, caffeineText, groupOf, GROUP_LABEL } from '../../engine/beverage';
import { addDays, formatDateTR, hhmm, shortDateTR, toDateKey } from '../../engine/dates';
import { useAllBeverages, useDay, useFavorites, useGoalFor, useProfile, useSettings } from '../hooks';
import { useApp } from '../store';
import { g1, int, kcal, ml } from '../format';
import { Button, Card, CardHeader, Chip, IconButton, NumberInput, ProgressBar, Ring, Segmented, StatTile, TextInput, cx } from '../components/ui';
import { DrinkIcon, GROUP_COLOR, GROUP_ORDER } from '../components/drink';

export function TodayScreen() {
  const { date, setDate } = useApp();
  const day = useDay(date);
  const goal = useGoalFor(date);
  const profile = useProfile();
  const settings = useSettings();
  const meals = useMemo(() => [...(settings?.meals ?? repo.DEFAULT_MEALS)].sort((a, b) => a.order - b.order), [settings]);

  const summary = useMemo(
    () =>
      day
        ? summarizeDay({ meals: day.meals, beverages: day.beverages, activities: day.activities, steps: day.steps, goal, mealDefs: meals, weightKg: profile?.currentWeightKg ?? 70, heightCm: profile?.heightCm ?? 170 })
        : null,
    [day, goal, meals, profile],
  );
  const today = toDateKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Önceki gün" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={22} />
        </IconButton>
        <label className="relative min-w-0 flex-1 cursor-pointer text-center">
          <span className="block text-[12px] font-bold uppercase tracking-wider text-teal">{date === today ? 'Bugün' : date === addDays(today, -1) ? 'Dün' : date === addDays(today, 1) ? 'Yarın' : formatDateTR(date, { weekday: 'long' })}</span>
          <span className="block truncate text-[17px] font-bold">{formatDateTR(date, { day: 'numeric', month: 'long', year: date.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' })}</span>
          <input type="date" aria-label="Tarih seç" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <IconButton label="Sonraki gün" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={22} />
        </IconButton>
      </div>
      {date !== today && (
        <div className="-mt-2 text-center">
          <button type="button" className="text-[13px] font-semibold text-teal" onClick={() => setDate(today)}>
            Bugüne dön
          </button>
        </div>
      )}

      {summary && <DayStatus s={summary} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          {summary && <CalorieCard s={summary} />}
          {summary && <MacroCard s={summary} />}
          {day &&
            meals.map((m) => (
              <MealCard key={m.id} meal={m} entries={day.meals.filter((e) => e.mealId === m.id)} />
            ))}
          {day && day.meals.some((e) => !meals.some((m) => m.id === e.mealId)) && (
            <MealCard meal={{ id: '__other', name: 'Diğer', order: 99, builtin: false }} entries={day.meals.filter((e) => !meals.some((m) => m.id === e.mealId))} />
          )}
        </div>
        <div className="space-y-4">
          {summary && day && <DrinksCard s={summary} entries={day.beverages} />}
          {summary && day && <ActivityCard s={summary} />}
          <WeightMini />
        </div>
      </div>
    </div>
  );
}

function DayStatus({ s }: { s: DaySummary }) {
  const pct = s.targetKcal > 0 ? Math.round((s.total.kcal / s.targetKcal) * 100) : 0;
  const items = [
    { icon: <Utensils size={14} />, text: `${kcal(s.total.kcal)} kcal yedin`, tone: 'text-teal' },
    { icon: <GlassWater size={14} />, text: `${ml(s.beverages.totalMl)} içtin`, tone: 'text-water' },
    { icon: <Dumbbell size={14} />, text: s.activity.exerciseMin ? `${int(s.activity.exerciseMin)} dk hareket` : s.activity.steps ? `${int(s.activity.steps)} adım` : 'hareket yok', tone: 'text-leaf' },
    { icon: <Flame size={14} />, text: `hedef: %${pct}`, tone: pct > 100 ? 'text-danger' : 'text-ink' },
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Günlük durum">
      {items.map((i) => (
        <span key={i.text} className={cx('num inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold shadow-card', i.tone)}>
          {i.icon}
          {i.text}
        </span>
      ))}
    </div>
  );
}

function CalorieCard({ s }: { s: DaySummary }) {
  const remaining = s.remainingKcal;
  const rows: Array<[string, string, string?]> = [
    ['Günlük temel hedef', `${kcal(s.baseKcal)} kcal`],
    ['Aktiviteden eklenen', `+${kcal(s.activity.addedToTarget)} kcal`, 'text-leaf'],
    ['Güncellenmiş hedef', `${kcal(s.targetKcal)} kcal`, 'font-bold'],
    ['Yenen (yemek + içecek)', `${kcal(s.food.kcal)} + ${kcal(s.drinks.kcal)} kcal`],
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center">
        <Ring value={s.total.kcal} max={s.targetKcal} extra={s.activity.addedToTarget} size={176} stroke={15}>
          <span className="text-[12px] font-semibold text-muted">{remaining >= 0 ? 'Kalan' : 'Hedef aşıldı'}</span>
          <span className={cx('num text-[34px] font-extrabold leading-none', remaining < 0 && 'text-danger')}>{kcal(Math.abs(remaining))}</span>
          <span className="text-[12px] text-muted">kcal</span>
        </Ring>
        <div className="w-full min-w-0 flex-1">
          <dl className="num divide-y divide-line/70 text-[14px]">
            {rows.map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between gap-2 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className={cx('text-right font-semibold', c)}>{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 py-2">
              <dt className="font-semibold">Kalan</dt>
              <dd className={cx('text-right text-[16px] font-extrabold', remaining < 0 ? 'text-danger' : 'text-teal')}>
                {remaining < 0 ? '−' : ''}
                {kcal(Math.abs(remaining))} kcal
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}

function MacroCard({ s }: { s: DaySummary }) {
  const m = [
    { label: 'Protein', v: s.total.protein, t: s.macros.proteinG, color: 'bg-pro', text: 'text-pro' },
    { label: 'Karbonhidrat', v: s.total.carb, t: s.macros.carbG, color: 'bg-carb', text: 'text-carb' },
    { label: 'Yağ', v: s.total.fat, t: s.macros.fatG, color: 'bg-fat', text: 'text-fat' },
  ];
  return (
    <Card>
      <div className="grid grid-cols-3 gap-4 p-4">
        {m.map((x) => (
          <div key={x.label} className="min-w-0">
            <div className={cx('text-[12px] font-bold', x.text)}>{x.label}</div>
            <div className="num mt-0.5 text-[17px] font-bold">
              {Math.round(x.v)}
              <span className="text-[12px] font-semibold text-muted"> / {x.t} g</span>
            </div>
            <ProgressBar value={x.v} max={x.t} color={x.color} className="mt-1.5" />
          </div>
        ))}
      </div>
      <p className="num border-t border-line/70 px-4 py-2 text-[12px] text-muted">
        Lif: {g1(s.total.fiber)} g{s.total.fiberUnknown ? ` (${s.total.fiberUnknown} kayıtta bilinmiyor)` : ''} · Hedef dağılım %{s.goal.proteinPct}/%{s.goal.carbPct}/%{s.goal.fatPct}
      </p>
    </Card>
  );
}

function foodForEntry(e: MealEntry, found?: Food): Food {
  return (
    found ?? {
      id: e.foodId ?? `entry:${e.id}`,
      name: e.name,
      aliases: [],
      categoryId: 'kisisel',
      cuisine: 'tr',
      basis: e.basis,
      per100: e.per100,
      servings: [],
      source: e.source,
      confidence: 'medium',
      isUser: false,
      createdAt: 0,
      updatedAt: 0,
    }
  );
}

function MealCard({ meal, entries }: { meal: MealDef; entries: MealEntry[] }) {
  const { open, date, toast } = useApp();
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const [menu, setMenu] = useState<'none' | 'save' | 'apply'>('none');
  const [tplName, setTplName] = useState('');
  const total = entries.reduce((s, e) => s + e.totals.kcal, 0);
  const yesterday = addDays(date, -1);

  const edit = async (e: MealEntry) => {
    const f = e.foodId ? await repo.getFood(e.foodId) : undefined;
    open({ kind: 'portion', food: foodForEntry(e, f), entry: e });
  };

  return (
    <Card>
      <CardHeader
        title={meal.name}
        sub={entries.length ? `${entries.length} kayıt` : undefined}
        right={<span className="num text-[15px] font-bold">{kcal(total)} kcal</span>}
      />
      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-line/60 px-4">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => edit(e)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.name}</span>
                  <span className="num block truncate text-[12.5px] text-muted">
                    {e.servingLabel} · {hhmm(e.time)}
                    {e.photoId ? ' · fotoğraflı' : ''}
                  </span>
                </span>
                <span className="num shrink-0 text-[14px] font-semibold">{kcal(e.totals.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-2">
        <Button size="sm" variant="soft" onClick={() => open({ kind: 'foodSearch', mealId: meal.id })}>
          <Plus size={16} /> Ekle
        </Button>
        {meal.id !== '__other' && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const n = await repo.copyMeal(yesterday, meal.id, date, meal.id);
                toast(n ? `Dünden ${n} kayıt kopyalandı` : `Dün ${meal.name.toLocaleLowerCase('tr')} kaydı yok`);
              }}
            >
              <Copy size={15} /> Dünden kopyala
            </Button>
            {entries.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMenu(menu === 'save' ? 'none' : 'save')}>
                <BookmarkPlus size={15} /> Şablon
              </Button>
            )}
            {templates.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMenu(menu === 'apply' ? 'none' : 'apply')}>
                <LayoutTemplate size={15} /> Şablon uygula
              </Button>
            )}
          </>
        )}
      </div>
      {menu === 'save' && (
        <form
          className="flex gap-2 px-4 pb-4"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!tplName.trim()) return;
            await repo.saveTemplate(tplName.trim(), date, meal.id);
            toast('Öğün şablon olarak kaydedildi');
            setTplName('');
            setMenu('none');
          }}
        >
          <TextInput value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Şablon adı (ör. Hafta içi kahvaltım)" aria-label="Şablon adı" autoFocus />
          <Button type="submit">Kaydet</Button>
        </form>
      )}
      {menu === 'apply' && (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {templates.map((t) => (
            <Chip
              key={t.id}
              onClick={async () => {
                const n = await repo.applyTemplate(t.id, date, meal.id);
                toast(`${t.name}: ${n} kayıt eklendi`);
                setMenu('none');
              }}
            >
              {t.name}
            </Chip>
          ))}
        </div>
      )}
    </Card>
  );
}


function DrinksCard({ s, entries }: { s: DaySummary; entries: import('../../db/types').BeverageEntry[] }) {
  const { open, date, toast } = useApp();
  const settings = useSettings();
  const bevs = useAllBeverages();
  const favs = useFavorites();
  const b = s.beverages;
  const meals = settings?.meals ?? repo.DEFAULT_MEALS;
  const bevById = useMemo(() => new Map(bevs.map((x) => [x.id, x])), [bevs]);
  const quick = (settings?.quickDrinks ?? []).map((q) => ({ ...q, bev: bevById.get(q.beverageId) ?? BUILTIN_BEVERAGE_MAP.get(q.beverageId) })).filter((q) => q.bev);
  const favDrinks = favs.filter((f) => f.kind === 'beverage' && bevById.has(f.refId)).slice(0, 4);

  const quickAdd = async (beverageId: string, mlv: number, addons?: { sugarG: number; milkMl: number }) => {
    const bev = bevById.get(beverageId);
    if (!bev) return;
    const e = await repo.logBeverage({ beverage: bev, baseMl: mlv, addons, date });
    toast(`${bev.name} · ${ml(e.ml)} eklendi`, { label: 'Geri al', run: () => repo.deleteBeverageEntry(e.id) });
  };

  const groups = GROUP_ORDER.filter((g) => b.byGroup[g] > 0);
  const caffeineLimit = s.goal.caffeineLimitMg;
  return (
    <Card>
      <CardHeader title="Su ve içecekler" icon={<GlassWater size={18} className="text-water" />} right={<Button size="sm" variant="soft" onClick={() => open({ kind: 'beverage' })}><Plus size={16} /> İçecek</Button>} />
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <div className="min-w-0 rounded-2xl bg-[rgb(var(--water)/0.10)] px-3 py-2.5">
          <div className="text-[12px] font-bold text-water">Saf su</div>
          <div className="num text-[19px] font-extrabold leading-tight">{ml(b.pureWaterMl)}</div>
          <div className="num text-[11.5px] text-muted">hedef {ml(s.goal.waterMl)}</div>
          <ProgressBar value={b.pureWaterMl} max={s.goal.waterMl} color="bg-water" className="mt-1.5 h-1.5" />
        </div>
        <div className="min-w-0 rounded-2xl bg-sunk px-3 py-2.5">
          <div className="text-[12px] font-bold text-teal">Toplam içecek</div>
          <div className="num text-[19px] font-extrabold leading-tight">{ml(b.totalMl)}</div>
          <div className="num text-[11.5px] text-muted">hedef {ml(s.goal.fluidMl)}</div>
          <ProgressBar value={b.totalMl} max={s.goal.fluidMl} className="mt-1.5 h-1.5" />
        </div>
        <div className="min-w-0 rounded-2xl bg-sunk px-3 py-2.5">
          <div className="text-[12px] font-bold text-carb">İçecek kalorisi</div>
          <div className="num text-[19px] font-extrabold leading-tight">{kcal(b.kcal)}</div>
          <div className="num text-[11.5px] text-muted">kcal · şeker {g1(b.sugarG)} g</div>
        </div>
      </div>

      {b.totalMl > 0 && (
        <div className="px-4 pt-3">
          <div className="flex h-3 overflow-hidden rounded-full bg-sunk" role="img" aria-label="İçecek türlerine göre dağılım">
            {groups.map((g) => (
              <div key={g} style={{ width: `${(b.byGroup[g] / b.totalMl) * 100}%`, background: GROUP_COLOR[g].fill }} title={`${GROUP_LABEL[g]}: ${ml(b.byGroup[g])}`} />
            ))}
          </div>
          <ul className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            {groups.map((g) => (
              <li key={g} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[g].fill }} />
                <span className="text-muted">{GROUP_LABEL[g]}</span>
                <b>{ml(b.byGroup[g])}</b>
                <span className="text-muted">%{Math.round((b.byGroup[g] / b.totalMl) * 100)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {quick.map((q) => (
          <button key={q.id} type="button" onClick={() => quickAdd(q.beverageId, q.ml)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold hover:border-teal hover:bg-sunk">
            <DrinkIcon group={groupOf(q.bev!.type)} size={16} />+{q.label ?? `${q.ml} ml ${q.bev!.name.split(' (')[0].toLocaleLowerCase('tr')}`}
          </button>
        ))}
        {favDrinks.map((f) => {
          const bev = bevById.get(f.refId)!;
          return (
            <button key={f.id} type="button" onClick={() => quickAdd(f.refId, f.preset?.ml ?? bev.defaultMl, f.preset?.addons)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-carb/40 px-3 text-[13px] font-semibold hover:bg-sunk">
              <DrinkIcon group={groupOf(bev.type)} size={16} />
              {f.label}
            </button>
          );
        })}
      </div>

      {settings?.caffeineTracking !== false && (
        <div className="mx-4 mt-3 rounded-2xl bg-[rgb(var(--coffee)/0.08)] px-3 py-2.5 text-[13px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-bold text-coffee">Kafein: {caffeineText(b.caffeine)}</span>
            {b.caffeine.lastCaffeineTime && <span className="num text-muted">son: {hhmm(b.caffeine.lastCaffeineTime)}</span>}
          </div>
          <div className="num mt-0.5 text-muted">
            Kahve {Math.round(b.caffeine.coffeeMg)} mg · Çay {Math.round(b.caffeine.teaMg)} mg · Diğer {Math.round(b.caffeine.otherMg)} mg
            {caffeineLimit ? ` · hedef ≤ ${caffeineLimit} mg` : ''}
          </div>
          {!b.caffeine.complete && <div className="mt-1 text-warn">{b.caffeine.unknownCount} kayıtta kafein bilinmiyor; toplam bu kayıtları içermez.</div>}
          {caffeineLimit && b.caffeine.knownMg > caffeineLimit && <div className="mt-1 text-warn">Belirlediğin kafein hedefinin üzerindesin. (Genel bilgi; sağlıklı yetişkinler için sık anılan üst sınır günlük ~400 mg’dır.)</div>}
        </div>
      )}

      {entries.length > 0 ? (
        <ul className="mt-2 divide-y divide-line/60 px-4 pb-2">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => open({ kind: 'beverage', entry: e })} className="flex w-full items-center gap-3 py-2 text-left">
                <DrinkIcon group={groupOf(e.type)} size={16} boxed />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{e.name}</span>
                  <span className="num block truncate text-[12px] text-muted">
                    {hhmm(e.time)} · {BEVERAGE_TYPES[e.type].label}
                    {e.addons.sugarG ? ` · ${e.addons.sugarG / 5} şeker` : ''}
                    {e.addons.milkMl ? ` · ${e.addons.milkMl} ml süt` : ''}
                    {e.mealId ? ` · ${meals.find((m) => m.id === e.mealId)?.name ?? ''}` : ''}
                  </span>
                </span>
                <span className="num shrink-0 text-right text-[13px]">
                  <b>{ml(e.ml)}</b>
                  <span className="block text-[11.5px] text-muted">{kcal(e.totals.kcal)} kcal</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 pt-3 text-[13px] text-muted">Henüz içecek yok. Yukarıdaki düğmelerle tek dokunuşta ekleyebilirsin.</p>
      )}
    </Card>
  );
}

function ActivityCard({ s }: { s: DaySummary }) {
  const { open, date, toast } = useApp();
  const day = useDay(date);
  const a = s.activity;
  const manualSteps = day?.steps.find((x) => x.source === 'manual')?.steps ?? null;
  const [steps, setSteps] = useState<number | null>(null);
  const shown = steps ?? manualSteps;
  return (
    <Card>
      <CardHeader title="Günlük aktivite" icon={<Footprints size={18} className="text-leaf" />} right={<Button size="sm" variant="soft" onClick={() => open({ kind: 'activity' })}><Plus size={16} /> Aktivite</Button>} />
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <StatTile label="Adım" value={int(a.steps)} sub={a.stepSource === 'health' ? 'sağlık verisi' : a.stepSource === 'manual' ? 'manuel' : 'girilmedi'} />
        <StatTile label="Egzersiz" value={`${int(a.exerciseMin)} dk`} sub={`brüt ${kcal(a.exerciseGrossKcal)} kcal`} />
        <StatTile label="Ek harcama" value={`${kcal(a.totalExtraKcal)}`} sub="kcal (net, tahmini)" accent="text-leaf" />
      </div>
      <form
        className="flex items-end gap-2 px-4 pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await repo.setSteps(date, shown ?? 0, 'manual');
          setSteps(null);
          toast('Adım sayısı kaydedildi');
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-semibold text-muted">Adım sayısı (manuel)</span>
          <NumberInput value={shown} onChange={setSteps} placeholder="ör. 8500" min={0} ariaLabel="Adım sayısı" />
        </label>
        <Button type="submit" variant="outline">
          Kaydet
        </Button>
      </form>
      <div className="num space-y-1 px-4 pt-3 text-[13px]">
        <div className="flex justify-between">
          <span className="text-muted">Egzersiz (net)</span>
          <span className="font-semibold">{kcal(a.exerciseNetKcal)} kcal</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">
            Ek adım: {int(a.extraSteps)} <span className="text-[11.5px]">(taban {int(a.stepBaseline)}{a.stepsInExercises ? `, egzersiz adımı ${int(a.stepsInExercises)}` : ''} düşüldü)</span>
          </span>
          <span className="shrink-0 font-semibold">{kcal(a.extraStepsNetKcal)} kcal</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-semibold">Hedefe yansıtılan</span>
          <span className="font-bold text-leaf">+{kcal(a.addedToTarget)} kcal</span>
        </div>
      </div>
      <div className="px-4 pt-2">
        <Segmented
          size="sm"
          value={a.allowancePct}
          onChange={async (v: AllowancePct) => {
            await repo.setAllowance(v);
            toast(`Aktivite kalorisinin %${v}’i bugünden itibaren hedefe eklenecek`);
          }}
          options={[
            { value: 0, label: '%0' },
            { value: 50, label: '%50' },
            { value: 100, label: '%100' },
          ]}
        />
      </div>
      {a.duplicates.length > 0 && <p className="px-4 pt-2 text-[12px] text-warn">{a.duplicates.length} aktivite, manuel kayıtla çakıştığı için tekrar sayılmadı.</p>}
      {day && day.activities.length > 0 ? (
        <ul className="mt-2 divide-y divide-line/60 px-4 pb-2">
          {day.activities.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => open({ kind: 'activity', entry: x })} className="flex w-full items-center gap-3 py-2 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leafsoft text-leaf">
                  <Dumbbell size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{x.name}</span>
                  <span className="num block text-[12px] text-muted">
                    {hhmm(x.time)} · {x.durationMin} dk · {ACTIVITIES[x.type].intensityHint[x.intensity]}
                    {x.distanceKm ? ` · ${g1(x.distanceKm)} km` : ''}
                  </span>
                </span>
                <span className="num shrink-0 text-right text-[13px]">
                  <b>{kcal(x.netKcal)}</b>
                  <span className="block text-[11.5px] text-muted">net kcal</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 pt-3 text-[12px] text-muted">Aktivite kalorileri tahmindir. Aktivite düzeyin günlük yaşamı zaten içerir; burada yalnızca ek hareket hedefe eklenir.</p>
      )}
    </Card>
  );
}

function WeightMini() {
  const { open } = useApp();
  const last = useLiveQuery(() => db.weights.orderBy('date').reverse().filter((w) => w.weightKg !== null).first(), []);
  return (
    <Card>
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tealsoft text-teal">
          <Scale size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-muted">Son kilo</div>
          <div className="num font-bold">{last ? `${g1(last.weightKg)} kg · ${shortDateTR(last.date)}` : 'Henüz ölçüm yok'}</div>
        </div>
        <Button size="sm" variant="soft" onClick={() => open({ kind: 'weight' })}>
          <Plus size={16} /> Kilo
        </Button>
      </div>
    </Card>
  );
}
