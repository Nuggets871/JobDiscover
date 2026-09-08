import { Router } from 'express';
import { query, transaction } from '../db.ts';
import { passwordHash, verifyPassword } from '../crypto.ts';
import {
  AppError,
  object,
  validEmail,
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
  '/signup',
  h(async (req, res) => {
    const v = object(req.body);
    const email = validEmail(v.email);
    const password = validPassword(v.password);
    await limit(`auth:signup:${email}`, 5, 600);
    const existing = await query('select 1 from users where email=$1', [email]);
    if (existing.rowCount)
      throw new AppError(409, 'Un compte existe déjà avec cette adresse.');
    const encoded = await passwordHash(password);
    const result = await query<{ id: string }>(
      'insert into users(email,password_hash) values($1,$2) returning id',
      [email, encoded],
    );
    const token = await createSession(result.rows[0].id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    const v = object(req.body);
    const email = validEmail(v.email);
    const password = validPassword(v.password);
    await limit(`auth:login:${email}`, 10, 600);
    const { rows } = await query<{ id: string; password_hash: string }>(
      'select id,password_hash from users where email=$1',
      [email],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash)))
      throw new AppError(401, 'Connexion impossible. Vérifie tes identifiants.');
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
    const v = object(req.body);
    const password = validPassword(v.password);
    await transaction(async (client) => {
      await client.query(
        'update users set password_hash=$1,password_changed_at=now() where id=$2',
        [await passwordHash(password), user.id],
      );
      await client.query('delete from auth_sessions where user_id=$1', [
        user.id,
      ]);
    });
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
    const password = validPassword(v.password);
    const { rows } = await query<{ password_hash: string }>(
      'select password_hash from users where id=$1',
      [user.id],
    );
    if (
      !rows[0] ||
      !(await verifyPassword(password, rows[0].password_hash))
    )
      throw new AppError(
        401,
        'Vérifie ton mot de passe pour confirmer la suppression.',
      );
    await query('delete from users where id=$1', [user.id]);
    res.setHeader('Set-Cookie', clearCookie());
    res.json({ ok: true });
  }),
);