import { useState } from 'react';
import { Check, LoaderCircle, RotateCcw } from 'lucide-react';
import {
  interests,
  type Interest,
  type Profile,
  type Reaction,
} from '@/lib/model';
import { effectiveWeights, learnedWeights } from '@/lib/recommendations';
import { Slider } from '@/components/ui/slider';

export function EnginePanel({
  profile,
  feedback,
  onSave,
}: {
  profile: Profile;
  feedback: Reaction[];
  onSave: (p: Profile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<Record<Interest, number>>>(
    profile.weights || {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const learned = learnedWeights(feedback);
  const effective = effectiveWeights({ ...profile, weights: draft }, feedback);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile.weights || {});

  function setWeight(tag: Interest, value: number | undefined) {
    setDraft((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[tag];
      else next[tag] = value;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave({ ...profile, weights: draft });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="engine-panel">
      <div className="engine-legend" aria-hidden="true">
        <span>−3</span>
        <span>neutre</span>
        <span>+3</span>
      </div>
      <div className="engine-list">
        {(Object.keys(interests) as Interest[]).map((tag) => {
          const value = effective[tag] || 0;
          const manual = tag in draft;
          const learnedValue = learned[tag] || 0;
          const declared = profile.interests.includes(tag)
            ? 'choisi'
            : profile.avoid.includes(tag)
              ? 'évité'
              : null;
          return (
            <div className="engine-row" key={tag}>
              <div className="engine-head">
                <span className="engine-label">{interests[tag]}</span>
                <div className="engine-chips">
                  {declared && (
                    <span className={`engine-chip is-${declared}`}>
                      {declared}
                    </span>
                  )}
                  {learnedValue !== 0 && (
                    <span className="engine-chip is-learned">
                      appris {learnedValue > 0 ? '+' : ''}
                      {learnedValue.toFixed(1)}
                    </span>
                  )}
                  {manual && (
                    <span className="engine-chip is-manual">réglé</span>
                  )}
                </div>
                <strong
                  className={`engine-value ${
                    value >= 2 ? 'is-high' : value <= -2 ? 'is-low' : ''
                  }`}
                >
                  {value > 0 ? '+' : ''}
                  {value.toFixed(1)}
                </strong>
              </div>
              <div className="engine-control">
                <Slider
                  aria-label={`Poids de ${interests[tag]}`}
                  value={[value]}
                  min={-3}
                  max={3}
                  step={0.5}
                  onValueChange={(v) =>
                    setWeight(tag, Array.isArray(v) ? v[0] : v)
                  }
                />
                <button
                  type="button"
                  className="engine-reset"
                  disabled={!manual}
                  onClick={() => setWeight(tag, undefined)}
                  aria-label={`Revenir au réglage automatique de ${interests[tag]}`}
                  title="Réglage automatique"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Check size={17} />
        )}
        {busy ? 'Enregistrement…' : 'Enregistrer mes réglages'}
      </button>
    </div>
  );
}