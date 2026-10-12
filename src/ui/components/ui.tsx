import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Info, Minus, Plus, X } from 'lucide-react';
import type { Confidence, DataSource } from '../../db/types';
import { CONFIDENCE_LABEL, SOURCE_LABEL } from '../format';

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <As className={cx('rounded-card bg-surface shadow-card border border-line/60', className)}>{children}</As>;
}

export function CardHeader({ title, icon, right, sub }: { title: ReactNode; icon?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
          {icon}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-teal text-white hover:brightness-105 active:brightness-95 dark:text-[rgb(8,30,27)]',
    soft: 'bg-tealsoft text-teal hover:brightness-[0.98]',
    ghost: 'text-ink hover:bg-sunk',
    outline: 'border border-line text-ink hover:bg-sunk',
    danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  };
  const s = { sm: 'h-8 px-3 text-[13px] rounded-lg', md: 'h-11 px-4 text-[15px] rounded-xl', lg: 'h-12 px-5 text-base rounded-xl' }[size];
  return (
    <button type="button" className={cx('inline-flex select-none items-center justify-center gap-2 font-semibold transition disabled:opacity-40', v[variant], s, className)} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-sunk hover:text-ink', className)} {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'md', className }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="radiogroup" className={cx('flex rounded-xl bg-sunk p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg px-2 font-semibold transition',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
            o.value === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition',
        active ? 'border-teal bg-teal text-white dark:text-[rgb(8,30,27)]' : 'border-line bg-surface text-ink hover:bg-sunk',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = 'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

/** Sayı girişi: boş bırakılabilir (null), Türkçe ondalık virgül kabul eder */
export function NumberInput({ value, onChange, suffix, min, max, step, placeholder, id, className, ariaLabel }: { value: number | null; onChange: (v: number | null) => void; suffix?: string; min?: number; max?: number; step?: number; placeholder?: string; id?: string; className?: string; ariaLabel?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const shown = value === null || Number.isNaN(value) ? '' : String(value).replace('.', ',');
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = shown;
  }, [shown]);
  return (
    <div className={cx('relative', className)}>
      <input
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        defaultValue={shown}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.').trim();
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onChange(max !== undefined && n > max ? max : min !== undefined && n < min ? min : n);
        }}
        step={step}
        className={cx(inputCls, 'num', suffix && 'pr-12')}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">{suffix}</span>}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, suffix, ariaLabel }: { value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string; ariaLabel?: string }) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div className="flex items-center gap-2">
      <IconButton label="Azalt" className="h-11 w-11 shrink-0 rounded-xl border border-line text-ink" onClick={() => onChange(Math.max(min, round(value - step)))}>
        <Minus size={18} />
      </IconButton>
      <NumberInput value={value} onChange={(v) => onChange(v ?? 0)} min={min} suffix={suffix} className="flex-1" ariaLabel={ariaLabel} />
      <IconButton label="Artır" className="h-11 w-11 shrink-0 rounded-xl border border-line text-ink" onClick={() => onChange(round(value + step))}>
        <Plus size={18} />
      </IconButton>
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, id, ariaLabel }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; id?: string; ariaLabel?: string }) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, 'min-w-0 truncate pr-8')}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ProgressBar({ value, max, color = 'bg-teal', className, over }: { value: number; max: number; color?: string; className?: string; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-sunk', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', over && value > max ? 'bg-danger' : color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, size = 168, stroke = 14, children, extra = 0 }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode; extra?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = value > max;
  const basePct = max > 0 ? Math.min(1, (max - extra) / max) : 1;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunk))" strokeWidth={stroke} />
        {extra > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--leaf) / 0.28)" strokeWidth={stroke} strokeDasharray={`${c * (1 - basePct)} ${c}`} strokeDashoffset={-c * basePct} />}
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? 'rgb(var(--danger))' : 'rgb(var(--teal))'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function SourceBadge({ source, confidence, note }: { source: DataSource; confidence?: Confidence; note?: string }) {
  const tone = confidence === 'low' ? 'bg-warn/10 text-warn' : confidence === 'high' ? 'bg-leafsoft text-leaf' : 'bg-sunk text-muted';
  return (
    <span title={note} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', tone)}>
      {SOURCE_LABEL[source]}
      {confidence && <span className="font-normal opacity-80">· güven {CONFIDENCE_LABEL[confidence]}</span>}
    </span>
  );
}

export function Note({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok'; className?: string }) {
  const t = { info: 'bg-sunk text-muted', warn: 'bg-warn/10 text-warn', ok: 'bg-leafsoft text-leaf' }[tone];
  return (
    <div className={cx('flex gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-snug', t, className)}>
      <Info size={16} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-[13px] text-muted">{children}</div>}
    </div>
  );
}

/** Mobilde alttan açılan, geniş ekranda ortada duran pencere */
export function Sheet({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="anim-fade absolute inset-0 bg-[rgb(8_20_18/0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[24px] bg-surface shadow-lift sm:rounded-[24px]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
          <h2 id={id} className="min-w-0 truncate text-[17px] font-bold">
            {title}
          </h2>
          <IconButton label="Kapat" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line/70 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-sunk px-3 py-2.5">
      <div className={cx('flex items-center gap-1.5 text-[12px] font-semibold', accent ?? 'text-muted')}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="num mt-0.5 text-[19px] font-bold leading-tight">{value}</div>
      {sub && <div className="num text-[12px] text-muted">{sub}</div>}
    </div>
  );
}
