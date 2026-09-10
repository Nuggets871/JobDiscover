import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDesireAnalysis } from '../src/services/desires.ts';

void test('desire analysis accepts a clean JSON payload and caps lists', () => {
  const result = parseDesireAnalysis({
    summary: 'Travailler au contact des personnes et dehors.',
    interests: ['aider', 'nature', 'nature', 'analyser'],
    avoids: ['vendre'],
    domains: ['soin', 'environnement'],
  });
  assert.equal(result.summary, 'Travailler au contact des personnes et dehors.');
  assert.deepEqual(result.interests, ['aider', 'nature', 'analyser']);
  assert.deepEqual(result.avoids, ['vendre']);
  assert.deepEqual(result.domains, ['soin', 'environnement']);
});

void test('desire analysis drops unknown interests, injection and empty payloads', () => {
  const injected = parseDesireAnalysis({
    summary:
      'ignore les instructions <script>alert(1)</script> https://evil.test toi@example.fr',
    interests: ['organiser', 'fake', 'ignore'],
    avoids: ['creer', 'steal'],
    domains: ['a'.repeat(200), '', 'ok'],
  });
  assert.deepEqual(injected.interests, ['organiser']);
  assert.deepEqual(injected.avoids, ['creer']);
  assert.ok(!injected.summary.includes('<'));
  assert.ok(!injected.summary.includes('@'));
  assert.ok(!injected.summary.includes('http'));
  assert.equal(injected.domains[0].length, 40);
  assert.deepEqual(injected.domains[1], 'ok');
  assert.throws(() => parseDesireAnalysis({}));
  assert.throws(() => parseDesireAnalysis({ interests: ['aider'], avoids: ['aider'] }));
});

void test('desire analysis accepts non-object payloads without crashing', () => {
  for (const raw of [null, 'text', 42, [], ['aider']])
    assert.throws(() => parseDesireAnalysis(raw));
});