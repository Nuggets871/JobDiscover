import {
  defaultProfile,
  interests,
  rejectionReasons,
  type Profile,
} from './model.ts';

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError(400, 'Données invalides.');
  return value as Record<string, unknown>;
}

export function string(value: unknown, max = 200) {
  if (typeof value !== 'string' || value.length > max)
    throw new AppError(400, 'Texte invalide.');
  return value.trim();
}

export function validateProfile(value: unknown): Profile {
  const v = object(value);
  const p = { ...defaultProfile };
  p.city = string(v.city, 100);
  p.commune = string(v.commune, 5);
  if (p.commune && !/^[0-9A-Z]{5}$/.test(p.commune))
    throw new AppError(400, 'Commune invalide.');
  for (const k of ['lat', 'lon'] as const) {
    const n = v[k];
    if (
      n !== null &&
      (typeof n !== 'number' ||
        !Number.isFinite(n) ||
        Math.abs(n) > (k === 'lat' ? 90 : 180))
    )
      throw new AppError(400, 'Localisation invalide.');
    p[k] = n as number | null;
  }
  for (const k of ['radius', 'discovery'] as const) {
    const n = v[k];
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < (k === 'radius' ? 5 : 15) ||
      n > 100
    )
      throw new AppError(400, 'Valeur hors limites.');
    p[k] = n;
  }
  for (const k of ['interests', 'avoid'] as const) {
    if (
      !Array.isArray(v[k]) ||
      (v[k] as unknown[]).some(
        (x) => typeof x !== 'string' || !(x in interests),
      ) ||
      (v[k] as unknown[]).length > 8
    )
      throw new AppError(400, 'Préférences invalides.');
    p[k] = [...new Set(v[k] as Profile['interests'])];
  }
  if (p.interests.some((x) => p.avoid.includes(x)))
    throw new AppError(
      400,
      'Une activité ne peut pas être souhaitée et exclue.',
    );
  if (
    !Array.isArray(v.contracts) ||
    v.contracts.length > 5 ||
    v.contracts.some(
      (x) => !['CDI', 'CDD', 'MIS', 'SAI', 'alternance'].includes(x),
    )
  )
    throw new AppError(400, 'Contrats invalides.');
  p.contracts = [...new Set(v.contracts)] as string[];
  for (const k of ['noNight', 'noWeekend', 'training', 'completed'] as const) {
    if (typeof v[k] !== 'boolean') throw new AppError(400, 'Option invalide.');
    p[k] = v[k] as boolean;
  }
  if (!['any', 'beginner'].includes(v.experience as string))
    throw new AppError(400, 'Expérience invalide.');
  p.experience = v.experience as Profile['experience'];
  if (p.completed && (!p.commune || p.lat === null || p.lon === null))
    throw new AppError(
      400,
      'Choisis une commune pour trouver des offres près de toi.',
    );
  return p;
}

export function validateFeedback(value: unknown) {
  const v = object(value);
  const id = string(v.job_id, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new AppError(400, 'Offre invalide.');
  if (!['like', 'maybe', 'reject'].includes(v.verdict as string))
    throw new AppError(400, 'Réaction invalide.');
  const reason = v.reason === null ? null : string(v.reason, 30);
  if (reason && !(reason in rejectionReasons))
    throw new AppError(400, 'Motif invalide.');
  return {
    job_id: id,
    verdict: v.verdict as 'like' | 'maybe' | 'reject',
    reason: v.verdict === 'reject' ? reason : null,
  };
}

export function validEmail(value: unknown) {
  const email = string(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError(400, 'Vérifie ton adresse e-mail.');
  return email;
}

export function validLogin(value: unknown) {
  const login = string(value, 254).toLowerCase();
  if (/^[a-z0-9_-]{3,32}$/.test(login)) return login;
  return validEmail(login);
}

export function validLoginPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128)
    throw new AppError(400, 'Vérifie ton mot de passe.');
  return value;
}

export function validPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new AppError(400, 'Choisis un mot de passe de 12 à 128 caractères.');
  return value;
}

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
