import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, ChefHat, CupSoda, Dumbbell, GlassWater, ImagePlus, Loader2, PenLine, Scale, ScanBarcode, Utensils } from 'lucide-react';
import type { Food } from '../../db/types';
import * as repo from '../../db/repo';
import { db } from '../../db/database';
import { lookupBarcode, OFF_ATTRIBUTION, offToFoodInput, validBarcode, type OffProduct } from '../../integrations/openFoodFacts';
import { cameraSupported, startScan, type ScanStop } from '../../integrations/barcode';
import type { VisionItem } from '../../integrations/vision';
import { VISION_MODEL } from '../../integrations/visionConfig';
import { BUILTIN_BEVERAGE_MAP } from '../../data/beverages';
import { search } from '../../engine/search';
import { scale } from '../../engine/nutrition';
import { useAllFoods, useSettings } from '../hooks';
import { useApp } from '../store';
import { g1, kcal } from '../format';
import { Button, Field, Note, NumberInput, Sheet, TextInput, cx } from '../components/ui';
import { defaultMealFor, MealPicker } from '../components/shared';
import { FoodBrowser } from '../components/FoodBrowser';

// ───────────────────────── (+) menüsü ─────────────────────────

export function AddMenuSheet() {
  const { replace, close, date, toast } = useApp();
  const item = (icon: ReactNode, label: string, sub: string, onClick: () => void, tone = 'bg-tealsoft text-teal') => (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-3 text-left transition hover:border-teal hover:bg-sunk">
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        <span className="block text-[12.5px] text-muted">{sub}</span>
      </span>
    </button>
  );
  return (
    <Sheet title="Ekle" onClose={close}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {item(<Utensils size={20} />, 'Yemek ekle', 'Ara, favoriler, son yenenler', () => replace({ kind: 'foodSearch' }))}
        {item(<CupSoda size={20} />, 'İçecek ekle', 'Kahve, çay, ayran ve diğerleri', () => replace({ kind: 'beverage' }), 'bg-[rgb(var(--coffee)/0.12)] text-coffee')}
        {item(<GlassWater size={20} />, 'Su ekle', 'Bardak, şişe ya da istediğin miktar', () => replace({ kind: 'beverage', beverage: BUILTIN_BEVERAGE_MAP.get('bv:su')!, presetMl: 250 }), 'bg-[rgb(var(--water)/0.12)] text-water')}
        {item(<Dumbbell size={20} />, 'Aktivite ekle', 'Yürüyüş, koşu, spor', () => replace({ kind: 'activity' }), 'bg-leafsoft text-leaf')}
        {item(<Scale size={20} />, 'Kilo ekle', 'Kilo ve vücut ölçüleri', () => replace({ kind: 'weight' }))}
        {item(<ScanBarcode size={20} />, 'Barkod okut', 'Paketli ürün (Open Food Facts)', () => replace({ kind: 'barcode' }))}
        {item(<Camera size={20} />, 'Fotoğraftan ekle', 'Yemek fotoğrafı', () => replace({ kind: 'photo' }))}
        {item(<ChefHat size={20} />, 'Tarif oluştur', 'Malzemelerden hesapla', () => replace({ kind: 'recipe' }), 'bg-leafsoft text-leaf')}
      </div>
      <Button
        variant="soft"
        className="mt-3 w-full"
        onClick={async () => {
          const e = await repo.logBeverage({ beverage: BUILTIN_BEVERAGE_MAP.get('bv:su')!, baseMl: 250, date });
          toast('250 ml su eklendi', { label: 'Geri al', run: () => repo.deleteBeverageEntry(e.id) });
          close();
        }}
      >
        <GlassWater size={18} /> Tek dokunuşla +250 ml su
      </Button>
    </Sheet>
  );
}

