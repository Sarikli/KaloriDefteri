import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChefHat, CupSoda, PenLine, ScanBarcode } from 'lucide-react';
import { db } from '../../db/database';
import { BUILTIN_FOODS } from '../../data/foods';
import { useApp } from '../store';
import { kcal, ml } from '../format';
import { Card, CardHeader } from '../components/ui';
import { FoodBrowser } from '../components/FoodBrowser';

export function FoodsScreen() {
  const { open } = useApp();
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const userFoods = useLiveQuery(() => db.foods.filter((f) => !f.archived && !f.recipeId).toArray(), []) ?? [];
  const userBevs = useLiveQuery(() => db.beverages.filter((b) => !b.archived).toArray(), []) ?? [];
  const trCount = BUILTIN_FOODS.filter((f) => f.cuisine === 'tr').length;
  const actions = [
    { icon: <PenLine size={20} />, label: 'Yeni yemek', run: () => open({ kind: 'customFood' }) },
    { icon: <ChefHat size={20} />, label: 'Tarif oluştur', run: () => open({ kind: 'recipe' }) },
    { icon: <CupSoda size={20} />, label: 'Yeni içecek', run: () => open({ kind: 'customBeverage' }) },
    { icon: <ScanBarcode size={20} />, label: 'Barkod', run: () => open({ kind: 'barcode' }) },
    { icon: <Camera size={20} />, label: 'Fotoğraf', run: () => open({ kind: 'photo' }) },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">Yemekler</h1>
        <p className="text-[13px] text-muted">
          {BUILTIN_FOODS.length} hazır kayıt ({trCount} Türk mutfağı) · {userFoods.length} kişisel yemek · {recipes.length} tarif
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.run} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface px-1 py-3 text-[12px] font-semibold shadow-card hover:bg-tealsoft">
            <span className="text-teal">{a.icon}</span>
            <span className="text-center leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <Card className="p-4">
          <FoodBrowser />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Tariflerim" icon={<ChefHat size={18} className="text-leaf" />} />
            <ul className="divide-y divide-line/60 px-4 pb-2 pt-1">
              {recipes.length === 0 && <li className="py-3 text-[13px] text-muted">Malzemelerden tarif oluştur; toplam ve porsiyon kalorisi otomatik hesaplanır.</li>}
              {recipes.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => open({ kind: 'recipe', recipe: r })} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span className="num shrink-0 text-[12px] text-muted">
                      {r.ingredients.length} malzeme · {r.servings} porsiyon
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Kişisel yemeklerim" icon={<PenLine size={18} className="text-teal" />} />
            <ul className="divide-y divide-line/60 px-4 pb-2 pt-1">
              {userFoods.length === 0 && <li className="py-3 text-[13px] text-muted">Veritabanında olmayan yemekleri buradan yönetebilirsin.</li>}
              {userFoods.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => open({ kind: 'customFood', food: f })} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                    <span className="truncate font-semibold">
                      {f.name}
                      {f.brand ? <span className="font-normal text-muted"> · {f.brand}</span> : null}
                    </span>
                    <span className="num shrink-0 text-[12px] text-muted">{kcal(f.per100.kcal)} kcal/100 {f.basis}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Kişisel içeceklerim" icon={<CupSoda size={18} className="text-coffee" />} />
            <ul className="divide-y divide-line/60 px-4 pb-2 pt-1">
              {userBevs.length === 0 && <li className="py-3 text-[13px] text-muted">“Benim kahvem” gibi içeceklerini bileşenlerinden oluştur.</li>}
              {userBevs.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => open({ kind: 'customBeverage', beverage: b })} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                    <span className="truncate font-semibold">{b.name}</span>
                    <span className="num shrink-0 text-[12px] text-muted">
                      {ml(b.defaultMl)} · {kcal((b.per100ml.kcal * b.defaultMl) / 100)} kcal
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
