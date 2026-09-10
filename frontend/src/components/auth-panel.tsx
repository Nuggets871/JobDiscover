import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';
export function AuthPanel({
  enabled,
  onSuccess,
}: {
  enabled: boolean;
  onSuccess?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'email' | 'password'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(e.currentTarget);
    try {
      if (mode === 'email') {
        const result = await api<{ message?: string }>('auth/start', 'POST', {
          email: data.get('email'),
        });
        setMessage(
          result.message ||
            'Vérifie ta boîte e-mail pour continuer. Le lien expire dans une heure.',
        );
      } else {
        await api('auth/login', 'POST', {
          email: data.get('email'),
          password: data.get('password'),
        });
        if (onSuccess) await onSuccess();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-panel">
      <span className="eyebrow">TON ESPACE, À TOI</span>
      <h2>Une nouvelle piste commence ici.</h2>
      <p>Garde tes favoris et retrouve tes envies, sur tous tes appareils.</p>
      {!enabled ? (
        <div className="notice">
          Le service de comptes est momentanément indisponible. Réessaie dans
          quelques instants.
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="form-stack">
            <label>
              {mode === 'email'
                ? 'Ton adresse e-mail'
                : 'Adresse e-mail ou identifiant'}
              <input
                name="email"
                type={mode === 'email' ? 'email' : 'text'}
                autoComplete={mode === 'email' ? 'email' : 'username'}
                required
                maxLength={254}
                placeholder={mode === 'email' ? 'toi@exemple.fr' : 'toi@exemple.fr'}
              />
            </label>
            {mode === 'password' && (
              <label>
                Mot de passe
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={1}
                  maxLength={128}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? 'Un instant…'
                : mode === 'email'
                  ? 'Recevoir mon lien de connexion'
                  : 'Me connecter'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="form-help">
            {mode === 'email'
              ? 'Pas de mot de passe à retenir : on t’envoie un lien sécurisé. En créant ton compte, tu prends connaissance de notre '
              : 'Tu peux aussi te connecter sans mot de passe, avec le lien reçu par e-mail. '}
            {mode === 'email' && (
              <a href="/confidentialite" target="_blank" rel="noreferrer">
                politique de confidentialité
              </a>
            )}
            {mode === 'email' && '.'}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === 'email' ? 'password' : 'email');
              setError('');
              setMessage('');
            }}
          >
            {mode === 'email'
              ? 'J’ai un mot de passe — me connecter autrement'
              : 'Pas de mot de passe ? Recevoir un lien'}
          </button>
        </>
      )}
      <p className="privacy-promise">
        <LockKeyhole size={15} /> Ton profil n’est jamais visible par les autres
        membres.
      </p>
    </div>
  );
}