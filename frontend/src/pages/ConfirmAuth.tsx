import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Stage = 'confirm' | 'password' | 'done';

export function ConfirmAuth() {
  const [token, setToken] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState<Stage>('confirm');
  const [optional, setOptional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      const result = await api<{
        recovery: boolean;
        created: boolean;
        passwordless: boolean;
      }>('auth/confirm', 'POST', { token, type });
      if (result.recovery) {
        setOptional(false);
        setStage('password');
      } else if (result.passwordless) {
        setOptional(true);
        setStage('password');
      } else {
        setStage('done');
      }
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
      setStage('done');
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
        {stage === 'done'
          ? 'C’est tout bon.'
          : stage === 'password'
            ? optional
              ? 'Choisis ton mot de passe.'
              : 'Choisis un nouveau mot de passe.'
            : 'Encore un petit pas.'}
      </h1>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {stage === 'done' ? (
        <a className="primary-button" href="/">
          Retrouver mon espace
        </a>
      ) : stage === 'password' ? (
        <>
          <p>
            {optional
              ? 'Facultatif : tu peux aussi te connecter à tout moment avec le lien envoyé par e-mail.'
              : 'Une fois enregistré, tes anciennes sessions sont fermées.'}
          </p>
          <form className="form-stack" onSubmit={changePassword}>
            <label>
              Mot de passe
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
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
          {optional && (
            <button
              className="text-button"
              onClick={() => setStage('done')}
            >
              Continuer sans mot de passe
            </button>
          )}
        </>
      ) : (
        <>
          <p>Confirme ton adresse pour continuer.</p>
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