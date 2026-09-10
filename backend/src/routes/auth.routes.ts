import { Router } from 'express';
import { query, transaction } from '../db.ts';
import {
  passwordHash,
  randomToken,
  tokenHash,
  verifyPassword,
} from '../crypto.ts';
import {
  AppError,
  object,
  string,
  validEmail,
  validLogin,
  validLoginPassword,
  validPassword,
} from '../validation.ts';
import {
  clearCookie,
  COOKIE_NAME,
  createSession,
  deleteSession,
  requireAuth,
  sessionCookie,
  type AuthUser,
} from '../services/auth.ts';
import {
  emailConfigured,
  sendAuthEmail,
  type AuthPurpose,
} from '../services/email.ts';
import { limit } from '../services/rate-limit.ts';
import { h } from '../handler.ts';

export const authRouter = Router();
const genericEmailMessage =
  'Si cette adresse peut être utilisée, un e-mail vient d’être envoyé.';

async function issueToken(userId: string, purpose: AuthPurpose) {
  const token = randomToken();
  await transaction(async (client) => {
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

authRouter.post(
  '/start',
  h(async (req, res) => {
    if (!emailConfigured())
      throw new AppError(503, 'Les comptes ne sont pas encore configurés.');
    const email = validEmail(object(req.body).email);
    await limit(`auth:start:ip:${req.ip}`, 20, 600);
    await limit(`auth:start:${email}`, 5, 600);
    const { rows } = await query<{ id: string; email_verified_at: Date | null }>(
      `insert into users(email) values($1)
       on conflict(email) do update set email = excluded.email
       returning id,email_verified_at`,
      [email],
    );
    const user = rows[0];
    const purpose: AuthPurpose = user.email_verified_at ? 'login' : 'email';
    await sendAuthEmail(email, await issueToken(user.id, purpose), purpose);
    res.json({ message: genericEmailMessage });
  }),
);

authRouter.post(
  '/recover',
  h(async (req, res) => {
    if (!emailConfigured())
      throw new AppError(503, 'Les comptes ne sont pas encore configurés.');
    const email = validEmail(object(req.body).email);
    await limit(`auth:recover:ip:${req.ip}`, 20, 600);
    await limit(`auth:recover:${email}`, 5, 600);
    const { rows } = await query<{ id: string }>(
      'select id from users where email=$1 and email_verified_at is not null',
      [email],
    );
    if (rows[0])
      await sendAuthEmail(
        email,
        await issueToken(rows[0].id, 'recovery'),
        'recovery',
      );
    res.json({ message: genericEmailMessage });
  }),
);

authRouter.post(
  '/confirm',
  h(async (req, res) => {
    const v = object(req.body);
    const token = string(v.token, 200);
    const purpose = string(v.type, 20) as AuthPurpose;
    if (
      !/^[a-zA-Z0-9_-]{40,200}$/.test(token) ||
      !['email', 'recovery', 'login'].includes(purpose)
    )
      throw new AppError(400, 'Lien invalide.');
    await limit(`auth:confirm:ip:${req.ip}`, 60, 60);
    let userId = '';
    const session = await transaction(async (client) => {
      const { rows } = await client.query<{ user_id: string }>(
        `delete from auth_tokens where token_hash=$1 and purpose=$2 and expires_at>now()
       returning user_id`,
        [await tokenHash(token), purpose],
      );
      if (!rows[0])
        throw new AppError(400, 'Ce lien a expiré ou a déjà été utilisé.');
      userId = rows[0].user_id;
      if (purpose === 'email')
        await client.query(
          'update users set email_verified_at=coalesce(email_verified_at,now()) where id=$1',
          [userId],
        );
      return createSession(userId, client);
    });
    const { rows } = await query<{ password_hash: string | null }>(
      'select password_hash from users where id=$1',
      [userId],
    );
    res.setHeader('Set-Cookie', sessionCookie(session));
    res.json({
      ok: true,
      recovery: purpose === 'recovery',
      created: purpose === 'email',
      passwordless: rows[0]?.password_hash == null,
    });
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    const v = object(req.body);
    const email = validLogin(v.email);
    const password = validLoginPassword(v.password);
    await limit(`auth:login:ip:${req.ip}`, 30, 600);
    await limit(`auth:login:${email}`, 10, 600);
    const { rows } = await query<{
      id: string;
      password_hash: string;
      email_verified_at: Date | null;
    }>('select id,password_hash,email_verified_at from users where email=$1', [
      email,
    ]);
    const user = rows[0];
    const valid = user?.password_hash
      ? await verifyPassword(password, user.password_hash)
      : false;
    if (!valid || !user?.email_verified_at)
      throw new AppError(
        401,
        'Connexion impossible. Vérifie tes identifiants et ton adresse e-mail.',
      );
    const token = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout',
  h(async (req, res) => {
    await deleteSession((req.cookies?.[COOKIE_NAME] as string) || '');
    res.setHeader('Set-Cookie', clearCookie());
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/password',
  requireAuth,
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const password = validPassword(object(req.body).password);
    const before = await query<{ password_hash: string | null }>(
      'select password_hash from users where id=$1',
      [user.id],
    );
    await transaction(async (client) => {
      await client.query(
        'update users set password_hash=$1,password_changed_at=now() where id=$2',
        [await passwordHash(password), user.id],
      );
      if (before.rows[0]?.password_hash)
        await client.query('delete from auth_sessions where user_id=$1', [
          user.id,
        ]);
    });
    if (before.rows[0]?.password_hash)
      res.setHeader('Set-Cookie', clearCookie());
    res.json({ ok: true, message: 'Ton mot de passe a été mis à jour.' });
  }),
);

authRouter.post(
  '/delete',
  requireAuth,
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    const v = object(req.body);
    if (v.confirmation !== 'SUPPRIMER')
      throw new AppError(400, 'Écris SUPPRIMER pour confirmer.');
    const { rows } = await query<{ password_hash: string | null }>(
      'select password_hash from users where id=$1',
      [user.id],
    );
    if (rows[0]?.password_hash) {
      const password = validLoginPassword(v.password);
      if (!(await verifyPassword(password, rows[0].password_hash)))
        throw new AppError(
          401,
          'Vérifie ton mot de passe pour confirmer la suppression.',
        );
    }
    await query('delete from users where id=$1', [user.id]);
    res.setHeader('Set-Cookie', clearCookie());
    res.json({ ok: true });
  }),
);
