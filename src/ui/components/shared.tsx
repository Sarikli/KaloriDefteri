import type { MealDef, Nutrients } from '../../db/types';
import { g1, kcal } from '../format';
import { Chip, cx } from './ui';

export function defaultMealFor(meals: MealDef[], d = new Date()): string {
  const h = d.getHours();
  const id = h < 11 ? 'kahvalti' : h < 15 ? 'ogle' : h < 17 ? 'ara' : h < 22 ? 'aksam' : 'ara';
  return meals.find((m) => m.id === id)?.id ?? meals[0]?.id ?? 'ara';
}

export function MealPicker({ meals, value, onChange, allowNone }: { meals: MealDef[]; value: string | undefined; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {allowNone && (
        <Chip active={!value} onClick={() => onChange(undefined)}>
          Öğünsüz
        </Chip>
      )}
      {[...meals].sort((a, b) => a.order - b.order).map((m) => (
        <Chip key={m.id} active={value === m.id} onClick={() => onChange(m.id)}>
          {m.name}
        </Chip>
      ))}
    </div>
  );
}

export function NutrientSummary({ n, big, className }: { n: Nutrients; big?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between gap-3 rounded-2xl bg-sunk px-4 py-3', className)}>
      <div>
        <div className={cx('num font-extrabold leading-none', big ? 'text-[30px]' : 'text-[22px]')}>
          {kcal(n.kcal)} <span className="text-[14px] font-semibold text-muted">kcal</span>
        </div>
      </div>
      <div className="num grid grid-cols-4 gap-3 text-right text-[12px]">
        <Macro label="Protein" v={n.protein} color="text-pro" />
        <Macro label="Karb." v={n.carb} color="text-carb" />
        <Macro label="Yağ" v={n.fat} color="text-fat" />
        <Macro label="Lif" v={n.fiber} color="text-leaf" />
      </div>
    </div>
  );
}

function Macro({ label, v, color }: { label: string; v: number | null; color: string }) {
  return (
    <div>
      <div className={cx('font-semibold', color)}>{label}</div>
      <div className="text-[14px] font-bold text-ink">{v === null ? '—' : `${g1(v)} g`}</div>
    </div>
  );
}

export function TimeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return <input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} className="num h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] focus:border-teal focus:outline-none" />;
}
