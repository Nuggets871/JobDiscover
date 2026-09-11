import { interests, type Interest, type Job } from './model.ts';
import { safeExternalUrl } from './validation.ts';

const keywords: Record<Interest, RegExp> = {
  organiser: /organis|coordonn|planifi|gestion|administrati/i,
  aider: /accompagn|aider|social|soin|insertion/i,
  creer: /créa|crea|culture|communic|design|artist/i,
  accueillir: /accueil|public|relation|client/i,
  manuel: /répar|repar|fabric|maintenance|atelier|technic/i,
  analyser: /analy|donnée|comptab|qualité|qualite|contrôle/i,
  nature: /jardin|nature|paysag|agric|environnement/i,
  vendre: /vente|vendre|conseill|commercial/i,
};

export function inferTags(text: string): Interest[] {
  return (Object.keys(interests) as Interest[]).filter((k) =>
    keywords[k].test(text),
  );
}

const clean = (x: unknown, n = 6000) =>
  typeof x === 'string'
    ? x
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, n)
    : '';

export function normalizeJob(raw: Record<string, unknown>): Job | null {
  const id = clean(raw.id, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  const place = (raw.lieuTravail || {}) as Record<string, unknown>;
  const company = (raw.entreprise || {}) as Record<string, unknown>;
  const salary = (raw.salaire || {}) as Record<string, unknown>;
  const title = clean(raw.intitule, 200);
  const description = clean(raw.description, 14000);
  if (!title || !description) return null;
  const schedule =
    clean(raw.dureeTravailLibelle, 300) +
    ' ' +
    clean(raw.dureeTravailLibelleConverti, 300) +
    ' ' +
    description;
  const night = /travail de nuit|horaires? de nuit|travail.*nocturne/i.test(
    schedule,
  )
    ? true
    : /travail en journée|horaires? de jour|sans travail de nuit/i.test(
        schedule,
      )
      ? false
      : null;
  const weekend =
    /travail le (?:samedi|dimanche)|travail (?:en |le )?week.end|du lundi au samedi/i.test(
      schedule,
    )
      ? true
      : /du lundi au vendredi|sans week.end|pas de travail le week.end/i.test(
          schedule,
        )
        ? false
        : null;
  const lat = Number(place.latitude),
    lon = Number(place.longitude);
  const exp = clean(raw.experienceExige, 4);
  const rome = clean(raw.romeCode, 10);
  return {
    id,
    title,
    description,
    company: clean(company.nom, 120) || 'Entreprise non précisée',
    city: clean(place.libelle, 100),
    lat:
      place.latitude != null && Number.isFinite(lat) && Math.abs(lat) <= 90
        ? lat
        : null,
    lon:
      place.longitude != null && Number.isFinite(lon) && Math.abs(lon) <= 180
        ? lon
        : null,
    contract:
      raw.alternance === true ? 'alternance' : clean(raw.typeContrat, 30),
    salary: clean(salary.libelle, 200) || 'Salaire non renseigné',
    summary: description.slice(0, 220) + (description.length > 220 ? '…' : ''),
    tags: inferTags(`${title} ${description}`),
    sector:
      clean(raw.secteurActiviteLibelle, 120) ||
      clean(raw.romeLibelle, 120) ||
      'Métier à explorer',
    romeCode: /^[A-Z]\d{4}$/.test(rome) ? rome : null,
    experienceRequired: exp !== 'D',
    night,
    weekend,
    url:
      safeExternalUrl(
        (raw.origineOffre as Record<string, unknown>)?.urlOrigine,
      ) ||
      `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(id)}`,
    updatedAt: clean(raw.dateActualisation, 50) || new Date().toISOString(),
    active: true,
  };
}

export function deduplicate(jobs: Job[]) {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const key =
      `${j.title}|${j.company}|${j.city}|${j.contract}`.toLocaleLowerCase('fr');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}