import { Citrus, Coffee, CupSoda, Droplet, Droplets, GlassWater, Leaf, Milk } from 'lucide-react';
import type { BeverageGroup } from '../../engine/beverage';
import { cx } from './ui';

/** Grafik ve simge renkleri: doğrulanmış kategorik palet (renk körlüğü testli), sabit sırada */
export const GROUP_ORDER: BeverageGroup[] = ['water', 'coffee', 'tea', 'juice', 'dairy', 'soft', 'mineral', 'other'];
export const GROUP_COLOR: Record<BeverageGroup, { fill: string }> = Object.fromEntries(GROUP_ORDER.map((g, i) => [g, { fill: `var(--bv${i + 1})` }])) as Record<BeverageGroup, { fill: string }>;

const ICON = { water: GlassWater, mineral: Droplets, coffee: Coffee, tea: Leaf, dairy: Milk, juice: Citrus, soft: CupSoda, other: Droplet };

export function DrinkIcon({ group, size = 18, className, boxed }: { group: BeverageGroup; size?: number; className?: string; boxed?: boolean }) {
  const I = ICON[group];
  if (!boxed) return <I size={size} className={className} style={{ color: GROUP_COLOR[group].fill }} aria-hidden="true" />;
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-xl', className)} style={{ width: size + 18, height: size + 18, background: `color-mix(in srgb, ${GROUP_COLOR[group].fill} 14%, transparent)` }}>
      <I size={size} style={{ color: GROUP_COLOR[group].fill }} aria-hidden="true" />
    </span>
  );
}
