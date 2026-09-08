import { exportAccount, maintenance } from './privacy.ts';
import { enrich } from './enrichment.ts';
import { searchOffers, verifyJob, cachedJob } from './offers.ts';
import {
  config,
  json,
  assertOrigin,
  body,
  authenticate,
  AppError,
  configured,
  limit,
  remote,
  requireOK,
} from './core.ts';
import { query } from './database.ts';
import { authAction } from './auth.ts';
import { defaultProfile } from '../model.ts';
import { validateProfile, validateFeedback } from '../validation.ts';

export async function handleApiRequest(
  req: Request,
  configuration?: Record<string, string | undefined>,
) {
  try {
    const c = configuration ?? (await config());
    const path = new URL(req.url).pathname.replace(/^\/api\//, '');
    if (path === 'maintenance' && req.method === 'POST')
      return json(await maintenance(req, c));
    if (req.method !== 'GET') assertOrigin(req, c);
    if (path === 'status' && req.method === 'GET')
      return json({
        accounts: configured(c),
        offers: Boolean(
          c.FRANCE_TRAVAIL_CLIENT_ID && c.FRANCE_TRAVAIL_CLIENT_SECRET,
        ),
        ai: Boolean(c.DEEPSEEK_API_KEY),
      });
    if (path.startsWith('auth/') && req.method === 'POST')
      return await authAction(req, c, path.slice(5), await body(req));
    if (path === 'communes' && req.method === 'GET') {
      const postal = new URL(req.url).searchParams.get('postal') || '';
      if (!/^[0-9]{5}$/.test(postal))
        throw new AppError(400, 'Entre un code postal à 5 chiffres.');
      if (configured(c)) await limit(c, 'communes-global', 300, 60);
      const r = await remote(
        `https://geo.api.gouv.fr/communes?codePostal=${postal}&fields=nom,code,centre&format=json`,
      );
      await requireOK(r);
      return json(await r.json());
    }
    const u = await authenticate(req, c);
    if (path === 'export' && req.method === 'GET') {
      await limit(c, `export:${u.id}`, 3, 3600);
      return await exportAccount(c, u);
    }
    if (path === 'me' && req.method === 'GET') return json({ email: u.email });
    await limit(c, `user:${u.id}`, 120, 60);
    if (path === 'offers' && req.method === 'GET') {
      await limit(c, `search:${u.id}`, 12, 600);
      const { rows } = await query<{ preferences: unknown }>(
        c,
        'select preferences from profiles where user_id=$1',
        [u.id],
      );
      const p = validateProfile(rows[0]?.preferences || defaultProfile);
      return json(await searchOffers(c, p));
    }
    if (path.startsWith('offers/') && req.method === 'GET') {
      const id = path.slice(7);
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
        throw new AppError(400, 'Offre invalide.');
      await limit(c, `detail:${u.id}`, 30, 600);
      return json(await enrich(c, await verifyJob(c, id)));
    }
    if (path === 'feedback') {
      if (req.method === 'GET') {
        const { rows } = await query(
          c,
          'select job_id,verdict,reason,job,created_at from feedback where user_id=$1 order by created_at desc limit 1000',
          [u.id],
        );
        return json(rows);
      }
      if (req.method === 'POST') {
        const f = validateFeedback(await body(req));
        const job = await cachedJob(c, f.job_id);
        await query(
          c,
          `insert into feedback(user_id,job_id,verdict,reason,job,created_at) values($1,$2,$3,$4,$5,now())
          on conflict(user_id,job_id) do update set verdict=excluded.verdict,reason=excluded.reason,job=excluded.job,created_at=excluded.created_at`,
          [u.id, f.job_id, f.verdict, f.reason, job],
        );
        return json({ ...f, job });
      }
      if (req.method === 'DELETE') {
        const id = new URL(req.url).searchParams.get('id') || '';
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
          throw new AppError(400, 'Offre invalide.');
        await query(c, 'delete from feedback where user_id=$1 and job_id=$2', [
          u.id,
          id,
        ]);
        return json({ ok: true });
      }
    }
    if (path === 'profile') {
      if (req.method === 'GET') {
        const { rows } = await query<{ preferences: unknown }>(
          c,
          'select preferences from profiles where user_id=$1',
          [u.id],
        );
        return json(rows.length ? rows[0].preferences : defaultProfile);
      }
      if (req.method === 'PUT') {
        const p = validateProfile(await body(req));
        await query(
          c,
          `insert into profiles(user_id,preferences,updated_at) values($1,$2,now())
          on conflict(user_id) do update set preferences=excluded.preferences,updated_at=excluded.updated_at`,
          [u.id, p],
        );
        return json(p);
      }
    }
    throw new AppError(404, 'Page introuvable.');
  } catch (e) {
    return json(
      {
        error:
          e instanceof AppError
            ? e.message
            : 'Une erreur est survenue. Réessaie dans un instant.',
      },
      e instanceof AppError ? e.status : 500,
    );
  }
}
