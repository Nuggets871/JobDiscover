import { AppError } from '../validation.ts';

export async function remote(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
  } catch {
    throw new AppError(
      503,
      'Le service est momentanément indisponible. Réessaie dans un instant.',
    );
  }
}

export async function requireOK(response: Response) {
  if (!response.ok)
    throw new AppError(503, 'Le service est momentanément indisponible.');
}