import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function ConfirmAuth() {
  const [token, setToken] = useState('');
  const [type, setType] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setToken(params.get('token') || '');
    setType(params.get('type') || '');
    history.replaceState({}, '', location.pathname);
  }, []);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ recovery: boolean }>('auth/confirm', 'POST', {
        token,
        type,
      });
      if (result.recovery) setRecovery(true);
      else setDone(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('auth/password', 'POST', {
        password: new FormData(event.currentTarget).get('password'),
      });
      setDone(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="simple-page">
      <a className="wordmark" href="/">
        jobdiscover<span className="wordmark-dot">.</span>
      </a>
      <h1>
        {done
          ? 'C’est tout bon.'
          : recovery
            ? 'Choisis un nouveau mot de passe.'
            : 'Encore un petit pas.'}
      </h1>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {done ? (
        <a className="primary-button" href="/">
          Retrouver mon espace
        </a>
      ) : recovery ? (
        <form className="form-stack" onSubmit={changePassword}>
          <label>
            Nouveau mot de passe
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Enregistrer
          </button>
        </form>
      ) : (
        <>
          <p>
            Confirme ton adresse ou ta demande de récupération pour continuer.
          </p>
          <button
            className="primary-button"
            disabled={busy || !token}
            onClick={confirm}
          >
            {busy ? 'Vérification…' : 'Confirmer et continuer'}
          </button>
        </>
      )}
      <a className="text-button" href="/">
        Revenir à JobDiscover
      </a>
    </main>
  );
}
