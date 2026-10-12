import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { Food, FoodServing, MealEntry } from '../../db/types';
import * as repo from '../../db/repo';
import { CATEGORY_NAME } from '../../data/categories';
import { servingsFor } from '../../engine/portion';
import { scale } from '../../engine/nutrition';
import { addDays, hhmm, timeOnDate, toDateKey } from '../../engine/dates';
import { useAllFoods, useFavorites, useSettings } from '../hooks';
import { useApp } from '../store';
import { kcal } from '../format';
import { Button, Chip, Field, Note, NumberInput, Sheet, SourceBadge, Stepper, TextInput } from '../components/ui';
import { defaultMealFor, MealPicker, NutrientSummary, TimeInput } from '../components/shared';
import { FavStar } from '../components/FoodBrowser';

export function PortionSheet({ food, mealId, entry, photoId }: { food: Food; mealId?: string; entry?: MealEntry; photoId?: string }) {
  const { close, closeAll, date, toast, open, replace } = useApp();
  const settings = useSettings();
  const favs = useFavorites();
  const allFoods = useAllFoods();
  const userServings = useLiveQuery(() => repo.getUserServings(food.id), [food.id]) ?? [];
  const servings = useMemo(() => servingsFor(food, userServings), [food, userServings]);
  const baseUnit = servings.find((s) => s.unit === food.basis)!;
  const meals = settings?.meals ?? repo.DEFAULT_MEALS;

  const [servingId, setServingId] = useState<string>(() => (entry ? baseUnit.id : (servings.find((s) => s.isDefault) ?? servings[0]).id));
  const [count, setCount] = useState<number>(entry ? entry.amount : 1);
  const [meal, setMeal] = useState<string | undefined>(entry?.mealId ?? mealId);
  const [time, setTime] = useState(entry ? hhmm(entry.time) : date === toDateKey() ? hhmm(Date.now()) : '12:00');
  const [note, setNote] = useState(entry?.note ?? '');
  const [gramOverride, setGramOverride] = useState<number | null>(null);
  const [newServing, setNewServing] = useState<{ label: string; amount: number | null } | null>(null);

  const chosenMeal = meal ?? defaultMealFor(meals);
  const serving: FoodServing = useMemo(() => {
    const s = servings.find((x) => x.id === servingId) ?? servings[0];
    return gramOverride !== null && s.unit !== food.basis ? { ...s, amount: gramOverride } : s;
  }, [servings, servingId, gramOverride, food.basis]);
  const amount = serving.amount * count;
  const per100 = entry ? entry.per100 : food.per100;
  const totals = scale(per100, amount);
  const isFav = favs.some((f) => f.refId === food.id && f.kind === 'food');

  const base = food.variantOf ?? food.id;
  const variants = allFoods.filter((f) => f.id !== food.id && (f.variantOf === base || f.id === base));

  const choose = (s: FoodServing) => {
    setServingId(s.id);
    setGramOverride(null);
    setCount(s.unit === 'g' || s.unit === 'ml' ? Math.round(amount) || 100 : 1);
  };

  const save = async () => {
    if (amount <= 0) return;
    const entryDate = entry?.date ?? date;
    if (entry) {
      await repo.updateMealEntry(entry.id, { serving, count, mealId: chosenMeal, time: timeOnDate(entryDate, time), note });
      toast('Kayıt güncellendi');
    } else {
      const e = await repo.logFood({ food, serving, count, date: entryDate, mealId: chosenMeal, time: timeOnDate(entryDate, time), note: note || undefined, photoId });
      toast(`${food.name} eklendi · ${kcal(e.totals.kcal)} kcal`, { label: 'Geri al', run: () => repo.deleteMealEntry(e.id) });
    }
    closeAll();
  };

  const remove = async () => {
    if (!entry) return;
    const e = await repo.deleteMealEntry(entry.id);
    toast('Kayıt silindi', e ? { label: 'Geri al', run: () => repo.restoreMealEntry(e) } : undefined);
    close();
  };

  const copyTo = async (d: string) => {
    if (!entry) return;
    await repo.copyEntry(entry.id, d);
    toast(d === toDateKey() ? 'Bugüne kopyalandı' : 'Kopyalandı');
  };

  return (
    <Sheet
      title={entry ? 'Kaydı düzenle' : food.name}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {entry && (
            <Button variant="danger" onClick={remove} aria-label="Kaydı sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={save} disabled={amount <= 0}>
            {entry ? 'Kaydet' : 'Günlüğe ekle'} · {kcal(totals.kcal)} kcal
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {entry && <p className="text-lg font-bold">{entry.name}</p>}
            <p className="text-[13px] text-muted">
              {CATEGORY_NAME[food.categoryId] ?? 'Kişisel'}
              {food.brand ? ` · ${food.brand}` : ''} · 100 {food.basis}: {kcal(per100.kcal)} kcal
            </p>
            <div className="mt-1.5">
              <SourceBadge source={entry ? entry.source : food.source} confidence={food.confidence} note={food.sourceNote} />
            </div>
          </div>
          {!entry && <FavStar active={isFav} onToggle={() => repo.toggleFavorite('food', food.id, food.name)} />}
        </div>
        {entry && <Note>Bu kayıt, eklendiği andaki besin değerlerini kullanır; yemek sonradan düzenlense de bu kayıt değişmez.</Note>}
        {food.sourceNote && !entry && food.confidence !== 'high' && <p className="text-[12px] text-muted">{food.sourceNote}</p>}

        <Field label="Ölçü">
          <div className="flex flex-wrap gap-2">
            {servings.map((s) => (
              <Chip key={s.id} active={s.id === servingId} onClick={() => choose(s)}>
                {s.label}
                {s.unit !== food.basis && <span className="num font-normal opacity-75">{s.amount} {food.basis}</span>}
              </Chip>
            ))}
            {!entry && (
              <Chip onClick={() => setNewServing({ label: '', amount: null })}>
                <Pencil size={14} /> Kişisel ölçü
              </Chip>
            )}
          </div>
        </Field>

        {newServing && (
          <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2 rounded-2xl bg-sunk p-3">
            <Field label="Ölçü adı">
              <TextInput value={newServing.label} placeholder="ör. Benim kasem" onChange={(e) => setNewServing({ ...newServing, label: e.target.value })} />
            </Field>
            <Field label={`Karşılığı (${food.basis})`}>
              <NumberInput value={newServing.amount} onChange={(v) => setNewServing({ ...newServing, amount: v })} />
            </Field>
            <Button
              disabled={!newServing.label.trim() || !newServing.amount}
              onClick={async () => {
                const s = await repo.saveUserServing(food.id, { unit: 'ozel', label: newServing.label.trim(), amount: newServing.amount! });
                setServingId(s.id);
                setCount(1);
                setNewServing(null);
                toast('Kişisel ölçü kaydedildi');
              }}
            >
              Kaydet
            </Button>
          </div>
        )}

        <Field label={serving.unit === food.basis ? `Miktar (${food.basis})` : 'Adet / çarpan'}>
          <Stepper value={count} onChange={setCount} step={serving.unit === food.basis ? 10 : 0.5} suffix={serving.unit === food.basis ? food.basis : '×'} ariaLabel="Miktar" />
        </Field>

        {serving.unit !== food.basis && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>{serving.label} =</span>
            <NumberInput className="w-24" value={serving.amount} onChange={(v) => setGramOverride(v ?? 0)} suffix={food.basis} ariaLabel="Ölçünün gram karşılığı" />
            {gramOverride !== null && (
              <Button
                size="sm"
                variant="soft"
                onClick={async () => {
                  await repo.saveUserServing(food.id, { id: servingId, unit: serving.unit, label: serving.label, amount: gramOverride });
                  setGramOverride(null);
                  toast('Bu ölçü senin için kaydedildi');
                }}
              >
                Bu ölçüyü hatırla
              </Button>
            )}
            <span className="num w-full">Toplam: {Math.round(amount)} {food.basis}</span>
          </div>
        )}

        <NutrientSummary n={totals} big />

        <Field label="Öğün">
          <MealPicker meals={meals} value={chosenMeal} onChange={(v) => setMeal(v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saat">
            <TimeInput value={time} onChange={setTime} />
          </Field>
          <Field label="Not">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
          </Field>
        </div>

        {variants.length > 0 && !entry && (
          <Field label="Tarif varyasyonları">
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <Chip key={v.id} onClick={() => replace({ kind: 'portion', food: v, mealId, photoId })}>
                  {v.variantLabel ?? v.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {entry && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copyTo(toDateKey())}>
              <Copy size={14} /> Bugüne kopyala
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyTo(addDays(entry.date, 1))}>
              <Copy size={14} /> Ertesi güne kopyala
            </Button>
          </div>
        )}
        {food.isUser && !entry && !food.recipeId && (
          <button type="button" className="text-[13px] font-semibold text-teal" onClick={() => open({ kind: 'customFood', food })}>
            Bu yemeği düzenle
          </button>
        )}
      </div>
    </Sheet>
  );
}
