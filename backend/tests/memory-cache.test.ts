import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../src/services/memory-cache.ts';

void test('memory cache reuses values, deduplicates loads and evicts old entries', async () => {
  const cache = new MemoryCache<number>(10_000, 2);
  let loads = 0;
  const load = async () => ++loads;
  const [first, second] = await Promise.all([
    cache.getOrLoad('a', load),
    cache.getOrLoad('a', load),
  ]);
  assert.equal(first, 1);
  assert.equal(second, 1);
  assert.equal(loads, 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), 3);
});
