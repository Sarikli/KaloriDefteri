import { useMemo, useState } from 'react';
import { ImagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import type { Basis, Beverage, BeverageIngredient, BeverageType, Food, Recipe, RecipeIngredient, ServingUnit } from '../../db/types';
import * as repo from '../../db/repo';
import { db } from '../../db/database';
import { CATEGORIES } from '../../data/categories';
import { BEVERAGE_TYPES, composeBeverage } from '../../engine/beverage';
import { computeRecipe } from '../../engine/recipe';
import { scale } from '../../engine/nutrition';
import { search } from '../../engine/search';
import { UNIT_LABEL } from '../../engine/portion';
import { BUILTIN_BEVERAGE_MAP } from '../../data/beverages';
import { BUILTIN_FOOD_MAP } from '../../data/foods';
import { useAllBeverages, useAllFoods } from '../hooks';
import { useApp } from '../store';
import { g1, kcal, ml } from '../format';
import { Button, Field, Note, NumberInput, Segmented, Select, Sheet, StatTile, TextInput } from '../components/ui';
import { NutrientSummary } from '../components/shared';

const UNIT_OPTIONS: ServingUnit[] = ['porsiyon', 'adet', 'dilim', 'kase', 'tabak', 'kepce', 'bardak', 'paket', 'yk', 'tk', 'g', 'ml'];

// ───────────────────────── Kişisel yemek ─────────────────────────

export function CustomFoodSheet({ food, barcode, logAfter, mealId, name: initialName }: { food?: Food; barcode?: string; logAfter?: boolean; mealId?: string; name?: string }) {
  const { close, replace, toast } = useApp();
  const def = food?.servings.find((s) => s.isDefault) ?? food?.servings[0];
  const per = (v: number | null | undefined) => (food && def && v !== null && v !== undefined ? Math.round(((v * def.amount) / 100) * 10) / 10 : null);
  const [name, setName] = useState(food?.name ?? initialName ?? '');
  const [category, setCategory] = useState(food?.categoryId ?? 'kisisel');
  const [mode, setMode] = useState<'quick' | 'full'>(food && (food.per100.protein || food.per100.carb || food.per100.fat) ? 'full' : 'quick');
  const [unit, setUnit] = useState<ServingUnit>(def?.unit ?? 'porsiyon');
  const [label, setLabel] = useState(def?.label ?? '');
  const [basis, setBasis] = useState<Basis>(food?.basis ?? 'g');
  const [amount, setAmount] = useState<number | null>(def?.amount ?? 100);
  const [kcalV, setKcal] = useState<number | null>(per(food?.per100.kcal));
  const [protein, setProtein] = useState<number | null>(per(food?.per100.protein));
  const [carb, setCarb] = useState<number | null>(per(food?.per100.carb));
  const [fat, setFat] = useState<number | null>(per(food?.per100.fat));
  const [fiber, setFiber] = useState<number | null>(per(food?.per100.fiber));
  const [desc, setDesc] = useState(food?.description ?? '');
  const [imageId, setImageId] = useState<string | undefined>(food?.imageId);
  const [error, setError] = useState('');

  const unitIsBase = unit === 'g' || unit === 'ml';
  const servingAmount = unitIsBase ? 100 : amount;

  const save = async () => {
    if (!name.trim()) return setError('Yemek adı gerekli.');
    if (kcalV === null || kcalV < 0) return setError('Kalori gerekli.');
    if (!servingAmount || servingAmount <= 0) return setError('Porsiyon miktarı gerekli.');
    const f = servingAmount / 100;
    const saved = await repo.saveUserFood(
      {
        name,
        categoryId: category,
        basis: unitIsBase ? (unit as Basis) : basis,
        per100: {
          kcal: kcalV / f,
          protein: mode === 'full' ? (protein ?? 0) / f : 0,
          carb: mode === 'full' ? (carb ?? 0) / f : 0,
          fat: mode === 'full' ? (fat ?? 0) / f : 0,
          fiber: mode === 'full' && fiber !== null ? fiber / f : null,
          sugar: null,
        },
        serving: { unit, label: label.trim() || (unitIsBase ? `100 ${unit}` : `1 ${UNIT_LABEL[unit]}`), amount: servingAmount },
        description: desc || undefined,
        barcode,
        imageId,
        source: food?.source ?? 'user',
      },
      food?.id,
    );
    toast(food ? 'Yemek güncellendi' : 'Kişisel yemek kaydedildi');
    if (logAfter) replace({ kind: 'portion', food: saved, mealId });
    else close();
  };

  return (
    <Sheet title={food ? 'Yemeği düzenle' : 'Kişisel yemek oluştur'} onClose={close} footer={<Button className="w-full" size="lg" onClick={save}>{logAfter ? 'Kaydet ve günlüğe ekle' : 'Kaydet'}</Button>}>
      <div className="space-y-4">
        <Field label="Yemek adı">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Annemin mantısı" autoFocus />
        </Field>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'quick', label: 'Hızlı: isim + kalori' },
            { value: 'full', label: 'Ayrıntılı' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ölçüm birimi">
            <Select value={unit} onChange={setUnit} options={UNIT_OPTIONS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} />
          </Field>
          {unitIsBase ? (
            <Field label="Değerler">
              <div className="flex h-11 items-center text-[14px] text-muted">100 {unit} başına</div>
            </Field>
          ) : (
            <Field label={`1 ${UNIT_LABEL[unit]} =`}>
              <div className="flex gap-2">
                <NumberInput className="flex-1" value={amount} onChange={setAmount} ariaLabel="Porsiyon miktarı" />
                <select aria-label="Birim" value={basis} onChange={(e) => setBasis(e.target.value as Basis)} className="h-11 rounded-xl border border-line bg-surface px-2">
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </Field>
          )}
        </div>
        {!unitIsBase && (
          <Field label="Porsiyon adı (isteğe bağlı)">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`1 ${UNIT_LABEL[unit]}`} />
          </Field>
        )}
        <Field label={unitIsBase ? `Kalori (100 ${unit})` : `Kalori (1 ${UNIT_LABEL[unit]})`}>
          <NumberInput value={kcalV} onChange={setKcal} suffix="kcal" min={0} ariaLabel="Kalori" />
        </Field>
        {mode === 'full' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Protein">
              <NumberInput value={protein} onChange={setProtein} suffix="g" min={0} ariaLabel="Protein" />
            </Field>
            <Field label="Karbonhidrat">
              <NumberInput value={carb} onChange={setCarb} suffix="g" min={0} ariaLabel="Karbonhidrat" />
            </Field>
            <Field label="Yağ">
              <NumberInput value={fat} onChange={setFat} suffix="g" min={0} ariaLabel="Yağ" />
            </Field>
            <Field label="Lif">
              <NumberInput value={fiber} onChange={setFiber} suffix="g" min={0} ariaLabel="Lif" />
            </Field>
          </div>
        )}
        {mode === 'full' && (
          <>
            <Field label="Kategori">
              <Select value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Açıklama">
              <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ör. 4 kişilik tencere, az yağlı" />
            </Field>
            <Field label="Görsel (isteğe bağlı)">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 text-[14px] text-muted hover:bg-sunk">
                <ImagePlus size={18} />
                {imageId ? 'Görsel eklendi — değiştir' : 'Görsel seç'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const id = repo.uid('img');
                    await db.photos.put({ id, blob: file, createdAt: Date.now() });
                    setImageId(id);
                  }}
                />
              </label>
            </Field>
          </>
        )}
        {barcode && <Note>Barkod: {barcode} — bu ürün sonraki taramalarda doğrudan bulunur.</Note>}
        {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
        {food && (
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await repo.archiveUserFood(food.id);
              toast('Yemek kütüphaneden kaldırıldı (geçmiş kayıtlar korunur)');
              close();
            }}
          >
            <Trash2 size={14} /> Kütüphaneden kaldır
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// ───────────────────────── Malzeme seçici ─────────────────────────

type Pickable = { id: string; name: string; aliases: string[]; basis: Basis; per100: Food['per100']; caffeine: number | null; liquid: boolean; kind: 'food' | 'beverage' };

function IngredientPicker({ onPick, onClose, drinksFirst }: { onPick: (p: Pickable) => void; onClose: () => void; drinksFirst?: boolean }) {
  const foods = useAllFoods();
  const bevs = useAllBeverages();
  const [q, setQ] = useState('');
  const items: Pickable[] = useMemo(() => {
    const f = foods.filter((x) => !x.recipeId).map((x) => ({ id: x.id, name: x.name, aliases: x.aliases, basis: x.basis, per100: x.per100, caffeine: 0, liquid: x.basis === 'ml', kind: 'food' as const }));
    const b = bevs.map((x) => ({ id: x.id, name: x.name, aliases: x.aliases, basis: 'ml' as const, per100: x.per100ml, caffeine: x.caffeinePer100ml, liquid: true, kind: 'beverage' as const }));
    return drinksFirst ? [...b, ...f] : [...f, ...b];
  }, [foods, bevs, drinksFirst]);
  const list = q ? search(items, q, { limit: 12 }) : [];
  return (
    <div className="rounded-2xl border border-teal/40 bg-sunk p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Malzeme ara: tavuk, pirinç, süt…" aria-label="Malzeme ara" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] focus:border-teal focus:outline-none" />
        </div>
        <button type="button" aria-label="Kapat" onClick={onClose} className="p-2 text-muted">
          <X size={18} />
        </button>
      </div>
      <ul className="mt-2 max-h-56 overflow-y-auto">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onPick(i)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[14px] hover:bg-surface">
              <span className="truncate">{i.name}</span>
              <span className="num shrink-0 text-[12px] text-muted">
                {kcal(i.per100.kcal)} kcal/100 {i.basis}
              </span>
            </button>
          </li>
        ))}
        {q && list.length === 0 && <li className="px-2 py-2 text-[13px] text-muted">Bulunamadı. Önce kişisel yemek olarak ekleyebilirsin.</li>}
      </ul>
    </div>
  );
}

