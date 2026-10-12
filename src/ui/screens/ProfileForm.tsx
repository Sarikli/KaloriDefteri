import { useMemo, useState } from 'react';
import type { ActivityLevel, GoalType, Sex, UserProfile } from '../../db/types';
import * as repo from '../../db/repo';
import { ACTIVITY_LEVELS, calcGoal, GOAL_LABEL } from '../../engine/energy';
import { toDateKey } from '../../engine/dates';
import { kcal } from '../format';
import { Button, Field, Note, NumberInput, Segmented, TextInput, cx } from '../components/ui';

export function ProfileForm({ profile, onSaved, submitLabel = 'Kaydet ve hedefi hesapla' }: { profile?: UserProfile | null; onSaved?: () => void; submitLabel?: string }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [birthYear, setBirthYear] = useState<number | null>(profile?.birthYear ?? null);
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [height, setHeight] = useState<number | null>(profile?.heightCm ?? null);
  const [weight, setWeight] = useState<number | null>(profile?.currentWeightKg ?? null);
  const [level, setLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'sedentary');
  const [goal, setGoal] = useState<GoalType>(profile?.goal ?? 'maintain');
  const [target, setTarget] = useState<number | null>(profile?.targetWeightKg ?? null);
  const [rate, setRate] = useState<number>(profile?.rateKgPerWeek || 0.5);
  const [manual, setManual] = useState<number | null>(profile?.manualKcal ?? null);
  const [special, setSpecial] = useState(profile?.specialCondition ?? false);
  const [saving, setSaving] = useState(false);

  const valid = !!birthYear && birthYear > 1900 && birthYear <= new Date().getFullYear() - 5 && !!height && height > 90 && height < 250 && !!weight && weight > 25 && weight < 400 && (goal !== 'manual' || (!!manual && manual > 500));
  const calc = useMemo(
    () => (valid ? calcGoal({ birthYear: birthYear!, sex, heightCm: height!, currentWeightKg: weight!, activityLevel: level, goal, rateKgPerWeek: goal === 'maintain' || goal === 'manual' ? 0 : rate, manualKcal: manual ?? undefined, specialCondition: special }) : null),
    [valid, birthYear, sex, height, weight, level, goal, rate, manual, special],
  );

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const weightChanged = !profile || profile.currentWeightKg !== weight;
    await repo.saveProfile({
      name: name.trim() || undefined,
      birthYear: birthYear!,
      sex,
      heightCm: height!,
      startWeightKg: profile?.startWeightKg ?? weight!,
      currentWeightKg: weight!,
      activityLevel: level,
      goal,
      targetWeightKg: target ?? undefined,
      rateKgPerWeek: goal === 'maintain' || goal === 'manual' ? 0 : rate,
      manualKcal: goal === 'manual' ? (manual ?? undefined) : undefined,
      specialCondition: special,
    });
    if (weightChanged) await repo.logWeight({ date: toDateKey(), weightKg: weight! });
    setSaving(false);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Adın (isteğe bağlı)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Sadece selamlama için" />
        </Field>
        <Field label="Doğum yılı">
          <NumberInput value={birthYear} onChange={setBirthYear} placeholder="ör. 1994" ariaLabel="Doğum yılı" />
        </Field>
        <Field label="Boy">
          <NumberInput value={height} onChange={setHeight} suffix="cm" ariaLabel="Boy (cm)" />
        </Field>
        <Field label="Kilo">
          <NumberInput value={weight} onChange={setWeight} suffix="kg" ariaLabel="Kilo (kg)" />
        </Field>
      </div>
      <Field label="Formülde kullanılacak biyolojik cinsiyet" hint="Mifflin–St Jeor formülü bazal metabolizmayı buna göre ayarlar.">
        <Segmented
          value={sex}
          onChange={setSex}
          options={[
            { value: 'female', label: 'Kadın' },
            { value: 'male', label: 'Erkek' },
          ]}
        />
      </Field>
      <Field label="Günlük yaşam aktivite düzeyi" hint="Spor ve yürüyüşlerini buraya katma; onları ayrıca kaydedeceksin.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={cx('rounded-2xl border px-3 py-2.5 text-left transition', level === l ? 'border-teal bg-tealsoft' : 'border-line hover:bg-sunk')}
            >
              <span className="block font-semibold">{ACTIVITY_LEVELS[l].label}</span>
              <span className="block text-[12px] text-muted">{ACTIVITY_LEVELS[l].desc}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Hedef">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GOAL_LABEL) as GoalType[]).map((g) => (
            <button key={g} type="button" onClick={() => setGoal(g)} aria-pressed={goal === g} className={cx('h-11 rounded-xl border text-[14px] font-semibold transition', goal === g ? 'border-teal bg-tealsoft text-teal' : 'border-line hover:bg-sunk')}>
              {GOAL_LABEL[g]}
            </button>
          ))}
        </div>
      </Field>
      {(goal === 'lose' || goal === 'gain') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hedef kilo">
            <NumberInput value={target} onChange={setTarget} suffix="kg" ariaLabel="Hedef kilo" />
          </Field>
          <Field label="Haftalık hız">
            <Segmented
              size="sm"
              value={rate}
              onChange={setRate}
              options={(goal === 'lose' ? [0.25, 0.5, 0.75] : [0.25, 0.5]).map((v) => ({ value: v, label: `${v.toLocaleString('tr-TR')} kg` }))}
            />
          </Field>
        </div>
      )}
      {goal === 'manual' && (
        <Field label="Günlük kalori hedefi">
          <NumberInput value={manual} onChange={setManual} suffix="kcal" ariaLabel="Manuel kalori hedefi" />
        </Field>
      )}
      {goal === 'maintain' && (
        <Field label="Hedef kilo (isteğe bağlı)">
          <NumberInput value={target} onChange={setTarget} suffix="kg" ariaLabel="Hedef kilo" />
        </Field>
      )}
      <label className="flex items-start gap-2 text-[14px]">
        <input type="checkbox" checked={special} onChange={(e) => setSpecial(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--teal))]" />
        <span>Hamilelik, emzirme veya özel bir tıbbi durum var</span>
      </label>

      {calc && (
        <div className="rounded-2xl bg-sunk p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Günlük temel hedef</span>
            <span className="num text-[24px] font-extrabold text-teal">{kcal(calc.target)} kcal</span>
          </div>
          <ol className="num mt-2 space-y-1 text-[12.5px] text-muted">
            {calc.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-muted">Bu değerler tahmindir; gerçek ihtiyacın kişiden kişiye farklıdır. Birkaç haftalık kilo eğilimine göre hedefi ayarlayabilirsin.</p>
          {calc.warnings.map((w) => (
            <Note key={w} tone="warn" className="mt-2">
              {w}
            </Note>
          ))}
        </div>
      )}
      <Button className="w-full" size="lg" disabled={!valid || saving} onClick={save}>
        {submitLabel}
      </Button>
    </div>
  );
}
