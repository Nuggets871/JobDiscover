import {
  interests,
  type Profile,
  type Job,
  type Interest,
  type Reaction,
  type Recommendation,
} from './model.ts';

export function distanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) *
      Math.cos(rad(bLat)) *
      Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}

function domainTokens(domain: string) {
  return domain
    .toLowerCase()
    .split(/[^a-z0-9à-öø-ÿœ-]+/i)
    .filter((word) => word.length > 2);
}

export function matchesDomain(job: Job, domain: string) {
  const tokens = domainTokens(domain);
  if (!tokens.length) return false;
  const hay = `${job.sector} ${job.title} ${job.summary}`.toLowerCase();
  return tokens.some((token) => hay.includes(token));
}

export function eligible(job: Job, p: Profile) {
  if (!job.active) return false;
  if (p.contracts.length && !p.contracts.includes(job.contract)) return false;
  if (p.noNight && job.night !== false) return false;
  if (p.noWeekend && job.weekend !== false) return false;
  if (p.experience === 'beginner' && job.experienceRequired) return false;
  if (
    p.domainPreference === 'avoid' &&
    p.domain &&
    matchesDomain(job, p.domain)
  )
    return false;
  if (p.lat !== null && p.lon !== null) {
    if (
      job.lat === null ||
      job.lon === null ||
      distanceKm(p.lat, p.lon, job.lat, job.lon) > p.radius
    )
      return false;
  }
  return true;
}

export function learnedWeights(feedback: Reaction[], now = Date.now()) {
  const weights: Partial<Record<Interest, number>> = {};
  for (const f of feedback) {
    const signal =
      f.verdict === 'like'
        ? 1
        : f.verdict === 'maybe'
          ? 0.3
          : f.reason === 'missions'
            ? -0.6
            : 0;
    const age = f.created_at
      ? Math.max(0, (now - Date.parse(f.created_at)) / 86400000)
      : 0;
    const decay = Number.isFinite(age) ? Math.exp(-age / 90) : 1;
    for (const tag of f.job.tags)
      weights[tag] = (weights[tag] || 0) + signal * decay;
  }
  for (const k of Object.keys(weights) as Interest[])
    weights[k] = Math.max(-3, Math.min(3, weights[k] || 0));
  return weights;
}

const adjacent: Record<Interest, Interest[]> = {
  organiser: ['analyser', 'accueillir'],
  aider: ['accueillir', 'nature'],
  creer: ['manuel', 'organiser'],
  accueillir: ['aider', 'vendre'],
  manuel: ['nature', 'creer'],
  analyser: ['organiser', 'manuel'],
  nature: ['manuel', 'aider'],
  vendre: ['accueillir', 'organiser'],
};

export function recommend(
  jobs: Job[],
  p: Profile,
  feedback: Reaction[],
  options: {
    surprise?: boolean;
    skipped?: string[];
    now?: number;
    offset?: number;
  } = {},
): Recommendation[] {
  const weights = learnedWeights(feedback, options.now);
  const seen = new Set([
    ...feedback.map((f) => f.job_id),
    ...(options.skipped || []),
  ]);
  const positive = (Object.keys(weights) as Interest[]).filter(
    (k) => (weights[k] || 0) > 0.25,
  );
  const preferences = [...new Set([...p.interests, ...positive])];
  const candidates = jobs
    .filter((j) => !seen.has(j.id) && eligible(j, p))
    .map((job) => {
      const direct = job.tags.filter((t) => p.interests.includes(t));
      const learned = job.tags.filter((t) => positive.includes(t));
      const near = preferences.find((t) =>
        adjacent[t].some((x) => job.tags.includes(x)),
      );
      const kind: Recommendation['kind'] =
        direct.length || learned.length
          ? 'match'
          : near
            ? 'neighbor'
            : 'discovery';
      let explanation =
        'Une proposition pour explorer ce domaine et découvrir ce qui te plaît.';
      if (direct.length)
        explanation = `Tu as choisi « ${interests[direct[0]].toLowerCase()} ». Les missions de cette offre touchent à cette activité.`;
      else if (learned.length)
        explanation = `Tes réactions positives font ressortir « ${interests[learned[0]].toLowerCase()} ». Une dimension présente dans cette offre.`;
      else if (near)
        explanation = `Une piste proche de ton intérêt pour « ${interests[near].toLowerCase()} », dans un autre type d’activité.`;
      else if (preferences.length)
        explanation =
          'Un métier différent de tes envies actuelles, pour laisser une place à la découverte.';
      const score =
        direct.length * 3 +
        (p.domainPreference === 'related' &&
        p.domain &&
        matchesDomain(job, p.domain)
          ? 2
          : 0) +
        job.tags.reduce(
          (n, t) => n + (weights[t] || 0) - (p.avoid.includes(t) ? 4 : 0),
          0,
        ) -
        (job.experienceRequired && !p.training ? 1 : 0);
      return { job, kind, explanation, score };
    })
    .sort((a, b) => b.score - a.score || a.job.id.localeCompare(b.job.id));
  const result: Recommendation[] = [];
  const remaining = [...candidates];
  const d = p.discovery / 100;
  while (remaining.length) {
    const slot = ((result.length + (options.offset ?? 0)) * 0.61803398875) % 1;
    const target: Recommendation['kind'] = options.surprise
      ? result.length % 3 === 0
        ? 'discovery'
        : 'neighbor'
      : slot < 1 - d
        ? 'match'
        : slot < 1 - d + d * 0.625
          ? 'neighbor'
          : 'discovery';
    let pool = remaining.filter((x) => x.kind === target);
    if (!pool.length) pool = remaining;
    const prev = result.at(-1);
    pool.sort((a, b) => {
      const penalty = (x: Recommendation) =>
        prev
          ? (x.job.company === prev.job.company ? 5 : 0) +
            (x.job.sector === prev.job.sector ? 3 : 0)
          : 0;
      return b.score - penalty(b) - (a.score - penalty(a));
    });
    const next = pool[0];
    result.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return result;
}