export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(data === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
  };
  let r: Response;
  try {
    r = await fetch(`/api/${path}`, init);
  } catch {
    throw new Error('Connexion interrompue. Vérifie ton réseau puis réessaie.');
  }
  let result: { error?: string };
  try {
    result = await r.json();
  } catch {
    throw new Error('Le service ne répond pas. Réessaie dans un instant.');
  }
  if (!r.ok)
    throw new ApiError(r.status, result.error || 'Une erreur est survenue.');
  return result as T;
}