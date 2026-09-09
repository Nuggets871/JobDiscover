import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

void test('API responses set security headers and reject cross-site writes', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('referrer-policy'), 'no-referrer');
    assert.match(health.headers.get('cache-control') || '', /no-store/);
    assert.equal(health.headers.has('x-powered-by'), false);

    const crossSite = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'a@example.test',
        password: 'long-enough-password',
      }),
    });
    assert.equal(crossSite.status, 403);
  } finally {
    server.close();
  }
});
