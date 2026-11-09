const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const l10n = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
const model = load('admin/adminActivityModel', { '../shared/localization': l10n });
const { AdminActivityController } = load('admin/adminActivityController', { './adminActivityModel': model });
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  let active = true, scope = 'server-a', generation = 1, permission = true, frame;
  let snapshot = { loadingSummary: false, loadedSummary: false, summaryError: null, summary: {}, loadingActivity: false,
    loadedActivity: false, activityError: null, activityItems: [{ id: 'one' }, { id: 'hidden' }] };
  const calls = [], listeners = new Set(), hubListeners = new Set();
  const store = { getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    bootstrapActivity: async () => { calls.push('bootstrap'); }, refreshActivity: async () => { calls.push('refresh'); } };
  const hub = { topic: '', version: 0, subscribe: fn => { hubListeners.add(fn); return () => hubListeners.delete(fn); },
    emit(topic, version) { this.topic = topic; this.version = version; for (const listener of hubListeners) listener(); } };
  const hidden = { load: async guard => { guard(); calls.push('load-hidden'); return new Set(['hidden']); },
    hideAll: async (ids, guard) => { guard(); calls.push(['hide', [...ids]]); return new Set(ids); }, ...overrides.hidden };
  const deps = { store, hub, hidden, isCurrent: () => active, scope: () => scope, generation: () => generation, canOpen: () => permission,
    afterFrame: () => new Promise(resolve => { frame = resolve; }) };
  const controller = new AdminActivityController(deps);
  return { controller, calls, hub, frame: () => frame(), setActive: value => { active = value; }, setScope: value => { scope = value; },
    setGeneration: value => { generation = value; }, setPermission: value => { permission = value; },
    setItems: items => { snapshot = { ...snapshot, activityItems: items }; for (const listener of listeners) listener(); }, listeners, hubListeners };
}
test('activity waits for first frame, loads hidden state explicitly and listens only to fresh admin events', async () => {
  const f = fixture(); f.controller.start(); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().hiddenState, 'loading');
  f.frame(); await tick(); assert.deepEqual(f.calls, ['bootstrap', 'load-hidden']);
  assert.deepEqual([...f.controller.getSnapshot().hiddenIds], ['hidden']); assert.equal(f.controller.getSnapshot().hiddenState, 'ready');
  f.hub.emit('supplier', 1); f.hub.emit('admin', 1); f.hub.emit('admin', 1); f.hub.emit('admin', 2); await tick();
  assert.deepEqual(f.calls, ['bootstrap', 'load-hidden', 'refresh', 'refresh']);
  f.controller.dispose(); assert.equal(f.listeners.size, 0); assert.equal(f.hubListeners.size, 0);
});
test('clear confirmation uses all current records, including already hidden, and cancellation never writes', async () => {
  const f = fixture(); f.controller.start(); f.frame(); await tick();
  const cancelled = f.controller.requestClear(); await f.controller.resolveClear(cancelled, false);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'hide'), false);
  const serial = f.controller.requestClear(); assert.equal(f.controller.requestClear(), null);
  f.setItems([{ id: 'new' }, { id: 'hidden' }, { id: 'new' }]);
  await f.controller.resolveClear(serial, true);
  assert.deepEqual(f.calls.at(-1), ['hide', ['new', 'hidden', 'new']]);
  assert.deepEqual([...f.controller.getSnapshot().hiddenIds], ['new', 'hidden']);
  await f.controller.resolveClear(serial, true); assert.equal(f.calls.filter(call => Array.isArray(call)).length, 1);
});
test('changed account, permission, scope or generation invalidates a pending clear and never writes', async () => {
  for (const mutate of [f => f.setActive(false), f => f.setScope('server-b'), f => f.setGeneration(2), f => f.setPermission(false)]) {
    const f = fixture(); f.controller.start(); f.frame(); await tick(); const serial = f.controller.requestClear(); mutate(f);
    await f.controller.resolveClear(serial, true); assert.equal(f.calls.some(call => Array.isArray(call)), false);
    assert.equal(f.controller.getSnapshot().invalidated, true); assert.deepEqual([...f.controller.getSnapshot().hiddenIds], []);
    f.setActive(true); f.setScope('server-a'); f.setGeneration(1); f.setPermission(true);
    assert.equal(f.controller.requestClear(), null); // an old controller never revives after ABA
  }
});
test('hidden load failure is explicit, retried with refresh and never presented as an empty known set', async () => {
  let attempts = 0;
  const f = fixture({ hidden: { load: async guard => { guard(); if (++attempts === 1) throw new Error('storage failure'); return new Set(['hidden']); } } });
  f.controller.start(); f.frame(); await tick(); assert.equal(f.controller.getSnapshot().hiddenState, 'error');
  await f.controller.reload(); assert.equal(f.controller.getSnapshot().hiddenState, 'ready');
  assert.deepEqual([...f.controller.getSnapshot().hiddenIds], ['hidden']); assert.ok(f.calls.includes('refresh'));
});
test('late hidden read and clear results cannot repopulate a disposed or invalidated controller', async () => {
  let finishLoad; const f = fixture({ hidden: { load: () => new Promise(resolve => { finishLoad = () => resolve(new Set(['old'])); }) } });
  f.controller.start(); f.frame(); await tick(); f.setScope('server-b'); finishLoad(); await tick();
  assert.equal(f.controller.getSnapshot().invalidated, true); assert.deepEqual([...f.controller.getSnapshot().hiddenIds], []);
  f.controller.dispose();
});

test('invalidation before start and after restart cannot revive an old scope', () => {
  const f = fixture(); f.controller.invalidate(); f.controller.start();
  assert.equal(f.controller.getSnapshot().invalidated, true); assert.equal(f.listeners.size, 0); assert.deepEqual(f.calls, []);
});

test('session invalidation triggered by a store event clears visible content immediately', async () => {
  const f = fixture(); f.controller.start(); f.frame(); await tick(); f.setActive(false); f.setItems([{ id: 'stale' }]);
  assert.equal(f.controller.getSnapshot().invalidated, true); assert.deepEqual(f.controller.getSnapshot().activity.activityItems, []);
});
