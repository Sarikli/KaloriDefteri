import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Beverage, BeverageEntry } from '../../db/types';
import * as repo from '../../db/repo';
import { BEVERAGE_TYPES, calcBeverageEntry, groupOf, GROUP_LABEL, isPureWater, type BeverageGroup } from '../../engine/beverage';
import { hhmm, timeOnDate, toDateKey } from '../../engine/dates';
import { search } from '../../engine/search';
import { useAllBeverages, useFavorites, useSettings } from '../hooks';
import { useApp } from '../store';
import { g1, kcal, ml } from '../format';
import { Button, Chip, Field, Note, NumberInput, Sheet, SourceBadge, Stepper, TextInput } from '../components/ui';
import { MealPicker, TimeInput } from '../components/shared';
import { DrinkIcon, GROUP_ORDER } from '../components/drink';
import { FavStar } from '../components/FoodBrowser';


export function BeverageSheet({ beverage, entry, presetMl, mealId }: { beverage?: Beverage; entry?: BeverageEntry; presetMl?: number; mealId?: string }) {
  const { close } = useApp();
  const all = useAllBeverages();
  const [picked, setPicked] = useState<Beverage | undefined>(() => {
    if (beverage) return beverage;
    if (entry) {
      const found = all.find((b) => b.id === entry.beverageId);
      return (
        found ?? {
          id: entry.beverageId,
          name: entry.name,
          aliases: [],
          type: entry.type,
          per100ml: entry.per100ml,
          caffeinePer100ml: entry.caffeinePer100ml,
          defaultMl: entry.baseMl,
          servings: [],
          source: 'user',
          confidence: 'medium',
          isUser: true,
          createdAt: 0,
          updatedAt: 0,
        }
      );
    }
    return undefined;
  });
  if (!picked) return <BeveragePicker onPick={setPicked} onClose={close} />;
  return <BeverageForm bev={picked} entry={entry} presetMl={presetMl} mealId={mealId} onBack={beverage || entry ? undefined : () => setPicked(undefined)} />;
}

