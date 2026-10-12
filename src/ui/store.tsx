import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Beverage, BeverageEntry, ActivityEntry, DateKey, Food, MealEntry, Recipe } from '../db/types';
import { toDateKey } from '../engine/dates';

export type SheetSpec =
  | { kind: 'addMenu' }
  | { kind: 'foodSearch'; mealId?: string; photoId?: string }
  | { kind: 'portion'; food: Food; mealId?: string; entry?: MealEntry; photoId?: string }
  | { kind: 'beverage'; beverage?: Beverage; entry?: BeverageEntry; presetMl?: number; mealId?: string }
  | { kind: 'activity'; entry?: ActivityEntry }
  | { kind: 'weight' }
  | { kind: 'customFood'; food?: Food; barcode?: string; logAfter?: boolean; mealId?: string; name?: string }
  | { kind: 'recipe'; recipe?: Recipe }
  | { kind: 'customBeverage'; beverage?: Beverage }
  | { kind: 'barcode'; mealId?: string }
  | { kind: 'photo'; mealId?: string };

export type Tab = 'today' | 'foods' | 'analysis' | 'profile';

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface AppState {
  date: DateKey;
  setDate: (d: DateKey) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  sheets: SheetSpec[];
  open: (s: SheetSpec) => void;
  replace: (s: SheetSpec) => void;
  close: () => void;
  closeAll: () => void;
  toast: (text: string, action?: Toast['action']) => void;
  toasts: Toast[];
}

const Ctx = createContext<AppState | null>(null);

const TABS: Tab[] = ['today', 'foods', 'analysis', 'profile'];
function tabFromHash(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'today';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(toDateKey());
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [sheets, setSheets] = useState<SheetSpec[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  const closedByBack = useRef(false);

  // Android geri tuşu / tarayıcı geri: açık pencere varsa önce onu kapatır
  const hadSheets = useRef(false);
  useEffect(() => {
    const has = sheets.length > 0;
    if (has && !hadSheets.current) history.pushState({ kdSheet: 1 }, '');
    if (!has && hadSheets.current && !closedByBack.current && history.state?.kdSheet) history.back();
    closedByBack.current = false;
    hadSheets.current = has;
  }, [sheets.length]);
  useEffect(() => {
    const onPop = () => {
      if (sheetsRef.current.length) {
        closedByBack.current = true;
        setSheets([]);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    if (location.hash !== `#${t}`) history.pushState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);
  const open = useCallback((s: SheetSpec) => setSheets((x) => [...x, s]), []);
  const replace = useCallback((s: SheetSpec) => setSheets((x) => [...x.slice(0, -1), s]), []);
  const close = useCallback(() => setSheets((x) => x.slice(0, -1)), []);
  const closeAll = useCallback(() => setSheets([]), []);
  const toast = useCallback((text: string, action?: Toast['action']) => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3000);
  }, []);

  const value = useMemo(() => ({ date, setDate, tab, setTab, sheets, open, replace, close, closeAll, toast, toasts }), [date, tab, sheets, toasts, setTab, open, replace, close, closeAll, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider eksik');
  return v;
}
