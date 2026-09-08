import {
  AppError,
  securityHeaders,
  type Config,
  type Session,
} from './core.ts';
import { query } from './database.ts';
export async function exportAccount(c: Config, u: Session) {
  const { rows: profiles } = await query(
    c,
    'select preferences,updated_at from profiles where user_id=$1',
    [u.id],
  );
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          enc.encode(
            JSON.stringify({
              exportedAt: new Date().toISOString(),
              email: u.email,
              profiles,
            }).slice(0, -1) + ',"feedback":[',
          ),
        );
        let offset = 0,
          first = true;
        while (true) {
          const { rows } = await query(
            c,
            'select job_id,verdict,reason,job,created_at from feedback where user_id=$1 order by job_id limit 100 offset $2',
            [u.id, offset],
          );
          for (const row of rows) {
            controller.enqueue(
              enc.encode((first ? '' : ',') + JSON.stringify(row)),
            );
            first = false;
          }
          if (rows.length < 100) break;
          offset += 100;
        }
        controller.enqueue(enc.encode(']}'));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      ...securityHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="mes-donnees-jobdiscover.json"',
    },
  });
}
export async function maintenance(req: Request, c: Config) {
  if (!c.CRON_SECRET || c.CRON_SECRET.length < 32)
    throw new AppError(503, 'Maintenance non configurée.');
  const input = req.headers.get('authorization') || '';
  const hash = async (x: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)),
    );
  const [a, b] = await Promise.all([
    hash(input),
    hash(`Bearer ${c.CRON_SECRET}`),
  ]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff) throw new AppError(401, 'Non autorisé.');
  const before = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();
  await query(c, 'delete from job_cache where checked_at<$1', [before(30)]);
  await query(c, 'delete from offer_searches where fetched_at<$1', [before(1)]);
  await query(c, 'delete from job_enrichment where created_at<$1', [
    before(90),
  ]);
  await query(c, 'delete from rate_limits where expires_at<$1', [before(1)]);
  await query(c, 'delete from auth_sessions where refresh_expires_at<now()');
  await query(c, 'delete from auth_tokens where expires_at<now()');
  return { ok: true };
}