function BeveragePicker({ onPick, onClose }: { onPick: (b: Beverage) => void; onClose: () => void }) {
  const all = useAllBeverages();
  const { open } = useApp();
  const [q, setQ] = useState('');
  const list = useMemo(() => (q ? search(all, q) : all), [all, q]);
  const grouped = useMemo(() => {
    const m = new Map<BeverageGroup, Beverage[]>();
    for (const b of list) {
      const g = groupOf(b.type);
      m.set(g, [...(m.get(g) ?? []), b]);
    }
    return GROUP_ORDER.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [list]);
  return (
    <Sheet title="İçecek ekle" onClose={onClose}>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: çay, ayran, latte…" aria-label="İçecek ara" className="h-12 w-full rounded-2xl border border-line bg-surface pl-10 pr-3 focus:border-teal focus:outline-none" />
      </div>
      <div className="mt-4 space-y-5">
        {grouped.map(([g, items]) => (
          <div key={g}>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
              <DrinkIcon group={g} size={16} /> {GROUP_LABEL[g]}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((b) => (
                <button key={b.id} type="button" onClick={() => onPick(b)} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left transition hover:border-teal hover:bg-sunk">
                  <DrinkIcon group={g} boxed />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="num block text-[12px] text-muted">
                      {kcal(b.per100ml.kcal)} kcal/100 ml{b.isUser ? ' · kişisel' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button variant="soft" className="mt-5 w-full" onClick={() => open({ kind: 'customBeverage' })}>
        <Plus size={18} /> Kendi içeceğini oluştur
      </Button>
    </Sheet>
  );
}

function BeverageForm({ bev, entry, presetMl, mealId, onBack }: { bev: Beverage; entry?: BeverageEntry; presetMl?: number; mealId?: string; onBack?: () => void }) {
  const { close, closeAll, date, toast } = useApp();
  const settings = useSettings();
  const favs = useFavorites();
  const meals = settings?.meals ?? repo.DEFAULT_MEALS;
  const group = groupOf(bev.type);
  const [baseMl, setBaseMl] = useState<number>(entry?.baseMl ?? presetMl ?? bev.defaultMl);
  const [sugarCubes, setSugarCubes] = useState<number>(entry ? entry.addons.sugarG / 5 : 0);
  const [milkMl, setMilkMl] = useState<number>(entry?.addons.milkMl ?? 0);
  const [time, setTime] = useState(entry ? hhmm(entry.time) : date === toDateKey() ? hhmm(Date.now()) : '12:00');
  const [meal, setMeal] = useState<string | undefined>(entry?.mealId ?? mealId);
  const [note, setNote] = useState(entry?.note ?? '');
  const snapshotCaffeine = entry ? entry.caffeinePer100ml : bev.caffeinePer100ml;
  const [caffeineKnown, setCaffeineKnown] = useState<number | null>(snapshotCaffeine);

  const per100ml = entry ? entry.per100ml : bev.per100ml;
  const addons = { sugarG: sugarCubes * 5, milkMl };
  const calc = calcBeverageEntry({ per100ml, caffeinePer100ml: caffeineKnown }, baseMl, addons);
  const showAddons = group === 'coffee' || group === 'tea';
  const showSugar = showAddons || bev.type === 'diger' || bev.type === 'smoothie';
  const favPreset = { ml: baseMl, addons };
  const isFav = favs.some((f) => f.refId === bev.id && f.preset?.ml === baseMl && (f.preset?.addons?.sugarG ?? 0) === addons.sugarG && (f.preset?.addons?.milkMl ?? 0) === addons.milkMl);

  const save = async () => {
    if (baseMl <= 0) return;
    const d = entry?.date ?? date;
    if (entry) {
      await repo.updateBeverageEntry(entry.id, { baseMl, addons, time: timeOnDate(d, time), note, mealId: meal ?? null, caffeinePer100ml: caffeineKnown });
      toast('İçecek güncellendi');
    } else {
      const e = await repo.logBeverage({ beverage: { ...bev, caffeinePer100ml: caffeineKnown }, baseMl, addons, date: d, time: timeOnDate(d, time), mealId: meal, note: note || undefined });
      toast(`${bev.name} · ${ml(e.ml)} eklendi`, { label: 'Geri al', run: () => repo.deleteBeverageEntry(e.id) });
    }
    closeAll();
  };

  const remove = async () => {
    if (!entry) return;
    const e = await repo.deleteBeverageEntry(entry.id);
    toast('İçecek silindi', e ? { label: 'Geri al', run: () => repo.restoreBeverageEntry(e) } : undefined);
    close();
  };

  return (
    <Sheet
      title={entry ? 'İçeceği düzenle' : bev.name}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {entry && (
            <Button variant="danger" onClick={remove} aria-label="İçeceği sil">
              <Trash2 size={18} />
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Geri
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={save} disabled={baseMl <= 0}>
            {entry ? 'Kaydet' : 'Ekle'} · {ml(calc.ml)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <DrinkIcon group={group} boxed size={22} />
          <div className="min-w-0 flex-1">
            {entry && <p className="font-bold">{entry.name}</p>}
            <p className="text-[13px] text-muted">
              {BEVERAGE_TYPES[bev.type].label} · {isPureWater(bev.type) ? 'saf suya ve toplam sıvıya eklenir' : 'toplam sıvıya eklenir, saf suya eklenmez'}
            </p>
            <div className="mt-1">
              <SourceBadge source={bev.source} confidence={bev.confidence} />
            </div>
          </div>
          {!entry && <FavStar active={isFav} onToggle={() => repo.toggleFavorite('beverage', bev.id, `${bev.name} ${ml(baseMl)}`, favPreset)} />}
        </div>

        {bev.servings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bev.servings.map((s) => (
              <Chip key={s.label} active={baseMl === s.ml} onClick={() => setBaseMl(s.ml)}>
                {s.label} <span className="num font-normal opacity-75">{s.ml} ml</span>
              </Chip>
            ))}
          </div>
        )}
        <Field label="Miktar">
          <Stepper value={baseMl} onChange={setBaseMl} step={50} suffix="ml" ariaLabel="Miktar (ml)" />
        </Field>

        {showSugar && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Şeker (küp, ~5 g)">
              <Stepper value={sugarCubes} onChange={setSugarCubes} step={1} suffix="küp" ariaLabel="Şeker küp" />
            </Field>
            {showAddons && (
              <Field label="Süt (tam yağlı)">
                <Stepper value={milkMl} onChange={setMilkMl} step={25} suffix="ml" ariaLabel="Süt ml" />
              </Field>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-sunk p-3 text-center">
          <div>
            <div className="text-[12px] font-semibold text-muted">Kalori</div>
            <div className="num text-[20px] font-extrabold">{kcal(calc.totals.kcal)}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-muted">Şeker</div>
            <div className="num text-[20px] font-extrabold">{calc.totals.sugar === null ? '—' : `${g1(calc.totals.sugar)} g`}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-muted">Kafein</div>
            <div className="num text-[20px] font-extrabold">{calc.caffeineMg === null ? '?' : `${Math.round(calc.caffeineMg)} mg`}</div>
          </div>
        </div>
        {caffeineKnown === null ? (
          <Note tone="warn">
            Bu içeceğin kafein değeri bilinmiyor; toplamlara sıfır olarak eklenmez, “bilinmiyor” olarak işaretlenir. Biliyorsan gir:
            <NumberInput className="mt-2" value={null} onChange={(v) => v !== null && setCaffeineKnown(v)} suffix="mg/100 ml" ariaLabel="Kafein mg/100 ml" />
          </Note>
        ) : (
          (bev.caffeineNote || caffeineKnown > 0) && (
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="min-w-0 flex-1">{bev.caffeineNote ?? 'Kafein değeri demleme, çekirdek ve porsiyona göre değişir.'}</span>
              <NumberInput className="w-36 shrink-0" value={caffeineKnown} onChange={(v) => setCaffeineKnown(v)} suffix="mg/100ml" ariaLabel="Kafein mg/100 ml" />
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Saat">
            <TimeInput value={time} onChange={setTime} />
          </Field>
          <Field label="Not">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
          </Field>
        </div>
        <Field label="Öğüne bağla (isteğe bağlı)" hint="Bağlansa da içecek kalorisi yalnızca bir kez sayılır.">
          <MealPicker meals={meals} value={meal} onChange={setMeal} allowNone />
        </Field>
      </div>
    </Sheet>
  );
}
