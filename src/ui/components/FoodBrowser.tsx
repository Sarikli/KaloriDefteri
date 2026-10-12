import { useMemo, useState } from 'react';
import { ChefHat, Plus, Search, Star } from 'lucide-react';
import type { Beverage, Food } from '../../db/types';
import { CATEGORIES, CATEGORY_NAME } from '../../data/categories';
import { search } from '../../engine/search';
import { defaultServing } from '../../engine/portion';
import { scale } from '../../engine/nutrition';
import { groupOf } from '../../engine/beverage';
import { toggleFavorite } from '../../db/repo';
import { useAllBeverages, useAllFoods, useFavorites, useUsage } from '../hooks';
import { useApp } from '../store';
import { kcal, ml } from '../format';
import { Chip, Empty, Select, SourceBadge, cx } from './ui';
import { DrinkIcon } from './drink';

type Item = { kind: 'food'; id: string; name: string; aliases: string[]; food: Food } | { kind: 'beverage'; id: string; name: string; aliases: string[]; bev: Beverage };
type Tab = 'all' | 'fav' | 'recent' | 'frequent' | 'mine' | 'recipes' | 'drinks';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'fav', label: 'Favoriler' },
  { id: 'recent', label: 'Son' },
  { id: 'frequent', label: 'Sık' },
  { id: 'mine', label: 'Benim' },
  { id: 'recipes', label: 'Tarifler' },
  { id: 'drinks', label: 'İçecekler' },
];

export function FoodBrowser({ mealId, photoId, autoFocus }: { mealId?: string; photoId?: string; autoFocus?: boolean }) {
  const { open, date } = useApp();
  const foods = useAllFoods();
  const bevs = useAllBeverages();
  const favs = useFavorites();
  const usage = useUsage(date);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [cat, setCat] = useState('all');
  const [limit, setLimit] = useState(60);

  const favIds = useMemo(() => new Set(favs.map((f) => f.refId)), [favs]);
  const items: Item[] = useMemo(
    () => [...foods.map((f) => ({ kind: 'food' as const, id: f.id, name: f.name, aliases: [...f.aliases, ...(f.brand ? [f.brand] : [])], food: f })), ...bevs.map((b) => ({ kind: 'beverage' as const, id: b.id, name: b.name, aliases: b.aliases, bev: b }))],
    [foods, bevs],
  );

  const list = useMemo(() => {
    let pool = items;
    if (tab === 'fav') pool = items.filter((i) => favIds.has(i.id));
    if (tab === 'mine') pool = items.filter((i) => (i.kind === 'food' ? i.food.isUser && !i.food.recipeId : i.bev.isUser));
    if (tab === 'recipes') pool = items.filter((i) => i.kind === 'food' && !!i.food.recipeId);
    if (tab === 'drinks') pool = items.filter((i) => i.kind === 'beverage');
    if (tab === 'recent' || tab === 'frequent') {
      const order = tab === 'recent' ? usage?.recentFoods ?? [] : usage?.frequentFoods ?? [];
      const byId = new Map(items.map((i) => [i.id, i]));
      pool = order.map((id) => byId.get(id)).filter((x): x is Item => !!x);
      if (tab === 'frequent') {
        const bevOrder = [...(usage?.bevCount.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((x): x is Item => !!x);
        pool = [...pool, ...bevOrder];
      }
    }
    if (tab === 'all' && cat !== 'all') pool = pool.filter((i) => (cat === 'icecek' ? i.kind === 'beverage' : i.kind === 'food' && i.food.categoryId === cat));
    if (!q.trim()) return tab === 'all' && cat === 'all' ? pool.filter((i) => i.kind === 'food') : pool;
    const used = usage?.foodCount;
    return search(pool, q, { limit: 120, boost: (i) => (favIds.has(i.id) ? 3 : 0) + Math.min(4, used?.get(i.id) ?? 0) + (i.kind === 'food' && i.food.isUser ? 2 : 0) });
  }, [items, tab, cat, q, favIds, usage]);

  const pick = (i: Item) => {
    if (i.kind === 'food') open({ kind: 'portion', food: i.food, mealId, photoId });
    else open({ kind: 'beverage', beverage: i.bev, presetMl: usage?.usualMl.get(i.id), mealId });
  };

  return (
    <div>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(60);
          }}
          placeholder="Ara: mercimek, iskender, ayran…"
          aria-label="Yemek ara"
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-10 pr-3 text-[15px] focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
        />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      {tab === 'all' && (
        <div className="mt-3">
          <Select
            ariaLabel="Kategori"
            value={cat}
            onChange={setCat}
            options={[{ value: 'all', label: `Tüm kategoriler (${foods.length} yemek, ${bevs.length} içecek)` }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      )}
      <ul className="mt-3 divide-y divide-line/70">
        {list.slice(0, limit).map((i) => (
          <ItemRow key={i.id} item={i} fav={favIds.has(i.id)} onPick={() => pick(i)} />
        ))}
      </ul>
      {list.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 80)} className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-teal hover:bg-sunk">
          Daha fazla göster ({list.length - limit})
        </button>
      )}
      {list.length === 0 && (
        <Empty icon={<ChefHat size={22} />} title={q ? `“${q}” bulunamadı` : tab === 'fav' ? 'Henüz favorin yok' : tab === 'recent' || tab === 'frequent' ? 'Henüz kayıt yok' : 'Liste boş'}>
          {q ? (
            <button type="button" className="font-semibold text-teal" onClick={() => open({ kind: 'customFood', logAfter: true, mealId, name: q.trim() })}>
              “{q}” adıyla kişisel yemek oluştur
            </button>
          ) : tab === 'fav' ? (
            'Bir yemeği açıp yıldıza dokunarak favorilere ekleyebilirsin.'
          ) : null}
        </Empty>
      )}
    </div>
  );
}

