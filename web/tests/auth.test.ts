import test from 'node:test';
import assert from 'node:assert/strict';
import { authAction } from '../lib/server/auth.ts';
import { admin } from '../lib/server/core.ts';
const c = {
  APP_ORIGIN: 'https://example.test',
  SUPABASE_URL: 'https://database.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'public-placeholder',
  SUPABASE_SECRET_KEY: 'secret-placeholder',
};
const request = new Request('https://example.test/api/auth/delete', {
  headers: { cookie: '__Host-jd_access=fixture-access' },
});
function mock(
  run: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('rpc/consume_rate_limit')) return new Response('true');
    return run(url, init || {});
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
void test('login keeps tokens out of response JSON and preserves spaces in passwords', async () => {
  const restore = mock((url, init) => {
    assert.match(url, /grant_type=password/);
    assert.equal(
      JSON.parse(init.body as string).password,
      ' long test password ',
    );
    return Response.json({
      access_token: 'fixture-access',
      refresh_token: 'fixture-refresh',
      user: { email_confirmed_at: '2026-01-01' },
    });
  });
  try {
    const r = await authAction(request, c, 'login', {
      email: 'test@example.invalid',
      password: ' long test password ',
    });
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(r.headers.getSetCookie().length, 2);
  } finally {
    restore();
  }
});
void test('account deletion requires password verification before privileged deletion', async () => {
  let deleted = false;
  const restore = mock((url) => {
    if (url.endsWith('/user'))
      return Response.json({
        id: 'fixture-id',
        email: 'test@example.invalid',
        email_confirmed_at: '2026-01-01',
      });
    if (url.includes('grant_type=password'))
      return new Response('{}', { status: 400 });
    if (url.includes('/admin/users/')) deleted = true;
    return new Response('{}');
  });
  try {
    await assert.rejects(
      authAction(request, c, 'delete', {
        confirmation: 'SUPPRIMER',
        password: 'incorrect password',
      }),
      /mot de passe/,
    );
    assert.equal(deleted, false);
  } finally {
    restore();
  }
});
void test('opaque secret API keys are never passed as JWT bearer tokens', async () => {
  const restore = mock((_url, init) => {
    const h = new Headers(init.headers);
    assert.equal(h.get('apikey'), 'secret-placeholder');
    assert.equal(h.has('Authorization'), false);
    return new Response('[]');
  });
  try {
    await admin(c, 'job_cache');
  } finally {
    restore();
  }
});
void test('confirmation links cannot select arbitrary auth actions', async () => {
  const restore = mock(() => {
    throw new Error('Unexpected auth request');
  });
  try {
    await assert.rejects(
      authAction(request, c, 'confirm', {
        token_hash: 'a'.repeat(40),
        type: 'admin',
      }),
      /Lien invalide/,
    );
  } finally {
    restore();
  }
});
