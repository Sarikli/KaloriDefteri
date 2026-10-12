import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, type TooltipProps } from 'recharts';
import { Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { buildDaySeries, averageOver, drinkHours, weeklyWeightAverages, weightTrend, type DayPoint } from '../../engine/stats';
import { GROUP_LABEL, type BeverageGroup } from '../../engine/beverage';
import { addDays, diffDays, shortDateTR, toDateKey, weekdayShort } from '../../engine/dates';
import { useGoals, useProfile, useRange } from '../hooks';
import { useApp } from '../store';
import { g1, int, kcal, ml } from '../format';
import { Button, Card, CardHeader, Note, Segmented, StatTile, cx } from '../components/ui';
import { GROUP_COLOR, GROUP_ORDER } from '../components/drink';

type RangeKey = 'today' | '7' | '30' | 'custom';
type View = 'food' | 'drinks' | 'activity' | 'weight';

const AXIS = { fontSize: 11, fill: 'rgb(var(--muted))' };
const GRID = 'rgb(var(--chart-grid))';

export function AnalysisScreen() {
  const today = toDateKey();
  const [range, setRange] = useState<RangeKey>('7');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [view, setView] = useState<View>('food');
  const r = range === 'today' ? { from: today, to: today } : range === '7' ? { from: addDays(today, -6), to: today } : range === '30' ? { from: addDays(today, -29), to: today } : { from: from <= to ? from : to, to: from <= to ? to : from };
  const data = useRange(r.from, r.to);
  const goals = useGoals() ?? [];
  const profile = useProfile();
  const series = useMemo(
    () => (data ? buildDaySeries({ ...r, ...data, goals, weightKg: profile?.currentWeightKg ?? 70, heightCm: profile?.heightCm ?? 170 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, goals, profile, r.from, r.to],
  );
  const span = diffDays(r.to, r.from) + 1;

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-extrabold tracking-tight">Analiz</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          className="sm:w-[420px]"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Bugün' },
            { value: '7', label: 'Son 7 gün' },
            { value: '30', label: 'Son 30 gün' },
            { value: 'custom', label: 'Özel' },
          ]}
        />
        {range === 'custom' && (
          <div className="flex items-center gap-2 text-[13px]">
            <input type="date" aria-label="Başlangıç" value={from} max={today} onChange={(e) => e.target.value && setFrom(e.target.value)} className="num h-10 rounded-xl border border-line bg-surface px-2" />
            <span className="text-muted">–</span>
            <input type="date" aria-label="Bitiş" value={to} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} className="num h-10 rounded-xl border border-line bg-surface px-2" />
          </div>
        )}
      </div>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'food', label: 'Beslenme' },
          { value: 'drinks', label: 'İçecekler' },
          { value: 'activity', label: 'Aktivite' },
          { value: 'weight', label: 'Kilo' },
        ]}
      />
      {view === 'food' && <FoodView series={series} span={span} />}
      {view === 'drinks' && <DrinksView series={series} single={span === 1} entries={data?.beverages ?? []} />}
      {view === 'activity' && <ActivityView series={series} />}
      {view === 'weight' && <WeightView from={r.from} to={r.to} />}
    </div>
  );
}

const dayLabel = (d: string, n: number) => (n <= 8 ? `${weekdayShort(d)} ${Number(d.slice(8))}` : shortDateTR(d));

