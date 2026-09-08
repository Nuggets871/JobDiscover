import {
  authenticate,
  authFetch,
  configured,
  json,
  limit,
  refreshCookie,
  remote,
  sessionCookies,
  AppError,
  type Config,
} from './core.ts';
import { object, string, validEmail, validPassword } from '../validation.ts';
export async function authAction(
  req: Request,
  c: Config,
  action: string,
  input: unknown,
) {
  if (!configured(c))
    throw new AppError(
      503,
      'Les comptes ne sont pas encore activés. La démonstration reste accessible.',
    );
  const v = object(input);
  // A global ceiling also applies when a hosting proxy cannot expose a trustworthy IP.
  await limit(c, `auth-global:${action}`, 200, 60);
  if (['login', 'signup', 'recover'].includes(action)) {
    const email = validEmail(v.email);
    await limit(c, `auth:${action}:${email}`, 5, 600);
    if (action === 'recover') {
      await authFetch(c, 'recover', { email });
      return json({
        message:
          'Si un compte correspond à cette adresse, un e-mail de récupération a été envoyé.',
      });
    }
    const password = validPassword(v.password);
    const r = await authFetch(
      c,
      action === 'signup' ? 'signup' : 'token?grant_type=password',
      { email, password },
    );
    if (action === 'signup') {
      if (r.status === 429)
        throw new AppError(429, 'Réessaie dans quelques minutes.');
      if (r.status >= 500)
        throw new AppError(
          503,
          'L’inscription est momentanément indisponible.',
        );
      return json({
        message:
          'Vérifie tes e-mails pour confirmer ton compte. Si tu as déjà un compte, connecte-toi.',
      });
    }
    if (!r.ok)
      throw new AppError(
        r.status === 429 ? 429 : 401,
        'Connexion impossible. Vérifie tes identifiants et la confirmation de ton adresse.',
      );
    const data = (await r.json()) as {
      access_token: string;
      refresh_token: string;
      user: { email_confirmed_at?: string };
    };
    if (!data.user.email_confirmed_at)
      throw new AppError(401, 'Confirme ton adresse e-mail.');
    return sessionCookies(json({ ok: true }), c, data);
  }
  if (action === 'confirm') {
    const hash = string(v.token_hash, 200);
    const type = string(v.type, 20);
    if (
      !/^[a-zA-Z0-9_-]{20,200}$/.test(hash) ||
      !['email', 'signup', 'recovery'].includes(type)
    )
      throw new AppError(400, 'Lien invalide.');
    await limit(c, 'auth-confirm', 60, 60);
    const r = await authFetch(c, 'verify', { token_hash: hash, type });
    if (!r.ok)
      throw new AppError(
        400,
        'Ce lien a expiré ou a déjà été utilisé. Demande un nouvel e-mail.',
      );
    return sessionCookies(
      json({ ok: true, recovery: type === 'recovery' }),
      c,
      await r.json(),
    );
  }
  if (action === 'refresh') {
    const token = refreshCookie(req, c);
    if (!token) throw new AppError(401, 'Connecte-toi pour continuer.');
    const r = await authFetch(c, 'token?grant_type=refresh_token', {
      refresh_token: token,
    });
    if (!r.ok)
      return sessionCookies(json({ error: 'Ta session a expiré.' }, 401), c);
    return sessionCookies(json({ ok: true }), c, await r.json());
  }
  if (action === 'logout') {
    try {
      const user = await authenticate(req, c);
      await authFetch(c, 'logout?scope=global', undefined, user.token);
    } catch {}
    return sessionCookies(json({ ok: true }), c);
  }
  const user = await authenticate(req, c);
  await limit(c, `account:${user.id}`, 10, 600);
  if (action === 'password') {
    const password = validPassword(v.password);
    const r = await authFetch(c, 'user', { password }, user.token, 'PUT');
    if (!r.ok)
      throw new AppError(
        400,
        'Ce mot de passe ne peut pas être utilisé. Choisis-en un autre.',
      );
    return json({ ok: true, message: 'Ton mot de passe a été mis à jour.' });
  }
  if (action === 'delete') {
    if (v.confirmation !== 'SUPPRIMER')
      throw new AppError(400, 'Écris SUPPRIMER pour confirmer.');
    const password = validPassword(v.password);
    const reauth = await authFetch(c, 'token?grant_type=password', {
      email: user.email,
      password,
    });
    if (!reauth.ok)
      throw new AppError(
        401,
        'Vérifie ton mot de passe pour confirmer la suppression.',
      );
    const r = await remote(
      `${c.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: c.SUPABASE_SECRET_KEY!,
          ...(c.SUPABASE_SECRET_KEY?.startsWith('eyJ')
            ? { Authorization: `Bearer ${c.SUPABASE_SECRET_KEY}` }
            : {}),
        },
      },
    );
    if (!r.ok)
      throw new AppError(
        503,
        'La suppression a échoué. Ton compte est encore présent. Réessaie.',
      );
    return sessionCookies(json({ ok: true }), c);
  }
  throw new AppError(404, 'Action inconnue.');
}