export function FoodSearchSheet({ mealId, photoId }: { mealId?: string; photoId?: string }) {
  const { close, open } = useApp();
  const settings = useSettings();
  const mealName = settings?.meals.find((m) => m.id === mealId)?.name;
  return (
    <Sheet title={mealName ? `${mealName} · yemek ekle` : 'Yemek ekle'} onClose={close} wide>
      {photoId && <Note className="mb-3">Seçtiğin yemek, fotoğrafla birlikte kaydedilecek.</Note>}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[
          [<ScanBarcode key="b" size={18} />, 'Barkod', () => open({ kind: 'barcode', mealId })],
          [<Camera key="c" size={18} />, 'Fotoğraf', () => open({ kind: 'photo', mealId })],
          [<PenLine key="p" size={18} />, 'Yeni yemek', () => open({ kind: 'customFood', logAfter: true, mealId })],
          [<ChefHat key="r" size={18} />, 'Tarif', () => open({ kind: 'recipe' })],
        ].map(([icon, label, fn]) => (
          <button key={label as string} type="button" onClick={fn as () => void} className="flex flex-col items-center gap-1 rounded-2xl bg-sunk py-2.5 text-[12px] font-semibold text-ink hover:bg-tealsoft">
            {icon as ReactNode}
            {label as string}
          </button>
        ))}
      </div>
      <FoodBrowser mealId={mealId} photoId={photoId} autoFocus />
    </Sheet>
  );
}

// ───────────────────────── Barkod ─────────────────────────

