import { AppError, remote, limit, type Config } from './core.ts';
import { query } from './database.ts';
import { normalizeJob, deduplicate } from '../jobs.ts';
import type { Job, Profile } from '../model.ts';
let tokenCache: { token: string; expires: number } | null = null;
async function token(c: Config) {
  if (tokenCache && tokenCache.expires > Date.now() + 30000)
    return tokenCache.token;
  if (!c.FRANCE_TRAVAIL_CLIENT_ID || !c.FRANCE_TRAVAIL_CLIENT_SECRET)
    throw new AppError(
      503,
      'La connexion à France Travail n’est pas encore activée.',
    );
  const r = await remote(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: c.FRANCE_TRAVAIL_CLIENT_ID,
        client_secret: c.FRANCE_TRAVAIL_CLIENT_SECRET,
        scope: 'api_offresdemploiv2 o2dsoffre',
      }),
    },
  );
  if (!r.ok)
    throw new AppError(503, 'France Travail est momentanément indisponible.');
  const data = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}
async function ft(c: Config, path: string) {
  const t = await token(c);
  const r = await remote(
    `https://api.francetravail.io/partenaire/offresdemploi/v2/${path}`,
    { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } },
  );
  if (r.status === 401) tokenCache = null;
  return r;
}
export async function searchOffers(
  c: Config,
  p: Profile,
): Promise<{ jobs: Job[]; partial: boolean; fetchedAt: string }> {
  if (!p.commune)
    throw new AppError(
      400,
      'Complète ta commune dans ton profil pour voir les offres.',
    );
  const key = `${p.commune}:${p.radius}`;
  const { rows: entries } = await query<{
    jobs: Job[];
    fetched_at: string;
    partial: boolean;
  }>(c, 'select jobs,fetched_at,partial from offer_searches where key=$1', [
    key,
  ]);
  if (entries[0] && Date.now() - Date.parse(entries[0].fetched_at) < 15 * 60000)
    return {
      jobs: entries[0].jobs,
      partial: entries[0].partial,
      fetchedAt: entries[0].fetched_at,
    };
  await limit(c, 'ft-global-search', 200, 3600);
  const all: Job[] = [];
  let partial = false;
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({
      commune: p.commune,
      distance: String(p.radius),
      range: `${page * 100}-${page * 100 + 99}`,
      sort: '1',
    });
    const r = await ft(c, `offres/search?${q}`);
    if (r.status === 204 || r.status === 416) break;
    if (!r.ok)
      throw new AppError(
        r.status === 429 ? 429 : 503,
        'Les offres ne sont pas disponibles pour le moment. Réessaie dans quelques minutes.',
      );
    const data = (await r.json()) as { resultats?: Record<string, unknown>[] };
    const rows = data.resultats || [];
    all.push(...rows.map(normalizeJob).filter((j): j is Job => j !== null));
    if (rows.length < 100) break;
    if (page === 2) partial = true;
  }
  const jobs = deduplicate(all);
  const fetchedAt = new Date().toISOString();
  if (jobs.length) {
    for (const job of jobs)
      await query(
        c,
        `insert into job_cache(id,job,checked_at) values($1,$2,$3)
        on conflict(id) do update set job=excluded.job,checked_at=excluded.checked_at`,
        [job.id, job, fetchedAt],
      );
  }
  await query(
    c,
    `insert into offer_searches(key,jobs,fetched_at,partial) values($1,$2,$3,$4)
    on conflict(key) do update set jobs=excluded.jobs,fetched_at=excluded.fetched_at,partial=excluded.partial`,
    [key, jobs, fetchedAt, partial],
  );
  return { jobs, partial, fetchedAt };
}
export async function cachedJob(c: Config, id: string): Promise<Job> {
  const { rows } = await query<{ job: Job; checked_at: string }>(
    c,
    'select job,checked_at from job_cache where id=$1',
    [id],
  );
  if (!rows.length)
    throw new AppError(404, 'Cette offre n’est plus disponible.');
  return rows[0].job;
}
export async function verifyJob(c: Config, id: string): Promise<Job> {
  let previous: Job | undefined;
  try {
    previous = await cachedJob(c, id);
  } catch (e) {
    if (!(e instanceof AppError) || e.status !== 404) throw e;
  }
  const r = await ft(c, `offres/${encodeURIComponent(id)}`);
  let job: Job;
  if (r.status === 404 || r.status === 204) {
    if (!previous)
      throw new AppError(410, 'Cette annonce n’est plus disponible.');
    job = { ...previous, active: false };
  } else {
    if (!r.ok)
      throw new AppError(
        503,
        'Impossible de vérifier cette annonce pour le moment.',
      );
    const normalized = normalizeJob(await r.json());
    if (!normalized)
      throw new AppError(503, 'Annonce illisible. Réessaie plus tard.');
    job = normalized;
  }
  await query(
    c,
    `insert into job_cache(id,job,checked_at) values($1,$2,now())
    on conflict(id) do update set job=excluded.job,checked_at=excluded.checked_at`,
    [id, job],
  );
  return job;
}
