'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { api } from '@/lib/client';
export default function Confirm() {
  const [token, setToken] = useState('');
  const [type, setType] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    // oxlint-disable-next-line react/react-compiler -- One-time synchronization with the browser-only URL, then remove the token.
    setToken(p.get('token_hash') || '');
    setType(p.get('type') || '');
    history.replaceState({}, '', location.pathname);
  }, []);
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await api('auth/confirm', 'POST', { token_hash: token, type });
      if (type === 'recovery') setVerified(true);
      else setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function password(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('auth/password', 'POST', {
        password: new FormData(e.currentTarget).get('password'),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="simple-page">
      <Link prefetch={false} className="wordmark" href="/">
        jobdiscover.
      </Link>
      <h1 className="mt-8">
        {done
          ? 'C’est tout bon.'
          : verified
            ? 'Un nouveau mot de passe.'
            : 'Encore un petit pas.'}
      </h1>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {done ? (
        <Link prefetch={false} className="primary-button mt-6" href="/">
          Retrouver mon espace
        </Link>
      ) : verified ? (
        <form className="form-stack" onSubmit={password}>
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
            className="primary-button mt-6"
            disabled={busy || !token}
            onClick={confirm}
          >
            {busy ? 'Vérification…' : 'Confirmer et continuer'}
          </button>
        </>
      )}
      <Link prefetch={false} className="text-button mt-5" href="/">
        Revenir à JobDiscover
      </Link>
    </main>
  );
}
