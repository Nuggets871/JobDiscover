import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Sparkles,
} from 'lucide-react';
import {
  domainPreferenceLabels,
  educationLabels,
  interests,
  type DesireAnalysis,
  type DomainPreference,
  type Education,
  type Profile,
  type Interest,
} from '@/lib/model';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { api } from '@/lib/api';
type Commune = {
  nom: string;
  code: string;
  centre: { coordinates: [number, number] };
  codesPostaux?: string[];
  codePostal?: string;
};
type CommuneResult = { communes: Commune[]; total: number };
export function ProfileEditor({
  initial,
  onSave,
}: {
  initial: Profile;
  onSave: (p: Profile) => Promise<void>;
}) {
  const [p, setP] = useState<Profile>(initial);
  const [postal, setPostal] = useState('');
  const [cities, setCities] = useState<Commune[]>([]);
  const [cityTotal, setCityTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [desireText, setDesireText] = useState(initial.desires);
  const [desireAnalyzing, setDesireAnalyzing] = useState(false);
  const [desireError, setDesireError] = useState('');
  const [desireResult, setDesireResult] = useState<DesireAnalysis | null>(null);
  const requestId = useRef(0);
  const skipPostalLookup = useRef(false);
  const zoneRef = useRef<HTMLElement>(null);
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
  function selectCity(city: Commune) {
    if (city.codePostal) {
      skipPostalLookup.current = true;
      setPostal(city.codePostal);
    }
    setP((previous) => ({
      ...previous,
      city: city.nom,
      commune: city.code,
      lon: city.centre.coordinates[0],
      lat: city.centre.coordinates[1],
    }));
    setCities([]);
    setCityTotal(0);
    setError('');
  }
  async function lookup(query: string, source: 'postal' | 'location') {
    const currentRequest = ++requestId.current;
    setError('');
    setSearching(true);
    try {
      const result = await api<CommuneResult>(`communes?${query}`);
      if (currentRequest !== requestId.current) return;
      setCities(result.communes);
      setCityTotal(result.total);
      if (!result.total) {
        setError(
          source === 'postal'
            ? 'Aucune commune trouvée pour ce code postal.'
            : 'Aucune commune trouvée autour de cette position.',
        );
      } else if (
        result.total === 1 &&
        (source === 'location' || postal.length === 5)
      ) {
        const city = result.communes[0];
        if (source === 'location' && city.codesPostaux?.[0]) {
          skipPostalLookup.current = true;
          setPostal(city.codesPostaux[0]);
        }
        selectCity(city);
      }
    } catch (cause) {
      if (currentRequest === requestId.current)
        setError((cause as Error).message);
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  }
  useEffect(() => {
    if (skipPostalLookup.current) {
      skipPostalLookup.current = false;
      return;
    }
    if (!postal.length) {
      setCities([]);
      setCityTotal(0);
      return;
    }
    const timeout = window.setTimeout(
      () => void lookup(`postal=${encodeURIComponent(postal)}`, 'postal'),
      150,
    );
    return () => window.clearTimeout(timeout);
  }, [postal]);
  async function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 300_000,
          }),
      );
      await lookup(
        `lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
        'location',
      );
    } catch {
      setError(
        'Impossible d’obtenir ta position. Autorise la localisation ou saisis ton code postal.',
      );
    } finally {
      setLocating(false);
    }
  }
  async function save(completed: boolean) {
    setError('');
    if (completed && !p.commune) {
      setError(
        cities.length > 1
          ? 'Choisis l’une des communes proposées pour continuer.'
          : 'Indique ton code postal ou utilise ta position pour choisir une commune.',
      );
      zoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...p, completed });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyzeDesire() {
    setDesireError('');
    setDesireAnalyzing(true);
    try {
      setDesireResult(await api<DesireAnalysis>('profile/desires', 'POST', { text: desireText }));
    } catch (cause) {
      setDesireError((cause as Error).message);
    } finally {
      setDesireAnalyzing(false);
    }
  }
  return (
    <div className="profile-editor">
      <h2>Tes préférences, d’un coup d’œil.</h2>
      <p className="editor-lead">
        La zone, tes envies et tes contraintes se règlent ici. Rien n’est
        définitif.
      </p>
      <section className="editor-section" ref={zoneRef}>
        <div className="editor-section-head">
          <span className="eyebrow">TA ZONE</span>
          <h3>Où chercher ?</h3>
        </div>
        <div className="form-stack">
          <label>
            Ton code postal
            <div className="input-action">
              <input
                value={postal}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 5);
                  requestId.current += 1;
                  setSearching(false);
                  setPostal(value);
                  setCities([]);
                  setCityTotal(0);
                  setError('');
                  if (p.commune)
                    setP({
                      ...p,
                      city: '',
                      commune: '',
                      lat: null,
                      lon: null,
                    });
                }}
                inputMode="numeric"
                maxLength={5}
                placeholder="69001"
                aria-label="Code postal"
                autoComplete="postal-code"
              />
              <button
                type="button"
                className="icon-button"
                title="Utiliser ma position actuelle"
                aria-label="Utiliser ma position actuelle"
                disabled={locating || searching}
                onClick={() => void locate()}
              >
                {locating ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <LocateFixed size={19} />
                )}
              </button>
              {cities.length > 0 && (
                <div
                  className="city-dropdown"
                  role="listbox"
                  aria-label="Communes trouvées"
                >
                  <div className="city-dropdown-head">
                    {cityTotal > cities.length
                      ? `${cities.length} premiers résultats sur ${cityTotal}. Continue à saisir pour affiner.`
                      : `${cityTotal} résultat${cityTotal > 1 ? 's' : ''}.`}
                  </div>
                  {cities.map((c) => (
                    <button
                      type="button"
                      key={`${c.code}-${c.codePostal || ''}`}
                      className="city-option"
                      role="option"
                      aria-selected={p.commune === c.code}
                      onClick={() => selectCity(c)}
                    >
                      <MapPin size={16} />
                      <span>
                        <strong>{c.nom}</strong>
                        <small>
                          {c.codePostal
                            ? `${c.codePostal} · `
                            : ''}Commune {c.code}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <p className="form-help">
            Ta position sert uniquement à trouver la commune et n’est pas
            enregistrée précisément.
          </p>
          {p.city && (
            <div className="selected-city">
              <span>
                <Check size={17} />
                <span>
                  <small>Commune choisie</small>
                  <strong>{p.city}</strong>
                </span>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setP({ ...p, city: '', commune: '', lat: null, lon: null });
                  setPostal('');
                  setCities([]);
                  setCityTotal(0);
                }}
              >
                Modifier
              </button>
            </div>
          )}
          <div className="range-field">
            <div className="range-label">
              <span>Distance maximale</span>
              <strong>{p.radius} km</strong>
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
            <div className="range-scale" aria-hidden="true">
              <span>5 km</span>
              <span>100 km</span>
            </div>
          </div>
          <p className="form-help">
            Distance à vol d’oiseau autour du centre de la commune. Vérifie le
            trajet réel sur l’annonce.
          </p>
          <div>
            <div className="field-title-row">
              <span className="field-title">Les contrats possibles</span>
              <small>
                {p.contracts.length
                  ? `${p.contracts.length} sélectionné${p.contracts.length > 1 ? 's' : ''}`
                  : 'Tous acceptés'}
              </small>
            </div>
            <p className="form-help">
              Sélectionne seulement si certains contrats ont ta préférence.
            </p>
            <div className="choices">
              {Object.entries({
                CDI: 'CDI',
                CDD: 'CDD',
                MIS: 'Intérim',
                SAI: 'Saisonnier',
                alternance: 'Alternance',
              }).map(([key, label]) => (
                <button
                  type="button"
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
                  {p.contracts.includes(key) && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="editor-section">
        <div className="editor-section-head">
          <span className="eyebrow">TES ENVIES</span>
          <h3>Ce qui te donne envie</h3>
        </div>
        <div className="form-stack">
          <div className="field-title-row">
            <span className="field-title">J’aimerais…</span>
            <small>
              {p.interests.length
                ? `${p.interests.length} envie${p.interests.length > 1 ? 's' : ''}`
                : 'À explorer'}
            </small>
          </div>
          <p className="form-help">
            Tu peux en choisir plusieurs. Appuie de nouveau pour retirer un
            choix.
          </p>
          <div className="interest-grid">
            {Object.entries(interests).map(([key, label]) => (
              <button
                type="button"
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
            type="button"
            className={
              p.interests.length ? 'text-button' : 'text-button selected-text'
            }
            aria-pressed={!p.interests.length}
            onClick={() => setP({ ...p, interests: [] })}
          >
            Je ne sais pas encore
          </button>
          <div className="field-title-row">
            <span className="field-title">J’aimerais éviter…</span>
            <small>
              {p.avoid.length
                ? `${p.avoid.length} préférence${p.avoid.length > 1 ? 's' : ''}`
                : 'Facultatif'}
            </small>
          </div>
          <div className="choices">
            {Object.entries(interests).map(([key, label]) => (
              <button
                type="button"
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
                {p.avoid.includes(key as Interest) && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="form-help">
            Ces préférences orientent les propositions. Tu peux toujours les
            changer.
          </p>
          <div className="desires-section">
            <div className="field-title-row">
              <span className="field-title">
                Ou décris ce que tu aimerais faire
              </span>
              <small>Facultatif</small>
            </div>
            <p className="form-help">
              En quelques mots, sans réfléchir. L’IA t’aide à faire ressortir
              tes envies, tes domaines et ce que tu préfères éviter.
            </p>
            <textarea
              value={desireText}
              onChange={(event) => {
                const value = event.target.value.slice(0, 2000);
                setDesireText(value);
                setP({ ...p, desires: value });
              }}
              rows={4}
              maxLength={2000}
              placeholder="Ex. : j’aime être au contact des gens, bricoler et créer des choses, mais je ne veux pas travailler de nuit ni faire de la vente…"
            />
            <button
              type="button"
              className="secondary-button desires-analyze"
              disabled={desireAnalyzing || desireText.trim().length < 10}
              onClick={() => void analyzeDesire()}
            >
              {desireAnalyzing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {desireAnalyzing ? 'Analyse en cours…' : 'Analyser mes envies'}
            </button>
            {desireError && (
              <p className="error-message" role="alert">
                {desireError}
              </p>
            )}
            {desireResult && (
              <div className="desire-result">
                {desireResult.summary && (
                  <p className="desire-summary">{desireResult.summary}</p>
                )}
                {desireResult.interests.length > 0 && (
                  <>
                    <div className="field-title-row">
                      <span className="field-title">Tes envies principales</span>
                      <small>Touche pour choisir</small>
                    </div>
                    <div className="choices">
                      {desireResult.interests.map((key) => (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={p.interests.includes(key)}
                          className={
                            p.interests.includes(key)
                              ? 'choice selected'
                              : 'choice'
                          }
                          onClick={() => toggle('interests', key)}
                        >
                          {interests[key]}
                          {p.interests.includes(key) && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {desireResult.avoids.length > 0 && (
                  <>
                    <div className="field-title-row">
                      <span className="field-title">À éviter pour toi</span>
                      <small>Touche pour choisir</small>
                    </div>
                    <div className="choices">
                      {desireResult.avoids.map((key) => (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={p.avoid.includes(key)}
                          className={
                            p.avoid.includes(key)
                              ? 'choice selected'
                              : 'choice'
                          }
                          onClick={() => toggle('avoid', key)}
                        >
                          {interests[key]}
                          {p.avoid.includes(key) && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {desireResult.domains.length > 0 && (
                  <>
                    <div className="field-title-row">
                      <span className="field-title">Des pistes de domaine</span>
                      <small>Touche pour en retenir une</small>
                    </div>
                    <div className="choices">
                      {desireResult.domains.map((domain) => (
                        <button
                          type="button"
                          key={domain}
                          aria-pressed={p.domain === domain}
                          className={
                            p.domain === domain
                              ? 'choice selected'
                              : 'choice'
                          }
                          onClick={() =>
                            setP({
                              ...p,
                              domain,
                              domainPreference:
                                p.domainPreference === 'any'
                                  ? 'related'
                                  : p.domainPreference,
                            })
                          }
                        >
                          {domain}
                          {p.domain === domain && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="form-help">
                  Ces suggestions restent sous ton contrôle : ignore-les,
                  ajuste-les, et change-les plus tard.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="editor-section">
        <div className="editor-section-head">
          <span className="eyebrow">TES CONTRAINTES</span>
          <h3>Ce qui compte vraiment</h3>
        </div>
        <div className="form-stack">
          <div className="field-title-row">
            <span className="field-title">Mes contraintes indispensables</span>
            <small>
              {[p.noNight, p.noWeekend].filter(Boolean).length || 'Aucune'}
            </small>
          </div>
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
          <span className="field-title">Expérience et formation</span>
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
          <div className="range-field">
            <div className="range-label">
              <span>Ma dose de découverte</span>
              <strong>{p.discovery} %</strong>
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
            <div className="range-scale" aria-hidden="true">
              <span>Plutôt ciblé</span>
              <span>Très ouvert</span>
            </div>
          </div>
          <p className="form-help">
            Des métiers voisins et inattendus, en respectant toujours tes
            contraintes.
          </p>
          <div className="parcours-section">
            <div className="field-title-row">
              <span className="field-title">Mon parcours</span>
              <small>Facultatif</small>
            </div>
            <label>
              Niveau d’étude
              <select
                value={p.education}
                onChange={(event) =>
                  setP({ ...p, education: event.target.value as Education })
                }
              >
                {Object.entries(educationLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mon domaine ou ma filière
              <input
                value={p.domain}
                onChange={(event) =>
                  setP({ ...p, domain: event.target.value.slice(0, 80) })
                }
                maxLength={80}
                placeholder="ex. : santé, informatique, commerce, bâtiment…"
              />
            </label>
            <p className="form-help">
              Comment veux-tu que les offres tiennent compte de ce domaine ?
            </p>
            <div className="choices">
              {Object.entries(domainPreferenceLabels).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={p.domainPreference === key}
                  className={
                    p.domainPreference === key ? 'choice selected' : 'choice'
                  }
                  onClick={() =>
                    setP({
                      ...p,
                      domainPreference: key as DomainPreference,
                    })
                  }
                >
                  {label}
                  {p.domainPreference === key && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        <button
          className="primary-button"
          disabled={busy || searching || locating}
          onClick={() => save(true)}
        >
          {busy
            ? 'Enregistrement…'
            : initial.completed
              ? 'Enregistrer mes préférences'
              : 'Trouver mes pistes'}
          <ArrowRight size={17} />
        </button>
        {!initial.completed && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => save(false)}
          >
            Enregistrer et reprendre plus tard
          </button>
        )}
      </div>
    </div>
  );
}