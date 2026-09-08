import test from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordHash,
  randomToken,
  tokenHash,
  verifyPassword,
} from '../lib/server/crypto.ts';
import { sessionCookies } from '../lib/server/core.ts';

void test('password hashes use a unique salt and verify the complete password', async () => {
  const password = ' une longue phrase secrète ';
  const first = await passwordHash(password);
  const second = await passwordHash(password);
  assert.notEqual(first, second);
  assert.match(first, /^pbkdf2-sha256\$600000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword('mauvaise phrase secrète', first), false);
});

void test('session and confirmation tokens are random and only their digest is stable', async () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.match(first, /^[a-zA-Z0-9_-]{40,}$/);
  assert.equal((await tokenHash(first)).length, 64);
  assert.equal(await tokenHash(first), await tokenHash(first));
  assert.notEqual(await tokenHash(first), await tokenHash(second));
});

void test('custom sessions remain HttpOnly, host-only and secure', () => {
  const response = sessionCookies(
    new Response(),
    { APP_ORIGIN: 'https://example.test' },
    {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    },
  );
  for (const cookie of response.headers.getSetCookie()) {
    assert.match(cookie, /__Host-jd_/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Domain=/);
  }
});
