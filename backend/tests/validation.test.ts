import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../src/model.ts';
import {
  validateProfile,
  validateFeedback,
  safeExternalUrl,
  validEmail,
  validLoginPassword,
  validPassword,
} from '../src/validation.ts';
import { normalizeJob, deduplicate } from '../src/jobs.ts';

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
    { education: 'doctorat' },
    { domainPreference: 'always' },
    { domain: 'x'.repeat(100) },
    { desires: 'x'.repeat(3000) },
  ])
    assert.throws(() => validateProfile({ ...defaultProfile, ...patch }));
});

void test('profile validator keeps the new parcours fields', () => {
  const p = validateProfile({
    ...defaultProfile,
    education: 'bac3',
    domain: 'santé et social',
    domainPreference: 'related',
    desires: "j'aimerais aider les gens dans le soin",
  });
  assert.equal(p.education, 'bac3');
  assert.equal(p.domain, 'santé et social');
  assert.equal(p.domainPreference, 'related');
  assert.equal(p.desires, "j'aimerais aider les gens dans le soin");
});

void test('login requires a valid email and a non-empty password', () => {
  assert.equal(validEmail('Ggez@Example.fr'), 'ggez@example.fr');
  assert.throws(() => validEmail('not an email'));
  assert.equal(validLoginPassword('ggez'), 'ggez');
  assert.throws(() => validLoginPassword(''));
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
  assert.throws(() => validPassword('court'));
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
