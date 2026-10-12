import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import type { ActivityEntry, ActivityType, Intensity } from '../../db/types';
import * as repo from '../../db/repo';
import { db } from '../../db/database';
import { ACTIVITIES, INTENSITY_LABEL } from '../../data/activities';
import { activityKcal, estimateActivitySteps } from '../../engine/activity';
import { hhmm, shortDateTR, timeOnDate, toDateKey } from '../../engine/dates';
import { useProfile } from '../hooks';
import { useApp } from '../store';
import { g1, int, kcal } from '../format';
import { Button, Chip, Field, Note, NumberInput, Segmented, Sheet, TextInput } from '../components/ui';
import { TimeInput } from '../components/shared';

export function ActivitySheet({ entry }: { entry?: ActivityEntry }) {
  const { close, date, toast } = useApp();
  const profile = useProfile();
  const [type, setType] = useState<ActivityType>(entry?.type ?? 'yuruyus');
  const [intensity, setIntensity] = useState<Intensity>(entry?.intensity ?? 'orta');
  const [duration, setDuration] = useState<number | null>(entry?.durationMin ?? 30);
  const [distance, setDistance] = useState<number | null>(entry?.distanceKm ?? null);
  const [metOverride, setMetOverride] = useState<number | null>(entry && entry.met !== ACTIVITIES[entry.type].met[entry.intensity] ? entry.met : null);
  const [name, setName] = useState(entry?.name ?? '');
  const [time, setTime] = useState(entry ? hhmm(entry.time) : date === toDateKey() ? hhmm(Date.now() - 30 * 60_000) : '18:00');
  const def = ACTIVITIES[type];
  const met = metOverride ?? def.met[intensity];
  const w = profile?.currentWeightKg ?? 70;
  const h = profile?.heightCm ?? 170;
  const { gross, net } = activityKcal(met, w, duration ?? 0);
  const steps = estimateActivitySteps(type, intensity, duration ?? 0, distance ?? undefined, h);

  const save = async () => {
    if (!duration || duration <= 0) return;
    const d = entry?.date ?? date;
    const input = { type, intensity, durationMin: duration, distanceKm: def.hasDistance ? (distance ?? undefined) : undefined, met: metOverride ?? undefined, name: name || undefined, date: d, time: timeOnDate(d, time) };
    if (entry) await repo.updateActivity(entry.id, input);
    else await repo.logActivity(input);
    toast(entry ? 'Aktivite güncellendi' : `${def.label} eklendi · net ${kcal(net)} kcal`);
    close();
  };

  return (
    <Sheet
      title={entry ? 'Aktiviteyi düzenle' : 'Aktivite ekle'}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {entry && (
            <Button
              variant="danger"
              aria-label="Aktiviteyi sil"
              onClick={async () => {
                await repo.deleteActivity(entry.id);
                toast('Aktivite silindi');
                close();
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" size="lg" disabled={!duration} onClick={save}>
            {entry ? 'Kaydet' : 'Ekle'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACTIVITIES) as ActivityType[]).map((t) => (
            <Chip key={t} active={t === type} onClick={() => setType(t)}>
              {ACTIVITIES[t].label}
            </Chip>
          ))}
        </div>
        {(type === 'ozel' || type === 'diger') && (
          <Field label="Aktivite adı">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Tenis, merdiven, bahçe işi" />
          </Field>
        )}
        <Field label="Yoğunluk" hint={def.intensityHint[intensity]}>
          <Segmented value={intensity} onChange={setIntensity} options={(['hafif', 'orta', 'yuksek'] as Intensity[]).map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Süre">
            <NumberInput value={duration} onChange={setDuration} suffix="dk" min={0} ariaLabel="Süre (dakika)" />
          </Field>
          {def.hasDistance ? (
            <Field label="Mesafe (isteğe bağlı)">
              <NumberInput value={distance} onChange={setDistance} suffix="km" min={0} ariaLabel="Mesafe (km)" />
            </Field>
          ) : (
            <Field label="Başlangıç saati">
              <TimeInput value={time} onChange={setTime} />
            </Field>
          )}
        </div>
        {def.hasDistance && (
          <Field label="Başlangıç saati">
            <TimeInput value={time} onChange={setTime} />
          </Field>
        )}
        <Field label="MET değeri" hint="Compendium of Physical Activities tablosundan; biliyorsan değiştirebilirsin.">
          <NumberInput value={met} onChange={(v) => setMetOverride(v)} min={1} max={23} ariaLabel="MET" />
        </Field>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-sunk p-3 text-center">
          <div>
            <div className="text-[12px] font-semibold text-muted">Brüt</div>
            <div className="num text-[19px] font-extrabold">{kcal(gross)}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-leaf">Net (hedefe)</div>
            <div className="num text-[19px] font-extrabold text-leaf">{kcal(net)}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-muted">Tahmini adım</div>
            <div className="num text-[19px] font-extrabold">{steps ? int(steps) : '—'}</div>
          </div>
        </div>
        <Note>
          Brüt = MET × {g1(w)} kg × saat. Net harcama, dinlenme sırasında zaten yakılan 1 MET düşülerek hesaplanır; çünkü dinlenme harcaması günlük temel hedefinde (BMR) zaten var. Değerler tahmindir.
          {steps > 0 && ' Bu aktivitenin tahmini adımları, günlük adım sayından düşülür; aynı hareket iki kez sayılmaz.'}
        </Note>
      </div>
    </Sheet>
  );
}

export function WeightSheet() {
  const { close, date, toast } = useApp();
  const profile = useProfile();
  const recent = useLiveQuery(() => db.weights.orderBy('date').reverse().limit(8).toArray(), []) ?? [];
  const [d, setD] = useState(date);
  const [weight, setWeight] = useState<number | null>(profile?.currentWeightKg ?? null);
  const [waist, setWaist] = useState<number | null>(null);
  const [hip, setHip] = useState<number | null>(null);
  const [neck, setNeck] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const save = async () => {
    if (weight === null && waist === null && hip === null && neck === null) return;
    await repo.logWeight({ date: d, weightKg: weight, waistCm: waist, hipCm: hip, neckCm: neck, note: note || undefined });
    toast('Ölçüm kaydedildi');
    close();
  };
  return (
    <Sheet title="Kilo ve ölçü ekle" onClose={close} footer={<Button className="w-full" size="lg" onClick={save}>Kaydet</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarih">
            <input type="date" value={d} max={toDateKey()} onChange={(e) => setD(e.target.value)} className="num h-11 w-full rounded-xl border border-line bg-surface px-3" />
          </Field>
          <Field label="Kilo">
            <NumberInput value={weight} onChange={setWeight} suffix="kg" min={20} max={400} ariaLabel="Kilo (kg)" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Bel">
            <NumberInput value={waist} onChange={setWaist} suffix="cm" ariaLabel="Bel çevresi" />
          </Field>
          <Field label="Kalça">
            <NumberInput value={hip} onChange={setHip} suffix="cm" ariaLabel="Kalça çevresi" />
          </Field>
          <Field label="Boyun">
            <NumberInput value={neck} onChange={setNeck} suffix="cm" ariaLabel="Boyun çevresi" />
          </Field>
        </div>
        <Field label="Not">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. sabah, aç karnına" />
        </Field>
        <Note>Günlük kilo; su, tuz ve sindirime bağlı olarak 1–2 kg oynayabilir. Bu dalgalanmalar yağ kazanımı ya da kaybı anlamına gelmez. Eğilimi görmek için haftalık ortalamaya bak.</Note>
        {recent.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-bold text-muted">Son ölçümler</h3>
            <ul className="divide-y divide-line/70 text-[14px]">
              {recent.map((r) => (
                <li key={r.id} className="num flex items-center justify-between py-2">
                  <span>{shortDateTR(r.date)}</span>
                  <span className="flex items-center gap-3">
                    <b>{r.weightKg !== null ? `${g1(r.weightKg)} kg` : '—'}</b>
                    {r.waistCm ? <span className="text-muted">bel {g1(r.waistCm)}</span> : null}
                    <button type="button" aria-label="Ölçümü sil" className="text-muted hover:text-danger" onClick={() => repo.deleteWeight(r.id)}>
                      <Trash2 size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
