const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');
function transpile(name, dependencies, timers) {
  const filename = path.resolve(__dirname, '../src', name), exports = {}, module = { exports };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', 'module', 'setTimeout', 'clearTimeout', code)(id => {
    assert.ok(Object.hasOwn(dependencies, id), `unexpected dependency: ${id}`); return dependencies[id];
  }, exports, module, timers.set, timers.clear);
  return module.exports;
}
function clock() {
  let now = 0, serial = 0; const pending = new Map();
  return { set(fn, ms) { const id = ++serial; pending.set(id, { fn, at: now + ms }); return id; }, clear(id) { pending.delete(id); },
    next() { return Math.min(...[...pending.values()].map(item => item.at - now)); },
    advance(ms) { const target = now + ms; while (true) { const item = [...pending].sort((a, b) => a[1].at - b[1].at)[0]; if (!item || item[1].at > target) break;
      now = item[1].at; pending.delete(item[0]); item[1].fn(); } now = target; } };
}
const tick = () => new Promise(setImmediate);
async function fixture(t) {
  const runner = hooks(), timers = clock(), reads = [], sockets = [], watchers = new Set(); let appState, valid = true, readOverride = null;
  const session = { baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'one' } };
  const boundary = { current: () => valid, subscribe: fn => { watchers.add(fn); return () => watchers.delete(fn); } };
  const role = { session, boundary, isCurrent: boundary.current, notice() {} };
  const models = { applySupplyTaskMessage(event, old) { if (event.bad) throw new TypeError('invalid source event'); return event.window ?? old; } };
  const source = (query = {}, patch = {}) => ({ kind: 'qolip', apparatus_id: query.apparatus || 'apparatus:default:first', limit: query.limit ?? 10,
    search: query.search ?? '', epoch: 'epoch', scope: 'scope', revision: 1, version: 'one', rows: [], apparatus: [], checked_count: 0, missing_count: 0, ...patch });
  const { SupplyTasksController } = transpile('shared/supplyTasks/SupplyTasksController.ts', {
    '../../auth': { activeSessionEpoch: () => 1, activeSessionToken: () => valid ? 'token' : null }, '../../sessionReadScope': { sessionReadScope: () => 'scope' },
    '../appRoutes': { appRoutes: { qolipTasks: 'tasks' }, canOpenRoute: () => valid }, '../camera/synchronousGuard': { isSynchronouslyTrue: fn => fn() === true },
    '../dartApparatus': { dartTrim: value => value.trim() },
  }, timers);
  const store = { read: async (_session, query, current, fresh) => { assert.equal(current(), true); reads.push({ query, fresh }); return readOverride ? readOverride(query) : source(query); },
    remember() {}, invalidate() {} };
  const hook = transpile('qolip/useQolipTasks.ts', {
    react: runner.react, 'react-native': { AppState: { currentState: 'active', addEventListener: (_name, fn) => { appState = fn; return { remove() {} }; } } },
    'expo-router': { useFocusEffect: callback => runner.react.useEffect(callback, [callback]) },
    '../shared/adminSequenceApparatusStore': { adminSequenceApparatusStore: { cachedApparatusId: '', loadSavedApparatusId: async () => '' } },
    '../shared/supplyTasks/SupplyTasksController': { SupplyTasksController }, '../shared/supplyTasks/supplyTaskModels': models,
    '../qolipOrderProductsApi': { qolipOrderProducts: async () => ({}) }, '../shared/qolipDataRevision': { qolipDataRevision: { notifyLocationsChanged() {} } },
    './useQolipCatalogEditors': { useQolipCatalogEditors: () => ({ openSpec: async () => null }) }, './QolipRoleContext': { useQolipRole: () => role },
    './useQolipText': { useQolipText: () => ({ text: key => key }) }, './qolipTasksWarmStore': { qolipTasksWarmStore: store },
    './qolipTasksLive': { subscribeQolipTasksLive: (_session, baseline, current, message, error, done) => {
      const socket = { baseline, current, message, error, done, stopped: false }; sockets.push(socket); return () => { socket.stopped = true; };
    } },
  }, timers);
  let model;
  const render = () => { runner.begin(); model = hook.useQolipTasks(); runner.flush(); return model; };
  const settle = async () => { await tick(); render(); await tick(); render(); return model; };
  render(); await settle();
  t.after(() => runner.dispose());
  return { reads, sockets, timers, source, render, settle, get model() { return model; }, app: state => { appState(state); render(); },
    read: fn => { readOverride = fn; }, expire() { valid = false; for (const fn of watchers) fn(); render(); } };
}
test('compact Tasks first-message deadline reconnects with source backoff and never HTTP polls', async t => {
  const h = await fixture(t); assert.equal(h.reads.length, 1); assert.equal(h.sockets.length, 1);
  h.timers.advance(9999); assert.equal(h.sockets.length, 1); h.timers.advance(1); assert.equal(h.sockets[0].stopped, true); assert.equal(h.timers.next(), 1000);
  h.timers.advance(1000); assert.equal(h.sockets.length, 2); assert.equal(h.reads.length, 1);
  h.sockets[1].done(); assert.equal(h.timers.next(), 2000); h.timers.advance(2000); assert.equal(h.sockets.length, 3);
  h.sockets[2].message({ type: 'ready' }); h.sockets[2].done(); assert.equal(h.timers.next(), 1000); assert.equal(h.reads.length, 1);
});
test('a valid source event resets retry delay but pause/resume preserves failure history', async t => {
  const h = await fixture(t); h.sockets[0].done(); h.timers.advance(1000); h.sockets[1].done(); assert.equal(h.timers.next(), 2000);
  h.app('background'); assert.equal(h.timers.next(), Infinity); h.app('active'); const next = h.sockets.at(-1); next.done(); assert.equal(h.timers.next(), 4000);
  h.timers.advance(4000); h.sockets.at(-1).message({ type: 'ready' }); assert.equal(h.timers.next(), Infinity);
});
test('one source repair per query survives pause/resume and manual retry until an advancing event', async t => {
  const h = await fixture(t); h.sockets[0].error(new TypeError('broken')); await h.settle(); assert.equal(h.reads.length, 2);
  h.app('background'); h.app('active'); h.sockets.at(-1).error(new TypeError('broken again')); h.render(); assert.equal(h.reads.length, 2); assert.ok(h.model.state.error);
  await h.model.refresh(); await h.settle(); assert.equal(h.reads.length, 3);
  h.sockets.at(-1).error(new TypeError('still broken')); h.render(); assert.equal(h.reads.length, 3); assert.ok(h.model.state.error);
  await h.model.refresh(); await h.settle(); h.sockets.at(-1).message({ type: 'snapshot', window: h.source({}, { revision: 2, version: 'two' }) }); h.render();
  h.sockets.at(-1).error(new TypeError('after actual progress')); await h.settle(); assert.equal(h.reads.length, 5);
});
test('failed HTTP repair leaves the retry state without reconnecting against stale rows', async t => {
  const h = await fixture(t); h.read(async () => { throw new Error('offline'); }); h.sockets[0].error(new TypeError('repair'));
  await h.settle(); assert.equal(h.reads.length, 2); assert.equal(h.sockets.length, 1); assert.ok(h.model.state.error); assert.equal(h.timers.next(), Infinity);
});
test('manual refresh detaches before awaiting HTTP and original callbacks cannot publish during or after expiry', async t => {
  const h = await fixture(t); let finish; h.read(() => new Promise(resolve => { finish = resolve; })); const old = h.sockets[0], refresh = h.model.refresh();
  assert.equal(old.stopped, true); old.message({ type: 'snapshot', window: h.source({}, { revision: 99 }) }); assert.equal(h.model.controller.getSnapshot().window.revision, 1);
  h.render(); await tick(); h.expire(); finish(h.source({}, { revision: 2 })); await refresh; await h.settle();
  assert.equal(h.model.state.window, null); h.timers.advance(60000); assert.equal(h.sockets.length, 1);
});
