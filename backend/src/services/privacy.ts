import { query } from '../db.ts';
import type { AuthUser } from './auth.ts';
import { AppError } from '../validation.ts';

export async function exportAccount(u: AuthUser) {
  const { rows: profiles } = await query(
    'select preferences,updated_at from profiles where user_id=$1',
    [u.id],
  );
  const { rows: feedback } = await query(
    'select job_id,verdict,reason,job,created_at from feedback where user_id=$1 order by created_at desc',
    [u.id],
  );
  return {
    exportedAt: new Date().toISOString(),
    email: u.email,
    profiles,
    feedback,
  };
}

export async function maintenance(authorization: string) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)
    throw new AppError(503, 'Maintenance non configurée.');
  const hash = async (x: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)),
    );
  const [a, b] = await Promise.all([
    hash(authorization),
    hash(`Bearer ${process.env.CRON_SECRET}`),
  ]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff) throw new AppError(401, 'Non autorisé.');
  const before = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();
  await query('delete from job_cache where checked_at<$1', [before(30)]);
  await query('delete from offer_searches where fetched_at<$1', [before(1)]);
  await query('delete from job_enrichment where created_at<$1', [before(90)]);
  await query('delete from rate_limits where expires_at<$1', [before(1)]);
  await query('delete from auth_sessions where expires_at<now()');
  await query('delete from auth_tokens where expires_at<now()');
  return { ok: true };
}
