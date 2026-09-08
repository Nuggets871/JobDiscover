import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { handleApiRequest } from '../lib/server/router.ts';

const port = Number(process.env.PORT || 3100);
const host = process.env.HOST || '127.0.0.1';
const sharedSecret = process.env.BACKEND_SHARED_SECRET || '';
if (sharedSecret.length < 32)
  throw new Error('BACKEND_SHARED_SECRET must contain at least 32 characters');
if (!process.env.APP_ORIGIN) throw new Error('APP_ORIGIN is required');

function authorized(value: string) {
  const first = createHash('sha256').update(value).digest();
  const second = createHash('sha256').update(sharedSecret).digest();
  return timingSafeEqual(first, second);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    if (incoming.url === '/healthz' && incoming.method === 'GET') {
      outgoing.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      outgoing.end('ok');
      return;
    }
    if (!authorized(String(incoming.headers['x-jobdiscover-proxy'] || ''))) {
      outgoing.writeHead(404, { 'cache-control': 'no-store' });
      outgoing.end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 20_000) throw new Error('Request body too large');
      chunks.push(bytes);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value))
        value.forEach((item) => headers.append(name, item));
      else if (value) headers.set(name, value);
    }
    const url = new URL(incoming.url || '/', process.env.APP_ORIGIN);
    const request = new Request(url, {
      method: incoming.method,
      headers,
      body: ['GET', 'HEAD'].includes(incoming.method || '')
        ? undefined
        : Buffer.concat(chunks),
    });
    const response = await handleApiRequest(request, process.env);
    const responseHeaders: Record<string, string | string[]> = {};
    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie') responseHeaders[name] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) responseHeaders['set-cookie'] = cookies;
    outgoing.writeHead(response.status, responseHeaders);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    });
    outgoing.end(
      JSON.stringify({
        error: 'Une erreur est survenue. Réessaie dans un instant.',
      }),
    );
  }
});

server.listen(port, host, () =>
  process.stdout.write(`JobDiscover backend listening on ${host}:${port}\n`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
