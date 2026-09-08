import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
export function AuthPanel({
  enabled,
  onSuccess,
}: {
  enabled: boolean;
  onSuccess: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await api(`auth/${mode}`, 'POST', {
        email: data.get('email'),
        password: data.get('password'),
      });
      await onSuccess();
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
          Les comptes ne sont pas encore activés. Tu peux déjà essayer le
          parcours avec les offres fictives. Aucun profil n’est enregistré.
        </div>
      ) : (
        <>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(String(v) as 'login' | 'signup');
              setError('');
            }}
          >
            <TabsList className="auth-tabs">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={submit} className="form-stack">
            <label>
              Adresse e-mail
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
              Mot de passe
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                required
                minLength={mode === 'signup' ? 4 : 1}
                maxLength={128}
              />
              {mode === 'signup' && <small>4 caractères minimum.</small>}
            </label>
            {mode === 'signup' && (
              <p className="form-help">
                En créant ton compte, tu prends connaissance de notre{' '}
                <a href="/confidentialite" target="_blank" rel="noreferrer">
                  politique de confidentialité
                </a>
                .
              </p>
            )}
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
        </>
      )}
      <p className="privacy-promise">
        <LockKeyhole size={15} /> Ton profil n’est jamais visible par les autres
        membres.
      </p>
    </div>
  );
}
