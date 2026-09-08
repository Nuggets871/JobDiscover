import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultProfile,
  type Job,
  type Reaction,
  type Profile,
} from '../lib/model.ts';
import { eligible, learnedWeights, recommend } from '../lib/recommendations.ts';
const j: Job = {
  id: 'one',
  title: 'Accueil',
  company: 'Example',
  city: 'Lyon',
  lat: 45.76,
  lon: 4.83,
  contract: 'CDI',
  salary: 'Non renseigné',
  summary: 'Accueillir le public',
  description: 'Accueillir le public',
  tags: ['accueillir'],
  sector: 'Culture',
  experienceRequired: false,
  night: false,
  weekend: false,
  url: null,
  updatedAt: '2026-09-01',
  active: true,
};
void test('hard constraints remain enforced during exploration, including unknown hours', () => {
  const p = {
    ...defaultProfile,
    noNight: true,
    noWeekend: true,
    contracts: ['CDI'],
    lat: 45.76,
    lon: 4.83,
  };
  for (const patch of [
    { night: null },
    { night: true },
    { weekend: null },
    { weekend: true },
    { contract: 'CDD' },
    { lat: 48.8, lon: 2.3 },
    { lat: null },
    { active: false },
  ]) {
    assert.equal(eligible({ ...j, ...patch }, p), false);
    assert.deepEqual(
      recommend([{ ...j, ...patch }], p, [], { surprise: true }),
      [],
    );
  }
  assert.equal(eligible(j, p), true);
});
void test('commute, salary and confidence rejection never penalize a profession', () => {
  for (const reason of ['distance', 'salary', 'qualification', 'hours', null]) {
    const r: Reaction = { job_id: j.id, job: j, verdict: 'reject', reason };
    assert.equal(learnedWeights([r]).accueillir, 0);
  }
  assert.ok(
    learnedWeights([
      { job_id: j.id, job: j, verdict: 'reject', reason: 'missions' },
    ]).accueillir! < 0,
  );
});
void test('feedback is bounded and older choices decay', () => {
  const r: Reaction = { job_id: j.id, job: j, verdict: 'like', reason: null };
  assert.equal(learnedWeights(Array(100).fill(r)).accueillir, 3);
  assert.ok(
    learnedWeights(
      [{ ...r, created_at: '2020-01-01' }],
      Date.parse('2026-01-01'),
    ).accueillir! < 0.1,
  );
});
void test('cold start explains discovery without inventing preferences', () => {
  const result = recommend([j], defaultProfile, []);
  assert.equal(result[0].kind, 'discovery');
  assert.match(result[0].explanation, /explorer/);
});
void test('a match explanation cites an actual preference and excludes rated or skipped jobs', () => {
  const p = { ...defaultProfile, interests: ['accueillir'] as const };
  const result = recommend([j], { ...p, interests: [...p.interests] }, []);
  assert.equal(result[0].kind, 'match');
  assert.match(result[0].explanation, /échanger/);
  assert.equal(
    recommend([j], defaultProfile, [], { skipped: ['one'] }).length,
    0,
  );
  assert.equal(
    recommend([j], defaultProfile, [
      { job: j, job_id: 'one', verdict: 'maybe', reason: null },
    ]).length,
    0,
  );
});
void test('exploration includes other domains and keeps each listing unique', () => {
  const jobs = Array.from(
    { length: 30 },
    (_, i) =>
      ({
        ...j,
        id: String(i),
        company: String(i),
        tags:
          i % 3 === 0
            ? ['accueillir']
            : i % 3 === 1
              ? ['nature']
              : ['analyser'],
      }) as Job,
  );
  const r = recommend(
    jobs,
    { ...defaultProfile, interests: ['accueillir'] },
    [],
  );
  assert.equal(new Set(r.map((x) => x.job.id)).size, jobs.length);
  assert.ok(r.slice(0, 10).some((x) => x.kind === 'discovery'));
});

void test('successive single-card recommendations preserve the exploration schedule', () => {
  const jobs = Array.from(
    { length: 40 },
    (_, i) =>
      ({
        ...j,
        id: String(i),
        company: String(i),
        tags: i < 30 ? ['accueillir'] : ['analyser'],
      }) as Job,
  );
  const p = {
    ...defaultProfile,
    interests: ['accueillir'] as Profile['interests'],
  };
  const skipped: string[] = [];
  const kinds: string[] = [];
  for (let step = 0; step < 8; step++) {
    const card = recommend(jobs, p, [], { skipped, offset: step })[0];
    kinds.push(card.kind);
    skipped.push(card.job.id);
  }
  assert.ok(kinds.includes('match'));
  assert.ok(
    kinds.includes('discovery'),
    'exploration must not wait until all 30 matches are exhausted',
  );
});