export function BarcodeSheet({ mealId }: { mealId?: string }) {
  const { close, replace, toast } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<ScanStop | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const lookup = async (raw: string) => {
    const c = raw.replace(/\s/g, '');
    stopRef.current?.();
    setScanning(false);
    setProduct(null);
    setNotFound(null);
    if (!validBarcode(c)) return setMsg({ tone: 'warn', text: 'Geçerli bir barkod 8, 12, 13 veya 14 haneden oluşur.' });
    setCode(c);
    setBusy(true);
    setMsg(null);
    const local = await db.foods.where('barcode').equals(c).first();
    if (local && !local.archived) {
      setBusy(false);
      return replace({ kind: 'portion', food: local, mealId });
    }
    const r = await lookupBarcode(c);
    setBusy(false);
    if (r.status === 'found') setProduct(r.product);
    else if (r.status === 'not_found') setNotFound(c);
    else if (r.status === 'offline') setMsg({ tone: 'warn', text: 'İnternet bağlantısı yok. Ürünü manuel ekleyebilir ya da bağlantı gelince tekrar deneyebilirsin.' }), setNotFound(c);
    else setMsg({ tone: 'warn', text: `Arama yapılamadı (${r.message}). Ürünü manuel ekleyebilirsin.` }), setNotFound(c);
  };

  const start = async () => {
    if (!videoRef.current) return;
    setMsg(null);
    setScanning(true);
    stopRef.current = await startScan(
      videoRef.current,
      (c) => lookup(c),
      (m) => {
        setScanning(false);
        setMsg({ tone: 'warn', text: m });
      },
    );
  };

  const saveProduct = async (p: OffProduct) => {
    const input = offToFoodInput(p);
    const food = await repo.saveUserFood({
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      basis: input.basis,
      per100: input.per100,
      serving: input.serving,
      categoryId: 'paketli',
      source: 'off',
      confidence: p.incomplete || p.unverified ? 'low' : 'medium',
      sourceNote: `${OFF_ATTRIBUTION}.${p.incomplete ? ` Eksik değerler: ${p.missing.join(', ')}.` : ''}`,
    });
    toast('Ürün kütüphanene eklendi');
    replace({ kind: 'portion', food, mealId });
  };

  return (
    <Sheet title="Barkod ile ekle" onClose={close}>
      <div className="space-y-4">
        <div className={cx('relative overflow-hidden rounded-2xl bg-[rgb(10_20_18)]', scanning ? 'aspect-[4/3]' : 'hidden')}>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-teal/80 shadow-[0_0_12px_rgb(var(--teal))]" />
        </div>
        {!scanning && (
          <Button className="w-full" size="lg" onClick={start} disabled={!cameraSupported()}>
            <Camera size={20} /> Kamerayla tara
          </Button>
        )}
        {scanning && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              stopRef.current?.();
              setScanning(false);
            }}
          >
            Taramayı durdur
          </Button>
        )}
        {!cameraSupported() && <Note>Kamera bu ortamda kullanılamıyor (HTTPS bağlantısı ve kamera izni gerekir). Barkod numarasını elle girebilirsin.</Note>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
        >
          <TextInput inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barkod numarası (ör. 8690504000000)" aria-label="Barkod numarası" />
          <Button type="submit" disabled={busy || !code.trim()}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'Ara'}
          </Button>
        </form>
        {msg && <Note tone={msg.tone}>{msg.text}</Note>}
        {product && (
          <div className="rounded-2xl border border-line p-3">
            <div className="flex gap-3">
              {product.imageUrl && <img src={product.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0">
                <p className="font-bold">{product.name}</p>
                {product.brand && <p className="text-[13px] text-muted">{product.brand}</p>}
                <p className="num mt-1 text-[13px]">
                  100 {product.basis}: <b>{product.missing.includes('kalori') ? '?' : kcal(product.per100.kcal)} kcal</b> · P {g1(product.per100.protein)} · K {g1(product.per100.carb)} · Y {g1(product.per100.fat)}
                </p>
                {product.servingLabel && <p className="text-[12px] text-muted">Porsiyon: {product.servingLabel}</p>}
              </div>
            </div>
            {product.incomplete && (
              <Note tone="warn" className="mt-3">
                Eksik değerler: {product.missing.join(', ')}. Bu alanlar 0 olarak görünür; kaydettikten sonra düzenleyebilirsin.
              </Note>
            )}
            {product.unverified && <Note className="mt-2">Bu ürünün besin değerleri Open Food Facts’te henüz doğrulanmamış.</Note>}
            <p className="mt-2 text-[11px] text-muted">{OFF_ATTRIBUTION}</p>
            <div className="mt-3 flex gap-2">
              {product.missing.includes('kalori') ? (
                <Button className="flex-1" onClick={() => replace({ kind: 'customFood', barcode: product.barcode, logAfter: true, mealId, name: product.name })}>
                  Değerleri elle gir
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => saveProduct(product)}>
                  Kaydet ve ekle
                </Button>
              )}
            </div>
          </div>
        )}
        {notFound && !msg && <Note>Bu barkod ({notFound}) Open Food Facts’te bulunamadı.</Note>}
        {notFound && (
          <Button variant="soft" className="w-full" onClick={() => replace({ kind: 'customFood', barcode: notFound, logAfter: true, mealId })}>
            Ürünü manuel ekle
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// ───────────────────────── Fotoğraf ─────────────────────────

interface Row {
  item: VisionItem;
  selected: boolean;
  matchId: string | 'ai';
  grams: number;
  options: Food[];
}

export function PhotoSheet({ mealId }: { mealId?: string }) {
  const { close, replace, date, toast, setTab } = useApp();
  const settings = useSettings();
  const foods = useAllFoods();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState('');
  const [meal, setMeal] = useState<string | undefined>(mealId);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const configured = !!settings?.visionApiKey;
  const meals = settings?.meals ?? repo.DEFAULT_MEALS;

  const analyze = async () => {
    if (!file || !settings?.visionApiKey) return;
    setBusy(true);
    setErr('');
    const { analyzeFoodPhoto } = await import('../../integrations/vision');
    const r = await analyzeFoodPhoto(settings.visionApiKey, file);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    setNotes(r.result.notes);
    setRows(
      r.result.items.map((item) => {
        const options = search(foods, item.searchName || item.name, { limit: 3 });
        return { item, selected: true, matchId: options[0]?.id ?? 'ai', grams: Math.round(item.grams), options };
      }),
    );
  };

  const rowKcal = (r: Row) => {
    if (r.matchId === 'ai') return r.item.grams > 0 ? (r.item.kcal * r.grams) / r.item.grams : r.item.kcal;
    const f = r.options.find((o) => o.id === r.matchId);
    return f ? scale(f.per100, r.grams).kcal : 0;
  };

  const savePhoto = async () => {
    if (!file) return undefined;
    const id = repo.uid('img');
    await db.photos.put({ id, blob: file, createdAt: Date.now() });
    return id;
  };

  const confirm = async () => {
    if (!rows) return;
    const photoId = await savePhoto();
    const chosenMeal = meal ?? defaultMealFor(meals);
    let n = 0;
    for (const r of rows.filter((x) => x.selected && x.grams > 0)) {
      const matched = r.options.find((o) => o.id === r.matchId);
      const food: Food = matched ?? {
        id: `ai:${repo.uid()}`,
        name: r.item.name,
        aliases: [],
        categoryId: 'kisisel',
        cuisine: 'tr',
        basis: 'g',
        per100: { kcal: (r.item.kcal / r.item.grams) * 100, protein: (r.item.protein / r.item.grams) * 100, carb: (r.item.carb / r.item.grams) * 100, fat: (r.item.fat / r.item.grams) * 100, fiber: null, sugar: null },
        servings: [],
        source: 'ai-estimate',
        confidence: 'low',
        isUser: false,
        createdAt: 0,
        updatedAt: 0,
      };
      await repo.logFood({ food, serving: { id: 'g', unit: 'g', label: 'Gram', amount: 1 }, count: r.grams, date, mealId: chosenMeal, photoId, note: 'Fotoğraftan, kullanıcı onaylı' });
      n++;
    }
    toast(`${n} yiyecek günlüğe eklendi`);
    close();
  };

  return (
    <Sheet
      title="Fotoğraftan ekle"
      onClose={close}
      wide
      footer={
        rows ? (
          <Button className="w-full" size="lg" onClick={confirm} disabled={!rows.some((r) => r.selected)}>
            Onayla ve ekle · {kcal(rows.filter((r) => r.selected).reduce((s, r) => s + rowKcal(r), 0))} kcal
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-line bg-sunk text-muted hover:border-teal">
          {url ? <img src={url} alt="Seçilen yemek fotoğrafı" className="max-h-72 w-full object-contain" /> : (
            <span className="flex flex-col items-center gap-2 py-10">
              <ImagePlus size={28} />
              <span className="font-semibold">Fotoğraf çek ya da seç</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRows(null);
              setErr('');
            }}
          />
        </label>
        <Note tone="warn">Fotoğraftan kalori her zaman doğru belirlenemez: gizli yağ, sos, şeker ve porsiyon derinliği görüntüden anlaşılmaz. Sonuçlar tahmindir ve sen onaylamadan günlüğe eklenmez.</Note>

        {!configured && (
          <div className="space-y-3">
            <Note>
              Görsel analiz servisi yapılandırılmadı. Otomatik tanıma için Profil › Entegrasyonlar bölümüne bir Anthropic API anahtarı ekleyebilirsin. Şimdilik fotoğrafı manuel bir yemek kaydına bağlayabilirsin.
            </Note>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!file}
                onClick={async () => {
                  const photoId = await savePhoto();
                  replace({ kind: 'foodSearch', mealId, photoId });
                }}
              >
                Fotoğrafı manuel kayda ekle
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  close();
                  setTab('profile');
                }}
              >
                Servisi yapılandır
              </Button>
            </div>
          </div>
        )}

        {configured && !rows && (
          <Button className="w-full" size="lg" disabled={!file || busy} onClick={analyze}>
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Analiz ediliyor…
              </>
            ) : (
              'Fotoğrafı analiz et'
            )}
          </Button>
        )}
        {configured && <p className="text-[11px] text-muted">Fotoğraf yalnızca analiz için Anthropic API’ye ({VISION_MODEL}) gönderilir.</p>}
        {err && <Note tone="warn">{err}</Note>}

        {rows && (
          <div className="space-y-3">
            {rows.length === 0 && <Note>Fotoğrafta yiyecek tanınamadı. Manuel olarak ekleyebilirsin.</Note>}
            {rows.map((r, i) => (
              <div key={i} className={cx('rounded-2xl border p-3', r.selected ? 'border-teal/50' : 'border-line opacity-60')}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.selected} onChange={(e) => setRows((l) => l!.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))} className="h-5 w-5 accent-[rgb(var(--teal))]" />
                  <span className="font-bold">{r.item.name}</span>
                  <span className="text-[12px] text-muted">· güven {r.item.confidence === 'high' ? 'yüksek' : r.item.confidence === 'medium' ? 'orta' : 'düşük'}</span>
                </label>
                <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
                  <Field label="Veritabanı eşleşmesi">
                    <select value={r.matchId} onChange={(e) => setRows((l) => l!.map((x, j) => (j === i ? { ...x, matchId: e.target.value } : x)))} className="h-11 w-full rounded-xl border border-line bg-surface px-2 text-[14px]">
                      {r.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({kcal(o.per100.kcal)} kcal/100 g)
                        </option>
                      ))}
                      <option value="ai">Görsel tahmin değeri ({kcal(r.item.kcal)} kcal / {Math.round(r.item.grams)} g)</option>
                    </select>
                  </Field>
                  <Field label="Miktar">
                    <NumberInput value={r.grams} onChange={(v) => setRows((l) => l!.map((x, j) => (j === i ? { ...x, grams: v ?? 0 } : x)))} suffix="g" ariaLabel="Gram" />
                  </Field>
                </div>
                <p className="num mt-1 text-right text-[13px] font-semibold">{kcal(rowKcal(r))} kcal</p>
              </div>
            ))}
            {notes && <Note>{notes}</Note>}
            <Field label="Öğün">
              <MealPicker meals={meals} value={meal ?? defaultMealFor(meals)} onChange={setMeal} />
            </Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}
