import test from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordHash,
  randomToken,
  tokenHash,
  verifyPassword,
} from '../src/crypto.ts';
import {
  sessionCookie,
  clearCookie,
  COOKIE_NAME,
} from '../src/services/auth.ts';
import { emailConfigured } from '../src/services/email.ts';

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

void test('console email delivery is limited to non-production environments', () => {
  const mode = process.env.AUTH_EMAIL_MODE;
  const environment = process.env.NODE_ENV;
  try {
    process.env.AUTH_EMAIL_MODE = 'console';
    process.env.NODE_ENV = 'development';
    assert.equal(emailConfigured(), true);
    process.env.NODE_ENV = 'production';
    assert.equal(emailConfigured(), false);
  } finally {
    process.env.AUTH_EMAIL_MODE = mode;
    process.env.NODE_ENV = environment;
  }
});

void test('session tokens are random and only their digest is stable', async () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.match(first, /^[a-zA-Z0-9_-]{40,}$/);
  assert.equal((await tokenHash(first)).length, 64);
  assert.equal(await tokenHash(first), await tokenHash(first));
  assert.notEqual(await tokenHash(first), await tokenHash(second));
});

void test('session cookie is HttpOnly, host-only and Secure over HTTPS', () => {
  const original = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://example.test';
  try {
    const cookie = sessionCookie('session-token', 3600);
    assert.match(cookie, new RegExp(`^${COOKIE_NAME}=session-token;`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=3600/);
    assert.doesNotMatch(cookie, /Domain=/);
    assert.match(clearCookie(), /Max-Age=0/);
  } finally {
    process.env.APP_ORIGIN = original;
  }
});
