import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChartColumn, CircleUserRound, House, Plus, Utensils, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import * as repo from './db/repo';
import { startReminderLoop } from './integrations/notifications';
import { useApp, type SheetSpec, type Tab } from './ui/store';
import { useSettings } from './ui/hooks';
import { cx } from './ui/components/ui';
import { TodayScreen } from './ui/screens/TodayScreen';
import { FoodsScreen } from './ui/screens/FoodsScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ProfileForm } from './ui/screens/ProfileForm';
import { PortionSheet } from './ui/sheets/PortionSheet';
import { BeverageSheet } from './ui/sheets/BeverageSheet';
import { ActivitySheet, WeightSheet } from './ui/sheets/ActivityWeightSheets';
import { CustomBeverageSheet, CustomFoodSheet, RecipeSheet } from './ui/sheets/CreateSheets';
import { AddMenuSheet, BarcodeSheet, FoodSearchSheet, PhotoSheet } from './ui/sheets/CaptureSheets';

const AnalysisScreen = lazy(() => import('./ui/screens/AnalysisScreen').then((m) => ({ default: m.AnalysisScreen })));

const NAV: Array<{ id: Tab; label: string; icon: typeof House }> = [
  { id: 'today', label: 'Bugün', icon: House },
  { id: 'foods', label: 'Yemekler', icon: Utensils },
  { id: 'analysis', label: 'Analiz', icon: ChartColumn },
  { id: 'profile', label: 'Profil', icon: CircleUserRound },
];

function SheetHost({ spec }: { spec: SheetSpec }) {
  switch (spec.kind) {
    case 'addMenu':
      return <AddMenuSheet />;
    case 'foodSearch':
      return <FoodSearchSheet mealId={spec.mealId} photoId={spec.photoId} />;
    case 'portion':
      return <PortionSheet key={spec.food.id + (spec.entry?.id ?? '')} food={spec.food} mealId={spec.mealId} entry={spec.entry} photoId={spec.photoId} />;
    case 'beverage':
      return <BeverageSheet key={(spec.beverage?.id ?? '') + (spec.entry?.id ?? '')} beverage={spec.beverage} entry={spec.entry} presetMl={spec.presetMl} mealId={spec.mealId} />;
    case 'activity':
      return <ActivitySheet entry={spec.entry} />;
    case 'weight':
      return <WeightSheet />;
    case 'customFood':
      return <CustomFoodSheet food={spec.food} barcode={spec.barcode} logAfter={spec.logAfter} mealId={spec.mealId} name={spec.name} />;
    case 'recipe':
      return <RecipeSheet recipe={spec.recipe} />;
    case 'customBeverage':
      return <CustomBeverageSheet beverage={spec.beverage} />;
    case 'barcode':
      return <BarcodeSheet mealId={spec.mealId} />;
    case 'photo':
      return <PhotoSheet mealId={spec.mealId} />;
  }
}

function Onboarding() {
  const [skipping, setSkipping] = useState(false);
  const finish = async () => {
    await repo.updateSettings({ onboarded: true });
    navigator.storage?.persist?.().catch(() => {});
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal text-white">
          <Utensils size={24} />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-tight">KaloriDefteri’ne hoş geldin</h1>
        <p className="mt-2 text-muted">Yediklerini, içtiklerini ve hareketini Türk mutfağına göre takip et. Günlük hedefini hesaplamak için birkaç bilgi gerekiyor; veriler yalnızca bu cihazda kalır, üyelik yok.</p>
      </div>
      <div className="rounded-card bg-surface p-4 shadow-card">
        <ProfileForm onSaved={finish} submitLabel="Hedefimi hesapla ve başla" />
      </div>
      <button
        type="button"
        disabled={skipping}
        className="mt-4 w-full py-3 text-[14px] font-semibold text-muted hover:text-ink"
        onClick={async () => {
          setSkipping(true);
          await repo.saveGoals({ baseKcal: 2000, method: 'manual' });
          await finish();
        }}
      >
        Şimdilik atla (2.000 kcal ile başla, sonra Profil’den düzenle)
      </button>
    </div>
  );
}

