import test from 'node:test';
import assert from 'node:assert/strict';
import { registerDiscoveryTools, type Tool } from '../lib/webmcp.ts';
void test('WebMCP uses the shared state and rejects unexpected input', async () => {
  const tools: Tool[] = [];
  const signals: AbortSignal[] = [];
  let view = 'discover';
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
  const cleanup = registerDiscoveryTools(
    {
      registerTool: (tool, opt) => {
        tools.push(tool);
        signals.push(opt.signal);
      },
    },
    () => ({ title: 'Test offer' }),
    (v) => {
      view = v;
    },
  );
  assert.deepEqual(
    tools.map((t) => t.name),
    ['read_current_job', 'navigate_jobdiscover'],
  );
  assert.deepEqual(tools[0].execute({}), { title: 'Test offer' });
  await tools[1].execute({ view: 'saved' });
  assert.equal(view, 'saved');
  await assert.rejects(tools[1].execute({ view: 'admin' }) as Promise<unknown>);
  assert.equal(view, 'saved');
  assert.throws(() => tools[0].execute({ extra: true }));
  cleanup();
  assert.ok(signals.every((s) => s.aborted));
});
