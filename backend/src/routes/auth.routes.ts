import { Router } from 'express';
import { query } from '../db.ts';
import {
  passwordHash,
  verifyPassword,
} from '../crypto.ts';
import {
  AppError,
  object,
  validEmail,
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
import { limit } from '../services/rate-limit.ts';
import { h } from '../handler.ts';

export const authRouter = Router();

authRouter.post(
  '/register',
  h(async (req, res) => {
    const v = object(req.body);
    const email = validEmail(v.email);
    const password = validPassword(v.password);
    await limit(`auth:register:ip:${req.ip}`, 20, 600);
    await limit(`auth:register:${email}`, 5, 600);
    const { rows } = await query<{ id: string }>(
      `insert into users(email,password_hash,email_verified_at) values($1,$2,now())
       on conflict(email) do nothing
       returning id`,
      [email, await passwordHash(password)],
    );
    if (!rows[0])
      throw new AppError(
        409,
        'Cette adresse e-mail est déjà utilisée. Connecte-toi.',
      );
    const token = await createSession(rows[0].id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    const v = object(req.body);
    const email = validEmail(v.email);
    const password = validLoginPassword(v.password);
    await limit(`auth:login:ip:${req.ip}`, 30, 600);
    await limit(`auth:login:${email}`, 10, 600);
    const { rows } = await query<{
      id: string;
      password_hash: string | null;
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
        'Connexion impossible. Vérifie ton adresse e-mail et ton mot de passe.',
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
    await query(
      'update users set password_hash=$1,password_changed_at=now() where id=$2',
      [await passwordHash(password), user.id],
    );
    if (before.rows[0]?.password_hash) {
      await query('delete from auth_sessions where user_id=$1', [user.id]);
      res.setHeader('Set-Cookie', clearCookie());
    }
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