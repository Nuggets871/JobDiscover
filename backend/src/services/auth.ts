import type { NextFunction, Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { config } from '../config.ts';
import { query } from '../db.ts';
import { randomToken, tokenHash } from '../crypto.ts';
import { AppError } from '../validation.ts';

export const COOKIE_NAME = 'jd_session';

export type AuthUser = { id: string; email: string };

export function sessionMaxAge() {
  return config().SESSION_DAYS * 24 * 3600;
}

export function sessionCookie(token: string, maxAge = sessionMaxAge()) {
  const secure = config().APP_ORIGIN.startsWith('https:') ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function createSession(userId: string, client?: PoolClient) {
  const token = randomToken();
  const run = client ? client.query.bind(client) : query;
  await run(
    'insert into auth_sessions(user_id,token_hash,expires_at) values($1,$2,now()+make_interval(days=>$3))',
    [userId, await tokenHash(token), config().SESSION_DAYS],
  );
  return token;
}

export async function deleteSession(token: string) {
  if (token)
    await query('delete from auth_sessions where token_hash=$1', [
      await tokenHash(token),
    ]);
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = (req.cookies?.[COOKIE_NAME] as string | undefined) || '';
    if (!token)
      throw new AppError(401, 'Connecte-toi pour retrouver ton espace.');
    const result = await query<{ id: string; email: string }>(
      `select u.id, u.email from auth_sessions s join users u on u.id=s.user_id
       where s.token_hash=$1 and s.expires_at>now() and u.email_verified_at is not null`,
      [await tokenHash(token)],
    );
    const user = result.rows[0];
    if (!user) throw new AppError(401, 'Ta session a expiré. Reconnecte-toi.');
    (req as Request & { user: AuthUser }).user = user;
    next();
  } catch (error) {
    next(error);
  }
}
