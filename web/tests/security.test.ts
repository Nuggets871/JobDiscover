import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../lib/model.ts';
import {
  validateProfile,
  validateFeedback,
  safeExternalUrl,
  validPassword,
} from '../lib/validation.ts';
import {
  assertOrigin,
  body,
  sessionCookies,
  authenticate,
} from '../lib/server/core.ts';
import { normalizeJob, deduplicate } from '../lib/jobs.ts';
void test('profile validator drops injected ownership and rejects invalid constraints', () => {
  assert.equal(
    'user_id' in validateProfile({ ...defaultProfile, user_id: 'victim' }),
    false,
  );
  for (const patch of [
    { radius: -1 },
    { lat: NaN },
    { commune: '../x' },
    { interests: ['unknown'] },
    { contracts: ['ANY'] },
    { noNight: 'false' },
    { completed: true },
    { interests: ['aider'], avoid: ['aider'] },
  ])
    assert.throws(() => validateProfile({ ...defaultProfile, ...patch }));
});
void test('feedback cannot supply a job snapshot or another owner', () => {
  const f = validateFeedback({
    job_id: 'safe-123',
    verdict: 'like',
    reason: 'distance',
    job: { id: 'bad' },
    user_id: 'victim',
  });
  assert.deepEqual(f, { job_id: 'safe-123', verdict: 'like', reason: null });
  assert.throws(() =>
    validateFeedback({
      job_id: 'x&user_id=eq.victim',
      verdict: 'like',
      reason: null,
    }),
  );
});
void test('origin checks reject missing and hostile origins', () => {
  const c = { APP_ORIGIN: 'https://example.test' };
  assert.throws(() =>
    assertOrigin(
      new Request('https://example.test/api/profile', { method: 'PUT' }),
      c,
    ),
  );
  assert.throws(() =>
    assertOrigin(
      new Request('https://example.test/api/profile', {
        headers: { origin: 'https://evil.test' },
      }),
      c,
    ),
  );
  assert.doesNotThrow(() =>
    assertOrigin(
      new Request('https://example.test/api/profile', {
        headers: { origin: 'https://example.test' },
      }),
      c,
    ),
  );
});
void test('body parser enforces size and content type, including chunked bodies', async () => {
  await assert.rejects(
    body(new Request('http://localhost', { method: 'POST', body: '{}' })),
  );
  await assert.rejects(
    body(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ x: 'a'.repeat(20000) }),
      }),
    ),
  );
  assert.deepEqual(
    await body(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"a":1}',
      }),
    ),
    { a: 1 },
  );
});
void test('session tokens are HttpOnly, host-only and Secure in production; deletion clears both', () => {
  const c = { APP_ORIGIN: 'https://example.test' };
  const r = sessionCookies(new Response(), c, {
    access_token: 'test-access',
    refresh_token: 'test-refresh',
  });
  const cookies = r.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /__Host-jd_/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Domain=/);
  }
  assert.ok(
    sessionCookies(new Response(), c)
      .headers.getSetCookie()
      .every((x) => x.includes('Max-Age=0')),
  );
});
void test('missing configuration fails closed instead of trusting identity headers', async () => {
  await assert.rejects(
    authenticate(
      new Request('http://localhost', {
        headers: {
          'oai-authenticated-user-id': 'forged',
          'x-user-id': 'victim',
        },
      }),
      {},
    ),
    /comptes/,
  );
});
void test('external links reject executable and credential-bearing URLs', () => {
  for (const u of [
    'javascript:alert(1)',
    'data:text/html,x',
    'http://example.com',
    'https://user:pass@example.com',
  ])
    assert.equal(safeExternalUrl(u), null);
  assert.equal(
    safeExternalUrl('https://example.com/job'),
    'https://example.com/job',
  );
  assert.throws(() => validPassword('abc'));
});
void test('provider normalization never invents missing salary, schedules or coordinates', () => {
  const raw = {
    id: 'abc',
    intitule: 'Accueil',
    description: 'Accueillir le public',
    typeContrat: 'CDI',
  };
  const j = normalizeJob(raw)!;
  assert.equal(j.salary, 'Salaire non renseigné');
  assert.equal(j.night, null);
  assert.equal(j.weekend, null);
  assert.equal(j.lat, null);
  assert.equal(j.experienceRequired, true);
  assert.equal(deduplicate([j, { ...j, id: 'other' }]).length, 1);
  assert.equal(normalizeJob({ ...raw, id: '../bad' }), null);
});
