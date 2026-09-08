import type { PoolClient } from 'pg';
import {
  authenticate,
  configured,
  json,
  limit,
  readCookie,
  refreshCookie,
  sessionCookies,
  AppError,
  type Config,
} from './core.ts';
import { query, transaction } from './database.ts';
import {
  passwordHash,
  randomToken,
  tokenHash,
  verifyPassword,
} from './crypto.ts';
import { sendAuthEmail } from './email.ts';
import { object, string, validEmail, validPassword } from '../validation.ts';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
};

async function createSession(c: Config, userId: string, client?: PoolClient) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const run = client
    ? client.query.bind(client)
    : (text: string, values: unknown[]) => query(c, text, values);
  await run(
    `insert into auth_sessions(user_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at)
     values($1,$2,$3,now()+interval '1 hour',now()+interval '7 days')`,
    [userId, await tokenHash(accessToken), await tokenHash(refreshToken)],
  );
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
  };
}

async function issueToken(
  c: Config,
  userId: string,
  purpose: 'email' | 'recovery',
) {
  const token = randomToken();
  await transaction(c, async (client) => {
    await client.query(
      'delete from auth_tokens where user_id=$1 and purpose=$2',
      [userId, purpose],
    );
    await client.query(
      `insert into auth_tokens(user_id,purpose,token_hash,expires_at)
       values($1,$2,$3,now()+interval '1 hour')`,
      [userId, purpose, await tokenHash(token)],
    );
  });
  return token;
}

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
  await limit(c, `auth-global:${action}`, 200, 60);

  if (['login', 'signup', 'recover'].includes(action)) {
    const email = validEmail(v.email);
    await limit(c, `auth:${action}:${email}`, 5, 600);
    if (action === 'signup') {
      const encoded = await passwordHash(validPassword(v.password));
      const result = await query<UserRow>(
        c,
        `insert into users(email,password_hash) values($1,$2)
         on conflict(email) do update set password_hash=case when users.email_verified_at is null then excluded.password_hash else users.password_hash end
         returning id,email,password_hash,email_verified_at`,
        [email, encoded],
      );
      const user = result.rows[0];
      if (!user.email_verified_at)
        await sendAuthEmail(
          c,
          email,
          await issueToken(c, user.id, 'email'),
          'email',
        );
      return json({
        message:
          'Vérifie tes e-mails pour confirmer ton compte. Si tu as déjà un compte, connecte-toi.',
      });
    }

    const result = await query<UserRow>(
      c,
      'select id,email,password_hash,email_verified_at from users where email=$1',
      [email],
    );
    const user = result.rows[0];
    if (action === 'recover') {
      if (user?.email_verified_at)
        await sendAuthEmail(
          c,
          email,
          await issueToken(c, user.id, 'recovery'),
          'recovery',
        );
      return json({
        message:
          'Si un compte correspond à cette adresse, un e-mail de récupération a été envoyé.',
      });
    }
    const candidate = validPassword(v.password);
    const valid = user
      ? await verifyPassword(candidate, user.password_hash)
      : (await passwordHash(candidate), false);
    if (!valid || !user?.email_verified_at)
      throw new AppError(
        401,
        'Connexion impossible. Vérifie tes identifiants et la confirmation de ton adresse.',
      );
    return sessionCookies(
      json({ ok: true }),
      c,
      await createSession(c, user.id),
    );
  }

  if (action === 'confirm') {
    const token = string(v.token_hash, 200);
    const purpose = string(v.type, 20);
    if (
      !/^[a-zA-Z0-9_-]{40,200}$/.test(token) ||
      !['email', 'recovery'].includes(purpose)
    )
      throw new AppError(400, 'Lien invalide.');
    await limit(c, 'auth-confirm', 60, 60);
    const session = await transaction(c, async (client) => {
      const result = await client.query<{ user_id: string }>(
        `delete from auth_tokens where token_hash=$1 and purpose=$2 and expires_at>now() returning user_id`,
        [await tokenHash(token), purpose],
      );
      const record = result.rows[0];
      if (!record)
        throw new AppError(
          400,
          'Ce lien a expiré ou a déjà été utilisé. Demande un nouvel e-mail.',
        );
      if (purpose === 'email')
        await client.query(
          'update users set email_verified_at=coalesce(email_verified_at,now()) where id=$1',
          [record.user_id],
        );
      return createSession(c, record.user_id, client);
    });
    return sessionCookies(
      json({ ok: true, recovery: purpose === 'recovery' }),
      c,
      session,
    );
  }

  if (action === 'refresh') {
    const token = refreshCookie(req, c);
    if (!token) throw new AppError(401, 'Connecte-toi pour continuer.');
    try {
      const session = await transaction(c, async (client) => {
        const result = await client.query<{ user_id: string }>(
          'delete from auth_sessions where refresh_hash=$1 and refresh_expires_at>now() returning user_id',
          [await tokenHash(token)],
        );
        if (!result.rows[0]) throw new AppError(401, 'Ta session a expiré.');
        return createSession(c, result.rows[0].user_id, client);
      });
      return sessionCookies(json({ ok: true }), c, session);
    } catch {
      return sessionCookies(json({ error: 'Ta session a expiré.' }, 401), c);
    }
  }

  if (action === 'logout') {
    const secure = c.APP_ORIGIN?.startsWith('https:');
    const access = readCookie(req, secure ? '__Host-jd_access' : 'jd_access');
    const refresh = refreshCookie(req, c);
    if (access || refresh)
      await query(
        c,
        'delete from auth_sessions where access_hash=$1 or refresh_hash=$2',
        [await tokenHash(access), await tokenHash(refresh)],
      );
    return sessionCookies(json({ ok: true }), c);
  }

  const user = await authenticate(req, c);
  await limit(c, `account:${user.id}`, 10, 600);
  if (action === 'password') {
    const password = validPassword(v.password);
    await transaction(c, async (client) => {
      await client.query(
        'update users set password_hash=$1,password_changed_at=now() where id=$2',
        [await passwordHash(password), user.id],
      );
      await client.query('delete from auth_sessions where user_id=$1', [
        user.id,
      ]);
    });
    return sessionCookies(
      json({ ok: true, message: 'Ton mot de passe a été mis à jour.' }),
      c,
    );
  }
  if (action === 'delete') {
    if (v.confirmation !== 'SUPPRIMER')
      throw new AppError(400, 'Écris SUPPRIMER pour confirmer.');
    const password = validPassword(v.password);
    const result = await query<{ password_hash: string }>(
      c,
      'select password_hash from users where id=$1',
      [user.id],
    );
    if (
      !result.rows[0] ||
      !(await verifyPassword(password, result.rows[0].password_hash))
    )
      throw new AppError(
        401,
        'Vérifie ton mot de passe pour confirmer la suppression.',
      );
    await query(c, 'delete from users where id=$1', [user.id]);
    return sessionCookies(json({ ok: true }), c);
  }
  throw new AppError(404, 'Action inconnue.');
}