function ChartTip({ active, payload, label, unit, rows }: TooltipProps<number, string> & { unit: string; rows?: (p: DayPoint) => ReactNode }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as DayPoint & { date: string };
  return (
    <div className="num rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lift">
      <div className="mb-1 font-bold">{p.date ? shortDateTR(p.date) : label}</div>
      {rows
        ? rows(p)
        : payload.map((x) => (
            <div key={String(x.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
                {x.name}
              </span>
              <b>{x.value === null || x.value === undefined ? 'kayıt yok' : `${int(Number(x.value))} ${unit}`}</b>
            </div>
          ))}
    </div>
  );
}

function ChartCard({ title, sub, children, legend, table }: { title: string; sub?: ReactNode; children: ReactNode; legend?: Array<{ label: string; color: string; dash?: boolean }>; table?: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} sub={sub} />
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-[12.5px]">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-muted">
              <span className={cx('inline-block', l.dash ? 'h-0.5 w-4 border-t-2 border-dashed' : 'h-2.5 w-2.5 rounded-sm')} style={l.dash ? { borderColor: l.color } : { background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="h-56 px-2 pb-3 pt-2 sm:h-64">{children}</div>
      {table && (
        <details className="border-t border-line/70 px-4 py-2 text-[13px]">
          <summary className="cursor-pointer font-semibold text-teal">Tablo olarak göster</summary>
          <div className="mt-2 max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </Card>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <table className="num w-full text-left text-[12.5px]">
      <thead className="text-muted">
        <tr>
          {head.map((h) => (
            <th key={h} className="py-1 pr-3 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line/60">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="py-1 pr-3">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function coverage(days: number, total: number) {
  return `${days}/${total} gün kayıtlı`;
}

// ───────────────────────── Beslenme ─────────────────────────

function FoodView({ series, span }: { series: DayPoint[]; span: number }) {
  const avg = averageOver(series, (p) => p.kcal, (p) => p.hasFood || p.hasDrink);
  const avgTarget = averageOver(series, (p) => p.targetKcal, (p) => p.hasFood || p.hasDrink);
  const avgP = averageOver(series, (p) => p.protein, (p) => p.hasFood);
  const chart = series.map((p) => ({ ...p, label: dayLabel(p.date, span), kcalV: p.hasFood || p.hasDrink ? Math.round(p.kcal) : null, pro: p.hasFood ? p.protein : null, carbV: p.hasFood ? p.carb : null, fatV: p.hasFood ? p.fat : null }));
  if (!avg.days)
    return <Note>Bu aralıkta yemek ya da içecek kaydı yok. Ortalamalar yalnızca kayıt olan günlerden hesaplanır; kaydı olmayan günler sıfır sayılmaz.</Note>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Ortalama alım" value={`${kcal(avg.value ?? 0)} kcal`} sub={coverage(avg.days, avg.totalDays)} />
        <StatTile label="Ortalama hedef" value={`${kcal(avgTarget.value ?? 0)} kcal`} sub="aktivite dahil" />
        <StatTile label="Ortalama fark" value={`${(avg.value ?? 0) - (avgTarget.value ?? 0) > 0 ? '+' : '−'}${kcal(Math.abs((avg.value ?? 0) - (avgTarget.value ?? 0)))}`} sub="kcal/gün" />
        <StatTile label="Ortalama protein" value={`${int(avgP.value ?? 0)} g`} sub={coverage(avgP.days, avgP.totalDays)} />
      </div>
      <ChartCard
        title="Kalori tüketimi ve hedef"
        sub="Kaydı olmayan günlerde çubuk gösterilmez"
        legend={[
          { label: 'Alınan kalori', color: 'rgb(var(--teal))' },
          { label: 'Güncellenmiş hedef', color: 'rgb(var(--ink))', dash: true },
        ]}
        table={<Table head={['Tarih', 'Alınan', 'Yemek', 'İçecek', 'Hedef']} rows={series.map((p) => [shortDateTR(p.date), p.hasFood || p.hasDrink ? kcal(p.kcal) : 'kayıt yok', kcal(p.foodKcal), kcal(p.drinkKcal), p.targetKcal ? kcal(p.targetKcal) : '—'])} />}
      >
        <ResponsiveContainer>
          <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={48} />
            <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="kcal" />} />
            <Bar dataKey="kcalV" name="Alınan" fill="rgb(var(--teal))" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Line dataKey="targetKcal" name="Hedef" stroke="rgb(var(--ink))" strokeDasharray="5 4" strokeWidth={2} dot={false} type="stepAfter" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard
        title="Makro besinler (g)"
        legend={[
          { label: 'Protein', color: 'rgb(var(--pro))' },
          { label: 'Karbonhidrat', color: 'rgb(var(--carb))' },
          { label: 'Yağ', color: 'rgb(var(--fat))' },
        ]}
        table={<Table head={['Tarih', 'Protein', 'Karb.', 'Yağ']} rows={series.filter((p) => p.hasFood).map((p) => [shortDateTR(p.date), `${int(p.protein)} g`, `${int(p.carb)} g`, `${int(p.fat)} g`])} />}
      >
        <ResponsiveContainer>
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={48} />
            <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="g" />} />
            <Bar dataKey="pro" name="Protein" stackId="m" fill="rgb(var(--pro))" stroke="rgb(var(--surface))" strokeWidth={1.5} maxBarSize={26} />
            <Bar dataKey="carbV" name="Karbonhidrat" stackId="m" fill="rgb(var(--carb))" stroke="rgb(var(--surface))" strokeWidth={1.5} maxBarSize={26} />
            <Bar dataKey="fatV" name="Yağ" stackId="m" fill="rgb(var(--fat))" stroke="rgb(var(--surface))" strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ───────────────────────── İçecekler ─────────────────────────

function DrinksView({ series, single, entries }: { series: DayPoint[]; single: boolean; entries: import('../../db/types').BeverageEntry[] }) {
  const has = (p: DayPoint) => p.hasDrink;
  const total = averageOver(series, (p) => p.totalMl, has);
  const water = averageOver(series, (p) => p.waterMl, has);
  const coffee = averageOver(series, (p) => p.byGroup.coffee, has);
  const tea = averageOver(series, (p) => p.byGroup.tea, has);
  const kcalAvg = averageOver(series, (p) => p.drinkKcal, has);
  const caf = averageOver(series, (p) => p.caffeineMg, has);
  const cafIncomplete = series.some((p) => p.hasDrink && !p.caffeineComplete);
  const sumByGroup = GROUP_ORDER.map((g) => ({ g, v: series.reduce((s, p) => s + p.byGroup[g], 0) })).filter((x) => x.v > 0);
  const sumAll = sumByGroup.reduce((s, x) => s + x.v, 0);
  const chart = series.map((p) => ({ ...p, label: dayLabel(p.date, series.length), ...Object.fromEntries(GROUP_ORDER.map((g) => [g, p.hasDrink ? p.byGroup[g] : null])), caf: p.hasDrink ? Math.round(p.caffeineMg) : null }));
  const otherMl = (p: DayPoint) => p.totalMl - p.waterMl - p.byGroup.coffee - p.byGroup.tea;

  if (!total.days) return <Note>Bu aralıkta içecek kaydı yok. Bugün ekranındaki hızlı düğmelerle tek dokunuşta su, çay ya da kahve ekleyebilirsin.</Note>;
  const presentGroups = GROUP_ORDER.filter((g) => sumByGroup.some((x) => x.g === g));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={single ? 'Toplam içecek' : 'Ort. toplam içecek'} value={ml(total.value ?? 0)} sub={coverage(total.days, total.totalDays)} />
        <StatTile label={single ? 'Saf su' : 'Ort. saf su'} value={ml(water.value ?? 0)} accent="text-water" />
        <StatTile label="Kahve" value={ml(coffee.value ?? 0)} sub={single ? undefined : 'günlük ortalama'} />
        <StatTile label="Çay" value={ml(tea.value ?? 0)} sub={single ? undefined : 'günlük ortalama'} />
        <StatTile label="İçecek kalorisi" value={`${kcal(kcalAvg.value ?? 0)} kcal`} sub={single ? undefined : 'günlük ortalama'} />
        <StatTile label="Kafein" value={`${cafIncomplete ? '≥ ' : ''}${int(caf.value ?? 0)} mg`} sub={cafIncomplete ? 'bazı değerler bilinmiyor' : single ? undefined : 'günlük ortalama'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sıvı dağılımı" sub={`Toplam ${ml(sumAll)} · türlere göre`} />
          <div className="flex flex-col items-center gap-4 p-4 sm:flex-row lg:flex-col xl:flex-row">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sumByGroup} dataKey="v" nameKey="g" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="rgb(var(--surface))" strokeWidth={2} isAnimationActive={false}>
                    {sumByGroup.map((x) => (
                      <Cell key={x.g} fill={GROUP_COLOR[x.g].fill} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => (active && payload?.length ? <div className="num rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lift">{GROUP_LABEL[payload[0].payload.g as BeverageGroup]}: <b>{ml(Number(payload[0].value))}</b> (%{Math.round((Number(payload[0].value) / sumAll) * 100)})</div> : null)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold text-muted">saf su payı</span>
                <span className="num text-[22px] font-extrabold">%{sumAll ? Math.round(((sumByGroup.find((x) => x.g === 'water')?.v ?? 0) / sumAll) * 100) : 0}</span>
              </div>
            </div>
            <ul className="num w-full space-y-1.5 text-[13px]">
              {sumByGroup.map((x) => (
                <li key={x.g} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[x.g].fill }} />
                  <span className="min-w-0 flex-1 truncate text-muted">{GROUP_LABEL[x.g]}</span>
                  <b className="whitespace-nowrap">{ml(x.v)}</b>
                  <span className="w-10 text-right text-muted">%{Math.round((x.v / sumAll) * 100)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {single ? (
          <DrinkTimeline entries={entries} />
        ) : (
          <ChartCard
            title="Günlük içecek dağılımı (ml)"
            legend={presentGroups.map((g) => ({ label: GROUP_LABEL[g], color: GROUP_COLOR[g].fill }))}
            table={<Table head={['Tarih', 'Toplam', 'Saf su', 'Kahve', 'Çay', 'Diğer']} rows={series.filter(has).map((p) => [shortDateTR(p.date), ml(p.totalMl), ml(p.waterMl), ml(p.byGroup.coffee), ml(p.byGroup.tea), ml(otherMl(p))])} />}
          >
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={52} />
                <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="ml" />} />
                {presentGroups.map((g, i) => (
                  <Bar key={g} dataKey={g} name={GROUP_LABEL[g]} stackId="d" fill={GROUP_COLOR[g].fill} stroke="rgb(var(--surface))" strokeWidth={1.5} maxBarSize={26} radius={i === presentGroups.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {!single && (
        <ChartCard
          title="Tahmini kafein (mg/gün)"
          sub={cafIncomplete ? 'Bazı kayıtlarda kafein bilinmiyor; o günlerin değeri “en az” olarak okunmalı.' : 'Değerler demleme, çekirdek ve porsiyona göre değişir.'}
          table={<Table head={['Tarih', 'Kafein', 'Durum']} rows={series.filter(has).map((p) => [shortDateTR(p.date), `${int(p.caffeineMg)} mg`, p.caffeineComplete ? 'tam' : 'en az (bilinmeyen var)'])} />}
        >
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={48} />
              <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="mg" rows={(p) => <div>{p.caffeineComplete ? '' : 'en az '}<b>{int(p.caffeineMg)} mg</b> · kahve {p.coffeeCount} kez</div>} />} />
              <Bar dataKey="caf" name="Kafein" fill="var(--bv2)" radius={[4, 4, 0, 0]} maxBarSize={26}>
                {chart.map((p) => (
                  <Cell key={p.date} fillOpacity={p.caffeineComplete ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {series.length >= 14 && (
        <Card>
          <CardHeader title="İçecek alışkanlıkları" sub={`${coverage(total.days, total.totalDays)} · kayıtlı günlerin ortalaması`} />
          <ul className="num space-y-2 p-4 text-[13px]">
            {presentGroups.map((g) => {
              const a = averageOver(series, (p) => p.byGroup[g], has).value ?? 0;
              const daysWith = series.filter((p) => p.byGroup[g] > 0).length;
              return (
                <li key={g}>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[g].fill }} />
                      {GROUP_LABEL[g]}
                    </span>
                    <span>
                      <b>{ml(a)}</b>/gün · {daysWith} günde içildi
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (a / Math.max(1, total.value ?? 1)) * 100)}%`, background: GROUP_COLOR[g].fill }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DrinkTimeline({ entries }: { entries: import('../../db/types').BeverageEntry[] }) {
  const pts = drinkHours(entries);
  const groups = GROUP_ORDER.filter((g) => pts.some((p) => p.group === g));
  const data = groups.map((g) => ({ g, points: pts.filter((p) => p.group === g).map((p) => ({ x: p.hour + p.minute / 60, y: groups.indexOf(g), ml: p.ml, name: p.name, t: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` })) }));
  const byName = new Map<string, string[]>();
  for (const p of pts) byName.set(p.name, [...(byName.get(p.name) ?? []), `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`]);
  return (
    <Card>
      <CardHeader title="İçme saatleri" sub="Nokta büyüklüğü miktarı gösterir" />
      <div className="h-48 px-2 pt-2">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical horizontal={false} />
            <XAxis type="number" dataKey="x" domain={[0, 24]} ticks={[0, 6, 9, 12, 15, 18, 21, 24]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}:00`} />
            <YAxis type="number" dataKey="y" domain={[-0.5, Math.max(0.5, groups.length - 0.5)]} ticks={groups.map((_, i) => i)} tickFormatter={(i) => GROUP_LABEL[groups[i]] ?? ''} tick={AXIS} tickLine={false} axisLine={false} width={84} />
            <ZAxis dataKey="ml" range={[50, 400]} />
            <Tooltip cursor={false} content={({ active, payload }) => (active && payload?.length ? <div className="num rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lift">{payload[0].payload.t} · {payload[0].payload.name} · <b>{ml(payload[0].payload.ml)}</b></div> : null)} />
            {data.map((d) => (
              <Scatter key={d.g} data={d.points} fill={GROUP_COLOR[d.g].fill} stroke="rgb(var(--surface))" strokeWidth={2} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="num space-y-1 px-4 pb-4 text-[12.5px]">
        {[...byName.entries()].map(([n, times]) => (
          <li key={n} className="flex justify-between gap-3">
            <span className="truncate text-muted">{n}</span>
            <span className="shrink-0">{times.join(' · ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ───────────────────────── Aktivite ─────────────────────────

function ActivityView({ series }: { series: DayPoint[] }) {
  const totalMin = series.reduce((s, p) => s + p.exerciseMin, 0);
  const steps = averageOver(series, (p) => p.steps, (p) => p.steps !== null);
  const net = series.reduce((s, p) => s + p.exerciseNetKcal, 0);
  const added = series.reduce((s, p) => s + p.addedKcal, 0);
  const chart = series.map((p) => ({ ...p, label: dayLabel(p.date, series.length) }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Toplam egzersiz" value={`${int(totalMin)} dk`} />
        <StatTile label="Ortalama adım" value={steps.value === null ? '—' : int(steps.value)} sub={coverage(steps.days, steps.totalDays)} />
        <StatTile label="Egzersiz (net)" value={`${kcal(net)} kcal`} sub="toplam, tahmini" />
        <StatTile label="Hedefe eklenen" value={`${kcal(added)} kcal`} sub="toplam" accent="text-leaf" />
      </div>
      <ChartCard title="Egzersiz süresi (dk)" table={<Table head={['Tarih', 'Süre', 'Net kcal', 'Adım']} rows={series.map((p) => [shortDateTR(p.date), `${p.exerciseMin} dk`, kcal(p.exerciseNetKcal), p.steps === null ? '—' : int(p.steps)])} />}>
        <ResponsiveContainer>
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={44} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="dk" />} />
            <Bar dataKey="exerciseMin" name="Egzersiz" fill="rgb(var(--leaf))" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Günlük adım" sub="Girilmeyen günler boş gösterilir">
        <ResponsiveContainer>
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={52} />
            <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="adım" />} />
            <Bar dataKey="steps" name="Adım" fill="rgb(var(--teal))" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Egzersiz kalorisi (net, kcal)">
        <ResponsiveContainer>
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => int(v)} width={48} />
            <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={<ChartTip unit="kcal" />} />
            <Bar dataKey="exerciseNetKcal" name="Net harcama" fill="rgb(var(--leaf))" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ───────────────────────── Kilo ─────────────────────────

function WeightView({ from, to }: { from: string; to: string }) {
  const { open } = useApp();
  const profile = useProfile();
  const all = useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? [];
  const withKg = all.filter((w) => w.weightKg !== null);
  const inRange = withKg.filter((w) => w.date >= from && w.date <= to);
  const weekly = weeklyWeightAverages(withKg);
  const trend = weightTrend(withKg.slice(-30), profile?.targetWeightKg);
  const chart = inRange.map((w) => ({ date: w.date, label: shortDateTR(w.date), kg: w.weightKg }));
  const kgs = chart.map((c) => c.kg as number);
  const lo = kgs.length ? Math.floor(Math.min(...kgs, profile?.targetWeightKg ?? Infinity) - 1) : 0;
  const hi = kgs.length ? Math.ceil(Math.max(...kgs) + 1) : 1;
  const measures = all.filter((w) => w.waistCm || w.hipCm || w.neckCm).slice(-8).reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Başlangıç" value={profile ? `${g1(profile.startWeightKg)} kg` : '—'} />
        <StatTile label="Güncel" value={withKg.length ? `${g1(withKg[withKg.length - 1].weightKg)} kg` : '—'} />
        <StatTile label="Hedef" value={profile?.targetWeightKg ? `${g1(profile.targetWeightKg)} kg` : '—'} />
        <StatTile label="Son haftalık ortalama" value={weekly.length ? `${g1(weekly[weekly.length - 1].avg)} kg` : '—'} sub={weekly.length ? `${weekly[weekly.length - 1].count} ölçüm` : undefined} />
      </div>
      {chart.length >= 2 ? (
        <ChartCard title="Kilo değişimi" sub={`${shortDateTR(from)} – ${shortDateTR(to)}`} table={<Table head={['Tarih', 'Kilo']} rows={inRange.map((w) => [shortDateTR(w.date), `${g1(w.weightKg)} kg`])} />}>
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis domain={[lo, hi]} tick={AXIS} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip unit="kg" rows={(p) => <b>{g1((p as unknown as { kg: number }).kg)} kg</b>} />} />
              <Line dataKey="kg" name="Kilo" stroke="rgb(var(--teal))" strokeWidth={2} dot={{ r: 4, fill: 'rgb(var(--teal))', stroke: 'rgb(var(--surface))', strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <Note>Grafik için bu aralıkta en az 2 kilo ölçümü gerekir.</Note>
      )}
      {weekly.length > 1 && (
        <Card>
          <CardHeader title="Haftalık ortalamalar" sub="Günlük dalgalanmayı yumuşatır" />
          <div className="p-4">
            <Table head={['Hafta', 'Ortalama', 'Ölçüm', 'Değişim']} rows={weekly.slice(-8).map((w, i, arr) => [shortDateTR(w.week), `${g1(w.avg)} kg`, w.count, i ? `${w.avg - arr[i - 1].avg > 0 ? '+' : ''}${g1(w.avg - arr[i - 1].avg)} kg` : '—'])} />
          </div>
        </Card>
      )}
      <Note>
        {trend
          ? `Son ${trend.points} ölçümde (${trend.spanDays} gün) eğilim haftada yaklaşık ${trend.slopePerWeek > 0 ? '+' : ''}${g1(trend.slopePerWeek)} kg.${trend.weeksToTarget ? ` Bu eğilim sürerse hedefe kabaca ${Math.round(trend.weeksToTarget)} hafta; bu kesin bir sonuç değil, kaba bir projeksiyondur.` : ''}`
          : 'Eğilim için en az 4 ölçüm ve 10 günlük aralık gerekir.'}{' '}
        Günlük kilo; su, tuz ve sindirime bağlı oynar ve yağ değişimi anlamına gelmez.
      </Note>
      {measures.length > 0 && (
        <Card>
          <CardHeader title="Vücut ölçüleri" />
          <div className="p-4">
            <Table head={['Tarih', 'Bel', 'Kalça', 'Boyun']} rows={measures.map((m) => [shortDateTR(m.date), m.waistCm ? `${g1(m.waistCm)} cm` : '—', m.hipCm ? `${g1(m.hipCm)} cm` : '—', m.neckCm ? `${g1(m.neckCm)} cm` : '—'])} />
          </div>
        </Card>
      )}
      <Button variant="soft" onClick={() => open({ kind: 'weight' })}>
        <Plus size={16} /> Kilo / ölçü ekle
      </Button>
    </div>
  );
}
