import { query } from '../db.ts';
import { normalizeJob, deduplicate } from '../jobs.ts';
import type { Job, Profile } from '../model.ts';
import { AppError } from '../validation.ts';
import { remote } from './http.ts';
import { limit } from './rate-limit.ts';
import { MemoryCache } from './memory-cache.ts';

const PAGE_SIZE = 100;
const MAX_START = 3000;

let tokenCache: { token: string; expires: number } | null = null;
type SearchResult = {
  jobs: Job[];
  nextCursor: number | null;
  partial: boolean;
  fetchedAt: string;
};
const searchMemory = new MemoryCache<SearchResult>(15 * 60_000, 300);
const detailMemory = new MemoryCache<Job>(5 * 60_000, 500);

async function token() {
  if (tokenCache && tokenCache.expires > Date.now() + 30000)
    return tokenCache.token;
  if (
    !process.env.FRANCE_TRAVAIL_CLIENT_ID ||
    !process.env.FRANCE_TRAVAIL_CLIENT_SECRET
  )
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
        client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID,
        client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
        scope: 'api_offresdemploiv2 o2dsoffre',
      }),
    },
  );
  if (r.status === 400 || r.status === 401)
    throw new AppError(
      503,
      'La connexion à France Travail n’est pas configurée : vérifie les identifiants du client API.',
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

async function ft(path: string) {
  const t = await token();
  const r = await remote(
    `https://api.francetravail.io/partenaire/offresdemploi/v2/${path}`,
    { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } },
  );
  if (r.status === 401) tokenCache = null;
  return r;
}

const contractCodes: Record<string, string[]> = {
  CDI: ['CDI'],
  CDD: ['CDD'],
  MIS: ['MIS'],
  SAI: ['SAI'],
};

function searchParams(p: Profile, q: string, cursor: number) {
  const params = new URLSearchParams({
    commune: p.commune,
    distance: String(p.radius),
    range: `${cursor}-${cursor + PAGE_SIZE - 1}`,
    sort: q ? '0' : '1',
  });
  const alternance = p.contracts.includes('alternance');
  const others = p.contracts.filter((c) => c !== 'alternance');
  if (alternance && !others.length) params.set('natureContrat', 'E1,E2');
  else if (!alternance && others.length)
    params.set(
      'typeContrat',
      others.flatMap((c) => contractCodes[c] || []).join(','),
    );
  if (p.experience === 'beginner') params.set('experienceExigence', 'D');
  if (q) params.set('motsCles', q);
  return params;
}

function cacheKey(p: Profile, q: string, cursor: number) {
  const contracts = [...p.contracts].sort().join(',');
  return `${p.commune}:${p.radius}:${contracts}:${p.experience}:${q.toLowerCase()}:${cursor}`;
}

export async function searchOffers(
  p: Profile,
  options: { q?: string; cursor?: number } = {},
): Promise<SearchResult> {
  if (!p.commune)
    throw new AppError(
      400,
      'Complète ta commune dans ton profil pour voir les offres.',
    );
  const raw = (options.q || '').trim().slice(0, 100);
  const q = raw.length >= 2 ? raw : '';
  const cursor =
    Number.isInteger(options.cursor) &&
    (options.cursor as number) >= 0 &&
    (options.cursor as number) <= MAX_START
      ? (options.cursor as number)
      : 0;
  const key = cacheKey(p, q, cursor);
  return searchMemory.getOrLoad(key, () => loadOffers(p, q, cursor, key));
}

async function loadOffers(
  p: Profile,
  q: string,
  cursor: number,
  key: string,
): Promise<SearchResult> {
  const { rows: entries } = await query<{
    jobs: Job[];
    fetched_at: string;
    partial: boolean;
  }>('select jobs,fetched_at,partial from offer_searches where key=$1', [key]);
  if (entries[0] && Date.now() - Date.parse(entries[0].fetched_at) < 15 * 60000)
    return {
      jobs: entries[0].jobs,
      partial: entries[0].partial,
      nextCursor: entries[0].partial ? cursor + PAGE_SIZE : null,
      fetchedAt: entries[0].fetched_at,
    };
  await limit('ft-global-search', 200, 3600);
  const r = await ft(`offres/search?${searchParams(p, q, cursor)}`);
  if (r.status !== 204 && r.status !== 416 && !r.ok)
    throw new AppError(
      r.status === 429 ? 429 : 503,
      'Les offres ne sont pas disponibles pour le moment. Réessaie dans quelques minutes.',
    );
  let rows: Record<string, unknown>[] = [];
  if (r.status !== 204 && r.status !== 416) {
    const data = (await r.json()) as { resultats?: Record<string, unknown>[] };
    rows = data.resultats || [];
  }
  const jobs = deduplicate(
    rows.map(normalizeJob).filter((j): j is Job => j !== null),
  );
  const partial = r.status === 206 && cursor + PAGE_SIZE <= MAX_START;
  const fetchedAt = new Date().toISOString();
  if (jobs.length) {
    const cacheRows = JSON.stringify(
      jobs.map((job) => ({ id: job.id, job, checked_at: fetchedAt })),
    );
    await query(
      `insert into job_cache(id,job,checked_at)
       select id,job,checked_at from jsonb_to_recordset($1::jsonb) as row(id text,job jsonb,checked_at timestamptz)
       on conflict(id) do update set job=excluded.job,checked_at=excluded.checked_at`,
      [cacheRows],
    );
  }
  await query(
    `insert into offer_searches(key,jobs,fetched_at,partial) values($1,$2,$3,$4)
    on conflict(key) do update set jobs=excluded.jobs,fetched_at=excluded.fetched_at,partial=excluded.partial`,
    [key, JSON.stringify(jobs), fetchedAt, partial],
  );
  return {
    jobs,
    partial,
    nextCursor: partial ? cursor + PAGE_SIZE : null,
    fetchedAt,
  };
}

export async function cachedJob(id: string): Promise<Job> {
  const { rows } = await query<{ job: Job; checked_at: string }>(
    'select job,checked_at from job_cache where id=$1',
    [id],
  );
  if (!rows.length)
    throw new AppError(404, 'Cette offre n’est plus disponible.');
  return rows[0].job;
}

export async function verifyJob(id: string): Promise<Job> {
  return detailMemory.getOrLoad(id, () => loadJob(id));
}

async function loadJob(id: string): Promise<Job> {
  let previous: Job | undefined;
  try {
    previous = await cachedJob(id);
  } catch (e) {
    if (!(e instanceof AppError) || e.status !== 404) throw e;
  }
  const r = await ft(`offres/${encodeURIComponent(id)}`);
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
    `insert into job_cache(id,job,checked_at) values($1,$2,now())
    on conflict(id) do update set job=excluded.job,checked_at=excluded.checked_at`,
    [id, job],
  );
  return job;
}