function ItemRow({ item, fav, onPick }: { item: Item; fav: boolean; onPick: () => void }) {
  if (item.kind === 'food') {
    const f = item.food;
    const s = defaultServing(f);
    const k = scale(f.per100, s.amount).kcal;
    return (
      <li className="flex items-center gap-2 py-2.5">
        <button type="button" onClick={onPick} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{f.name}</span>
            {f.recipeId && <ChefHat size={14} className="shrink-0 text-leaf" aria-label="Tarif" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span className="num">
              {s.label} · {s.amount} {f.basis} · <b className="font-semibold text-ink">{kcal(k)} kcal</b>
            </span>
            {f.brand && <span>{f.brand}</span>}
            <span className="hidden sm:inline">{CATEGORY_NAME[f.categoryId]}</span>
            {(f.isUser || f.confidence === 'low') && <SourceBadge source={f.source} confidence={f.confidence === 'low' ? 'low' : undefined} />}
          </div>
        </button>
        <FavStar active={fav} onToggle={() => toggleFavorite('food', f.id, f.name)} />
        <button type="button" aria-label={`${f.name} ekle`} onClick={onPick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tealsoft text-teal">
          <Plus size={18} />
        </button>
      </li>
    );
  }
  const b = item.bev;
  return (
    <li className="flex items-center gap-2 py-2.5">
      <DrinkIcon group={groupOf(b.type)} boxed />
      <button type="button" onClick={onPick} className="min-w-0 flex-1 text-left">
        <div className="truncate font-semibold">{b.name}</div>
        <div className="num text-[12.5px] text-muted">
          {ml(b.defaultMl)} · <b className="font-semibold text-ink">{kcal((b.per100ml.kcal * b.defaultMl) / 100)} kcal</b>
          {b.caffeinePer100ml === null ? ' · kafein bilinmiyor' : b.caffeinePer100ml > 0 ? ` · ${Math.round((b.caffeinePer100ml * b.defaultMl) / 100)} mg kafein` : ''}
        </div>
      </button>
      <FavStar active={fav} onToggle={() => toggleFavorite('beverage', b.id, b.name, { ml: b.defaultMl })} />
      <button type="button" aria-label={`${b.name} ekle`} onClick={onPick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tealsoft text-teal">
        <Plus size={18} />
      </button>
    </li>
  );
}

export function FavStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-label={active ? 'Favorilerden çıkar' : 'Favorilere ekle'} aria-pressed={active} onClick={onToggle} className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-sunk', active ? 'text-carb' : 'text-muted/60')}>
      <Star size={18} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
