import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../src/model.ts';
import {
  validateProfile,
  validateFeedback,
  safeExternalUrl,
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