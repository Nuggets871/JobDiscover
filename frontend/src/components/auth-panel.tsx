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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await api(mode === 'login' ? 'auth/login' : 'auth/register', 'POST', {
        email: data.get('email'),
        password: data.get('password'),
      });
      if (onSuccess) await onSuccess();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function switchMode(next: 'login' | 'register') {
    setMode(next);
    setError('');
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
          <div
            className="auth-modes"
            role="tablist"
            aria-label="Connexion ou création de compte"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Me connecter
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              Créer un compte
            </button>
          </div>
          <form onSubmit={submit} className="form-stack">
            <label>
              Ton adresse e-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="toi@exemple.fr"
              />
            </label>
            <label>
              {mode === 'register'
                ? 'Choisis un mot de passe'
                : 'Ton mot de passe'}
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                required
                minLength={mode === 'register' ? 8 : 1}
                maxLength={128}
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? 'Un instant…'
                : mode === 'login'
                  ? 'Me connecter'
                  : 'Créer mon compte'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="form-help">
            {mode === 'register'
              ? 'Ton compte te permet de garder tes favoris et tes envies sur tous tes appareils.'
              : 'Retrouve tes favoris et tes envies sur tous tes appareils.'}
          </p>
        </>
      )}
      <p className="privacy-promise">
        <LockKeyhole size={15} /> Ton profil n’est jamais visible par les autres
        membres.
      </p>
    </div>
  );
}