import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Search } from 'lucide-react';
import { interests, type Profile, type Interest } from '@/lib/model';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
type Commune = {
  nom: string;
  code: string;
  centre: { coordinates: [number, number] };
};
export function ProfileEditor({
  initial,
  onSave,
  demo = false,
}: {
  initial: Profile;
  onSave: (p: Profile) => Promise<void>;
  demo?: boolean;
}) {
  const [p, setP] = useState<Profile>(initial);
  const [step, setStep] = useState(initial.completed ? 1 : 0);
  const [postal, setPostal] = useState('');
  const [cities, setCities] = useState<Commune[]>([]);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  function toggle(key: 'interests' | 'avoid', value: Interest) {
    setP((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((x) => x !== value)
        : [...prev[key], value],
      [key === 'interests' ? 'avoid' : 'interests']: prev[
        key === 'interests' ? 'avoid' : 'interests'
      ].filter((x) => x !== value),
    }));
  }
  async function search(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const result = await api<Commune[]>(
        `communes?postal=${encodeURIComponent(postal)}`,
      );
      setCities(result);
      if (!result.length)
        setError('Aucune commune trouvée pour ce code postal.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  async function save(completed: boolean) {
    setError('');
    setBusy(true);
    try {
      await onSave({ ...p, completed });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-editor">
      <div className="step-meta">
        <span className="eyebrow">TON PROFIL · {step + 1} / 3</span>
        <span>Quelques minutes, à ton rythme</span>
      </div>
      <Progress
        aria-label="Progression du questionnaire"
        value={((step + 1) / 3) * 100}
      />
      <h2>
        {
          [
            'D’abord, ton quotidien.',
            'Qu’est-ce qui te donne envie ?',
            'Ce qui compte vraiment.',
          ][step]
        }
      </h2>
      <p className="editor-lead">
        {
          [
            'On cherche autour de toi. Pas besoin de ton adresse précise.',
            'Pas besoin de choisir un métier. Pars de ce que tu aimes faire.',
            'Sépare tes envies des contraintes qui ne peuvent pas changer.',
          ][step]
        }
      </p>
      {demo && (
        <p className="notice">
          Essai sur cet écran uniquement. Les offres fictives sont situées à
          Lyon.
        </p>
      )}
      {step === 0 && (
        <div className="form-stack">
          <form onSubmit={search}>
            <label>
              Ton code postal
              <div className="input-action">
                <input
                  value={postal}
                  onChange={(e) => setPostal(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  required
                  placeholder="69001"
                  aria-label="Code postal"
                />
                <button
                  className="icon-button"
                  aria-label="Chercher une commune"
                  disabled={searching}
                >
                  <Search size={19} />
                </button>
              </div>
            </label>
          </form>
          {cities.length > 0 && (
            <div className="city-results">
              {cities.map((c) => (
                <button
                  key={c.code}
                  className={p.commune === c.code ? 'selected' : ''}
                  onClick={() => {
                    setP({
                      ...p,
                      city: c.nom,
                      commune: c.code,
                      lon: c.centre.coordinates[0],
                      lat: c.centre.coordinates[1],
                    });
                    setCities([]);
                  }}
                >
                  <MapPin size={16} />
                  {c.nom}
                  {p.commune === c.code && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
          {p.city && (
            <p className="selected-city">
              <MapPin size={17} />
              {p.city}
            </p>
          )}
          <div className="range-label">
            Distance maximale <strong>{p.radius} km</strong>
          </div>
          <Slider
            aria-label="Distance maximale en kilomètres"
            value={[p.radius]}
            min={5}
            max={100}
            step={5}
            onValueChange={(v) =>
              setP({ ...p, radius: Array.isArray(v) ? v[0] : v })
            }
          />
          <p className="form-help">
            Distance à vol d’oiseau autour du centre de la commune. Vérifie le
            trajet réel sur l’annonce.
          </p>
          <div>
            <span className="field-title">Les contrats possibles</span>
            <p className="form-help">Aucune sélection = tous les contrats.</p>
            <div className="choices">
              {Object.entries({
                CDI: 'CDI',
                CDD: 'CDD',
                MIS: 'Intérim',
                SAI: 'Saisonnier',
                alternance: 'Alternance',
              }).map(([key, label]) => (
                <button
                  className={
                    p.contracts.includes(key) ? 'choice selected' : 'choice'
                  }
                  aria-pressed={p.contracts.includes(key)}
                  key={key}
                  onClick={() =>
                    setP({
                      ...p,
                      contracts: p.contracts.includes(key)
                        ? p.contracts.filter((x) => x !== key)
                        : [...p.contracts, key],
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="form-stack">
          <span className="field-title">J’aimerais…</span>
          <div className="interest-grid">
            {Object.entries(interests).map(([key, label]) => (
              <button
                key={key}
                className={
                  p.interests.includes(key as Interest)
                    ? 'interest selected'
                    : 'interest'
                }
                aria-pressed={p.interests.includes(key as Interest)}
                onClick={() => toggle('interests', key as Interest)}
              >
                {label}
                <span>
                  {p.interests.includes(key as Interest) ? (
                    <Check size={16} />
                  ) : (
                    '+'
                  )}
                </span>
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() => setP({ ...p, interests: [] })}
          >
            Je ne sais pas encore
          </button>
          <span className="field-title">
            J’aimerais éviter… <small>(préférence)</small>
          </span>
          <div className="choices">
            {Object.entries(interests).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={p.avoid.includes(key as Interest)}
                className={
                  p.avoid.includes(key as Interest)
                    ? 'choice selected'
                    : 'choice'
                }
                onClick={() => toggle('avoid', key as Interest)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="form-help">
            Ces préférences orientent les propositions. Tu peux toujours les
            changer.
          </p>
        </div>
      )}
      {step === 2 && (
        <div className="form-stack">
          <span className="field-title">Mes contraintes indispensables</span>
          <label className="check-row" htmlFor="no-night">
            <Checkbox
              id="no-night"
              checked={p.noNight}
              onCheckedChange={(v) => setP({ ...p, noNight: Boolean(v) })}
            />
            <span>Je ne peux pas travailler la nuit</span>
          </label>
          <label className="check-row" htmlFor="no-weekend">
            <Checkbox
              id="no-weekend"
              checked={p.noWeekend}
              onCheckedChange={(v) => setP({ ...p, noWeekend: Boolean(v) })}
            />
            <span>Je ne peux pas travailler le week-end</span>
          </label>
          <p className="form-help">
            Si l’annonce ne permet pas de vérifier une contrainte, elle sera
            écartée. Tu peux ainsi obtenir moins de résultats.
          </p>
          <label className="check-row" htmlFor="beginner-only">
            <Checkbox
              id="beginner-only"
              checked={p.experience === 'beginner'}
              onCheckedChange={(v) =>
                setP({ ...p, experience: v ? 'beginner' : 'any' })
              }
            />
            <span>Uniquement les offres ouvertes aux débutants</span>
          </label>
          <label className="check-row" htmlFor="training">
            <Checkbox
              id="training"
              checked={p.training}
              onCheckedChange={(v) => setP({ ...p, training: Boolean(v) })}
            />
            <span>Je suis ouverte ou ouvert à une formation</span>
          </label>
          <div className="range-label">
            Ma dose de découverte <strong>{p.discovery} %</strong>
          </div>
          <Slider
            aria-label="Part de découverte"
            min={15}
            max={100}
            step={5}
            value={[p.discovery]}
            onValueChange={(v) =>
              setP({ ...p, discovery: Array.isArray(v) ? v[0] : v })
            }
          />
          <p className="form-help">
            Des métiers voisins et inattendus, en respectant toujours tes
            contraintes.
          </p>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        {step > 0 ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft size={17} />
            Retour
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button
            className="primary-button"
            onClick={() => {
              if (step === 0 && !p.commune) {
                setError('Choisis une commune pour continuer.');
                return;
              }
              setError('');
              setStep(step + 1);
            }}
          >
            Continuer
            <ArrowRight size={17} />
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => save(true)}
          >
            {busy ? 'Enregistrement…' : 'Trouver mes pistes'}
            <ArrowRight size={17} />
          </button>
        )}
      </div>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => save(initial.completed)}
      >
        Enregistrer et reprendre plus tard
      </button>
    </div>
  );
}