// ───────────────────────── Tarif oluşturucu ─────────────────────────

export function RecipeSheet({ recipe }: { recipe?: Recipe }) {
  const { close, replace, toast } = useApp();
  const [name, setName] = useState(recipe?.name ?? '');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients ?? []);
  const [cooked, setCooked] = useState<number | null>(recipe?.cookedWeightG ?? null);
  const [servings, setServings] = useState<number | null>(recipe?.servings ?? 4);
  const [note, setNote] = useState(recipe?.note ?? '');
  const [picking, setPicking] = useState(ingredients.length === 0);
  const r = computeRecipe(ingredients, cooked, servings ?? 1);

  const save = async () => {
    if (!name.trim() || !ingredients.length) return;
    const saved = await repo.saveRecipe({ name, ingredients, cookedWeightG: cooked, servings: servings ?? 1, note: note || undefined }, recipe?.id);
    toast('Tarif kaydedildi');
    const food = await db.foods.get(saved.foodId);
    if (food && !recipe) replace({ kind: 'portion', food });
    else close();
  };

  return (
    <Sheet
      wide
      title={recipe ? 'Tarifi düzenle' : 'Tarif oluştur'}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {recipe && (
            <Button
              variant="danger"
              aria-label="Tarifi sil"
              onClick={async () => {
                await repo.deleteRecipe(recipe.id);
                toast('Tarif silindi (geçmiş kayıtlar korunur)');
                close();
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" size="lg" disabled={!name.trim() || !ingredients.length} onClick={save}>
            {recipe ? 'Kaydet' : 'Kaydet ve günlüğe ekle'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Tarif adı">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Fırında tavuklu pilav" />
        </Field>
        <div>
          <h3 className="mb-2 text-[13px] font-bold text-muted">Malzemeler (çiğ ağırlık)</h3>
          <ul className="space-y-2">
            {ingredients.map((ing, i) => (
              <li key={`${ing.refId}-${i}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{ing.name}</span>
                <NumberInput
                  className="w-28"
                  value={ing.amount}
                  onChange={(v) => setIngredients((list) => list.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))}
                  suffix={ing.basis}
                  ariaLabel={`${ing.name} miktarı`}
                />
                <span className="num w-20 text-right text-[13px] text-muted">{kcal(scale(ing.per100, ing.amount).kcal)} kcal</span>
                <button type="button" aria-label={`${ing.name} çıkar`} onClick={() => setIngredients((l) => l.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-danger">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          {picking ? (
            <div className="mt-2">
              <IngredientPicker
                onClose={() => setPicking(false)}
                onPick={(p) => {
                  setIngredients((l) => [...l, { kind: p.kind, refId: p.id, name: p.name, amount: 100, basis: p.basis, per100: p.per100 }]);
                  setPicking(false);
                }}
              />
            </div>
          ) : (
            <Button variant="soft" size="sm" className="mt-2" onClick={() => setPicking(true)}>
              <Plus size={16} /> Malzeme ekle
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pişmiş toplam ağırlık" hint={`Çiğ toplam: ${Math.round(r.rawWeight)} g. Boş bırakılırsa çiğ toplam kullanılır.`}>
            <NumberInput value={cooked} onChange={setCooked} suffix="g" min={0} ariaLabel="Pişmiş ağırlık" />
          </Field>
          <Field label="Porsiyon sayısı">
            <NumberInput value={servings} onChange={setServings} min={1} ariaLabel="Porsiyon sayısı" />
          </Field>
        </div>
        {ingredients.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Toplam" value={`${kcal(r.totals.kcal)}`} sub="kcal" />
              <StatTile label="100 g" value={`${kcal(r.per100.kcal)}`} sub="kcal" />
              <StatTile label="1 porsiyon" value={`${kcal(r.perServing.kcal)}`} sub={`kcal · ${Math.round(r.servingWeight)} g`} />
            </div>
            <div className="num grid grid-cols-3 gap-2 text-center text-[13px]">
              <div className="rounded-xl bg-sunk py-2">
                <span className="font-semibold text-pro">Protein</span>
                <br />
                {g1(r.totals.protein)} g · porsiyon {g1(r.perServing.protein)} g
              </div>
              <div className="rounded-xl bg-sunk py-2">
                <span className="font-semibold text-carb">Karbonhidrat</span>
                <br />
                {g1(r.totals.carb)} g · porsiyon {g1(r.perServing.carb)} g
              </div>
              <div className="rounded-xl bg-sunk py-2">
                <span className="font-semibold text-fat">Yağ</span>
                <br />
                {g1(r.totals.fat)} g · porsiyon {g1(r.perServing.fat)} g
              </div>
            </div>
            {r.weightChangePct !== null && (
              <p className="text-[13px] text-muted">
                Pişirmede ağırlık %{g1(Math.abs(r.weightChangePct))} {r.weightChangePct < 0 ? 'azaldı (su kaybı)' : 'arttı (su çekme)'}. Bu, 100 g başına değeri değiştirir; tarifin toplam enerjisi aynı kalır.
              </p>
            )}
            {r.warnings.map((w) => (
              <Note key={w} tone="warn">
                {w}
              </Note>
            ))}
            <Note>Pişirme sırasındaki besin kayıpları (ör. kızartmada yağ emilimi, haşlamada suya geçen besinler) hesaba katılmaz; sonuçlar tahminidir.</Note>
          </>
        )}
        <Field label="Not">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
        </Field>
      </div>
    </Sheet>
  );
}

// ───────────────────────── Kişisel içecek ─────────────────────────

const TYPE_OPTIONS = (Object.keys(BEVERAGE_TYPES) as BeverageType[]).map((t) => ({ value: t, label: BEVERAGE_TYPES[t].label }));

function ingFromBuiltin(id: string, amount: number): BeverageIngredient {
  const b = BUILTIN_BEVERAGE_MAP.get(id);
  if (b) return { kind: 'beverage', refId: b.id, name: b.name, amount, basis: 'ml', per100: b.per100ml, caffeinePer100: b.caffeinePer100ml, addsVolume: true };
  const f = BUILTIN_FOOD_MAP.get(id)!;
  return { kind: 'food', refId: f.id, name: f.name, amount, basis: 'g', per100: f.per100, caffeinePer100: 0, addsVolume: false };
}

export function CustomBeverageSheet({ beverage }: { beverage?: Beverage }) {
  const { close, toast, replace } = useApp();
  const [name, setName] = useState(beverage?.name ?? 'Benim kahvem');
  const [type, setType] = useState<BeverageType>(beverage?.type ?? 'filtre_kahve');
  const [mode, setMode] = useState<'mix' | 'values'>(beverage && !beverage.ingredients?.length ? 'values' : 'mix');
  const [ings, setIngs] = useState<BeverageIngredient[]>(beverage?.ingredients ?? [ingFromBuiltin('bv:filtre-kahve', 250), ingFromBuiltin('bv:sut', 50), ingFromBuiltin('tr:seker', 5)]);
  const [picking, setPicking] = useState(false);
  const [vals, setVals] = useState({ kcal: beverage?.per100ml.kcal ?? null, protein: beverage?.per100ml.protein ?? null, carb: beverage?.per100ml.carb ?? null, fat: beverage?.per100ml.fat ?? null, sugar: beverage?.per100ml.sugar ?? null, caffeine: beverage ? beverage.caffeinePer100ml : null, ml: beverage?.defaultMl ?? 250 } as Record<string, number | null>);
  const [fav, setFav] = useState(!beverage);
  const c = composeBeverage(ings);

  const save = async () => {
    if (!name.trim()) return;
    const input =
      mode === 'mix'
        ? { name, type, ingredients: ings }
        : {
            name,
            type,
            per100ml: { kcal: vals.kcal ?? 0, protein: vals.protein ?? 0, carb: vals.carb ?? 0, fat: vals.fat ?? 0, fiber: 0, sugar: vals.sugar },
            caffeinePer100ml: vals.caffeine,
            defaultMl: vals.ml ?? 250,
          };
    if (mode === 'mix' && (!ings.length || c.totalMl <= 0)) return;
    const saved = await repo.saveUserBeverage(input, beverage?.id);
    if (fav && !beverage) await repo.toggleFavorite('beverage', saved.id, `${saved.name} ${ml(saved.defaultMl)}`, { ml: saved.defaultMl, addons: { sugarG: 0, milkMl: 0 } });
    toast('İçecek kaydedildi');
    if (!beverage) replace({ kind: 'beverage', beverage: saved, presetMl: saved.defaultMl });
    else close();
  };

  return (
    <Sheet
      title={beverage ? 'İçeceği düzenle' : 'Kendi içeceğini oluştur'}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {beverage && (
            <Button
              variant="danger"
              aria-label="İçeceği sil"
              onClick={async () => {
                await repo.archiveUserBeverage(beverage.id);
                toast('İçecek kaldırıldı; geçmiş kayıtlar korunur');
                close();
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={save}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ad">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tür" hint="İstatistiklerde bu türe sayılır">
            <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
          </Field>
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'mix', label: 'Bileşenlerden' },
            { value: 'values', label: 'Değerleri gir' },
          ]}
        />
        {mode === 'mix' ? (
          <>
            <ul className="space-y-2">
              {ings.map((ing, i) => (
                <li key={`${ing.refId}-${i}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{ing.name}</span>
                  <NumberInput className="w-28" value={ing.amount} onChange={(v) => setIngs((l) => l.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))} suffix={ing.basis} ariaLabel={`${ing.name} miktarı`} />
                  <button type="button" aria-label={`${ing.name} çıkar`} onClick={() => setIngs((l) => l.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-danger">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
            {picking ? (
              <IngredientPicker
                drinksFirst
                onClose={() => setPicking(false)}
                onPick={(p) => {
                  setIngs((l) => [...l, { kind: p.kind, refId: p.id, name: p.name, amount: p.liquid ? 100 : 5, basis: p.basis, per100: p.per100, caffeinePer100: p.caffeine, addsVolume: p.liquid }]);
                  setPicking(false);
                }}
              />
            ) : (
              <Button variant="soft" size="sm" onClick={() => setPicking(true)}>
                <Plus size={16} /> Bileşen ekle
              </Button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Hacim" value={ml(c.totalMl)} />
              <StatTile label="Kalori" value={kcal(c.totals.kcal)} sub="kcal" />
              <StatTile label="Kafein" value={c.caffeineTotal === null ? 'bilinmiyor' : `${Math.round(c.caffeineTotal)} mg`} />
            </div>
            <NutrientSummary n={c.totals} />
            <p className="text-[12px] text-muted">Şeker gibi katılar hacme eklenmez; sıvılar (kahve, süt) eklenir.</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted">100 ml başına değerler</p>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['kcal', 'Kalori', 'kcal'],
                  ['protein', 'Protein', 'g'],
                  ['carb', 'Karbonhidrat', 'g'],
                  ['fat', 'Yağ', 'g'],
                  ['sugar', 'Şeker', 'g'],
                  ['caffeine', 'Kafein', 'mg'],
                ] as const
              ).map(([k, l, u]) => (
                <Field key={k} label={l}>
                  <NumberInput value={vals[k]} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} suffix={u} min={0} ariaLabel={l} />
                </Field>
              ))}
            </div>
            <Field label="Varsayılan miktar">
              <NumberInput value={vals.ml} onChange={(v) => setVals((s) => ({ ...s, ml: v }))} suffix="ml" ariaLabel="Varsayılan miktar" />
            </Field>
            <p className="text-[12px] text-muted">Şeker ya da kafeini bilmiyorsan boş bırak; “bilinmiyor” olarak işaretlenir, sıfır sayılmaz.</p>
          </>
        )}
        {!beverage && (
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--teal))]" />
            Favorilere ekle (tek dokunuşla kaydet)
          </label>
        )}
      </div>
    </Sheet>
  );
}
