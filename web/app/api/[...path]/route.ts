import { config, json } from '@/lib/server/core';

export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  const c = await config();
  if (
    !c.BACKEND_URL ||
    !c.BACKEND_SHARED_SECRET ||
    c.BACKEND_SHARED_SECRET.length < 32
  ) {
    if (req.method === 'GET' && new URL(req.url).pathname === '/api/status')
      return json({
        accounts: false,
        offers: Boolean(
          c.FRANCE_TRAVAIL_CLIENT_ID && c.FRANCE_TRAVAIL_CLIENT_SECRET,
        ),
        ai: false,
      });
    return json(
      {
        error:
          'Les comptes ne sont pas encore activés. La démonstration reste accessible.',
      },
      503,
    );
  }
  const backend = new URL(c.BACKEND_URL);
  const local = ['localhost', '127.0.0.1', '::1'].includes(backend.hostname);
  if (
    (backend.protocol !== 'https:' && !local) ||
    backend.username ||
    backend.password
  )
    return json({ error: 'Le service est mal configuré.' }, 503);
  const incoming = new URL(req.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, backend);
  const headers = new Headers();
  for (const name of [
    'accept',
    'content-type',
    'cookie',
    'origin',
    'sec-fetch-site',
    'authorization',
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-jobdiscover-proxy', c.BACKEND_SHARED_SECRET);
  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      // Required for streaming request bodies in Node-compatible runtimes.
      duplex: 'half',
    } as RequestInit);
    const outgoing = new Headers();
    for (const name of [
      'cache-control',
      'content-disposition',
      'content-type',
      'referrer-policy',
      'vary',
      'x-content-type-options',
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie())
      outgoing.append('set-cookie', cookie);
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return json(
      {
        error:
          'Le service est momentanément indisponible. Réessaie dans un instant.',
      },
      503,
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