export default function App() {
  const { tab, setTab, sheets, open, toasts } = useApp();
  const settings = useSettings();
  const [online, setOnline] = useState(navigator.onLine);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    const t = settings?.theme ?? 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }, [settings?.theme]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => startReminderLoop(() => settingsRef.current?.reminders), []);

  if (!settings) return null;
  if (!settings.onboarded) return <Onboarding />;

  const top = sheets[sheets.length - 1];
  return (
    <div className="min-h-full lg:flex">
      <aside className="safe-top sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-line/70 bg-surface px-3 py-5 lg:flex">
        <div className="mb-5 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-white">
            <Utensils size={18} />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">KaloriDefteri</span>
        </div>
        <button type="button" onClick={() => open({ kind: 'addMenu' })} className="mb-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-teal font-bold text-white shadow-card dark:text-[rgb(8,30,27)]">
          <Plus size={20} /> Ekle
        </button>
        {NAV.map((n) => (
          <button key={n.id} type="button" onClick={() => setTab(n.id)} aria-current={tab === n.id ? 'page' : undefined} className={cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition', tab === n.id ? 'bg-tealsoft text-teal' : 'text-muted hover:bg-sunk hover:text-ink')}>
            <n.icon size={20} />
            {n.label}
          </button>
        ))}
        {!online && (
          <p className="mt-auto flex items-center gap-2 rounded-xl bg-sunk px-3 py-2 text-[12px] text-muted">
            <WifiOff size={14} /> Çevrimdışı · kayıtlar cihazda
          </p>
        )}
      </aside>

      <main className="safe-top mx-auto w-full max-w-6xl px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
        {!online && (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-sunk px-3 py-2 text-[12.5px] text-muted lg:hidden">
            <WifiOff size={14} /> Çevrimdışısın. Kayıt ve hesaplamalar çalışır; barkod ve fotoğraf analizi için bağlantı gerekir.
          </p>
        )}
        {tab === 'today' && <TodayScreen />}
        {tab === 'foods' && <FoodsScreen />}
        {tab === 'analysis' && (
          <Suspense fallback={<p className="py-10 text-center text-muted">Grafikler yükleniyor…</p>}>
            <AnalysisScreen />
          </Suspense>
        )}
        {tab === 'profile' && <ProfileScreen />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 backdrop-blur lg:hidden" aria-label="Ana menü">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
          {NAV.slice(0, 2).map((n) => (
            <NavBtn key={n.id} n={n} active={tab === n.id} onClick={() => setTab(n.id)} />
          ))}
          <div className="flex justify-center">
            <button type="button" aria-label="Ekle" onClick={() => open({ kind: 'addMenu' })} className="-mt-5 mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-lift ring-4 ring-bg transition active:scale-95 dark:text-[rgb(8,30,27)]">
              <Plus size={28} />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <NavBtn key={n.id} n={n} active={tab === n.id} onClick={() => setTab(n.id)} />
          ))}
        </div>
      </nav>

      {top && <SheetHost spec={top} />}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {needRefresh && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[14px] text-bg shadow-lift">
            Yeni sürüm hazır.
            <button type="button" className="font-bold text-tealsoft" onClick={() => updateServiceWorker(true)}>
              Yenile
            </button>
          </div>
        )}
        {toasts.map((t) => (
          <div key={t.id} role="status" className="anim-sheet pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[14px] text-bg shadow-lift">
            <span className="min-w-0">{t.text}</span>
            {t.action && (
              <button type="button" className="shrink-0 font-bold text-tealsoft" onClick={t.action.run}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavBtn({ n, active, onClick }: { n: (typeof NAV)[number]; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={cx('flex h-14 flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold', active ? 'text-teal' : 'text-muted')}>
      <n.icon size={22} strokeWidth={active ? 2.4 : 2} />
      {n.label}
    </button>
  );
}
