const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadContract } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return mod.exports;
}
function loadTree(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? loadTree(id.slice(2), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const legacy = loadTree('workerLegacyState', { './authorizedFetch': {} });
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const models = load('workerQueueModels', { './workerControlsApi': controls });
const decisions = load('productionCompletionApi', { './workerControlsApi': controls, './workerQueueModels': models, './authorizedFetch': {} });
const decoder = load('workerSnapshot', { './workerControlsApi': controls, './workerQueueModels': models, './productionCompletionApi': decisions });
const delta = load('workerDelta', { './workerSnapshot': decoder });
const auth = { activeSessionToken: s => s.active === false ? null : s.token };
const limits = { DEFAULT_QUEUE_LIMIT: 10, loadQueueLimit: async () => 10 };
const window = load('workerQueueWindow');
const api = load('workerApi', { './auth': auth, './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'), './workerQueueLimit': limits,
  './workerSnapshot': decoder, './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': {}, './productionMapQueueSnapshotApi': {}, './workerQueueReadApi': {}, './workerQueueReadError': {} });
const defaultSnapshots = { generation: 0, read: async () => null, writeEncoded: async () => {}, remove: async () => {} };
const cacheModule = load('workerQueueCache', { './auth': auth, './sessionReadScope': scope, './workerApi': api, './workerSnapshot': decoder,
  './workerControlsApi': controls, './workerLegacyState': legacy, './workerQueueWindow': window, './shared/productionSnapshotRuntime': { productionSnapshotStore: defaultSnapshots } });
const warmModule = load('workerQueueWarmStore', { './auth': auth, './workerApi': api, './sessionReadScope': scope, './workerLive': {}, './workerQueueLimit': limits,
  './workerQueueWindow': window, './workerDelta': delta, './workerSnapshot': decoder, './workerQueueCache': cacheModule });
const station = 'apparatus:default:bosma_7';
const session = () => ({ token: 'worker', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'a' }, capabilities: ['apparatus.queue.read'],
  assigned_apparatus: [station], assigned_apparatus_labels: ['Bosma'] });
function queue(rev = 7) {
  const record = loadContract('worker_list_api_test').find(item => item.test.startsWith('worker HTTP and v2 socket'));
  const snapshot = decoder.decodeWorkerListSnapshot({ ...JSON.parse(record.responseBody.text), rev });
  const catalog = [{ id: station, name: 'Bosma', operation: 'print' }];
  return api.queueFromSnapshot(catalog, snapshot, [station], ['Bosma'], catalog);
}
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function clock() {
  const oldSet = global.setTimeout, oldClear = global.clearTimeout;
  let time = 0, serial = 0; const timers = new Map();
  global.setTimeout = (fn, ms = 0) => { const id = ++serial; timers.set(id, { fn, at: time + ms }); return id; };
  global.clearTimeout = id => timers.delete(id);
  return { advance(ms) { const end = time + ms; while (true) { const next = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); time = next[1].at; next[1].fn(); } time = end; }, restore() { global.setTimeout = oldSet; global.clearTimeout = oldClear; } };
}
function warm(options = {}) {
  const sockets = [], reads = [], saves = [], forgotten = [];
  const s = session();
  const store = new warmModule.WorkerQueueWarmStore({ current: x => x.active !== false,
    loader: async (_s, search, limit) => { reads.push([limit, search]); return queue(); },
    live: (_s, search, invalidate, _connection, snapshot, apply, limit, hooks) => {
      const socket = { search, limit, invalidate, snapshot, apply, hooks, stopped: false }; sockets.push(socket); return () => { socket.stopped = true; };
    }, save: async (...args) => { saves.push(args); }, forget: async (...args) => { forgotten.push(args); }, reconnectDelay: () => 10, ...options });
  return { s, store, sockets, reads, saves, forgotten };
}

// @v2-test test/worker_queue_warm_store_test.dart
// @v2-test test/worker_queue_warm_page_test.dart
test('claim synchronously stops warming and joins its unfinished baseline read', async () => {
  const pending = deferred(); let reads = 0;
  const x = warm({ loader: async () => { reads++; return pending.promise; } });
  const starting = x.store.start(x.s); await flush();
  const claim = x.store.claim(x.s, 10); assert.equal(claim.ready, null); assert.equal(x.sockets.length, 0);
  pending.resolve(queue()); await starting;
  assert.equal((await claim.pending).snapshot.rev, 7); assert.equal(reads, 1); assert.equal(x.sockets.length, 0);
  x.store.release(claim.lease, queue(42)); assert.equal(x.sockets.length, 1); assert.equal(x.sockets[0].snapshot().rev, 42);
  x.store.reset();
});
test('a prepared claim is synchronous, exact-window only, and never opens a duplicate background socket', async () => {
  const x = warm(); await x.store.start(x.s);
  assert.equal(x.store.peek(x.s, 5), null); assert.equal(x.store.peek(x.s, 10, 'other'), null);
  const claim = x.store.claim(x.s, 10); assert.ok(claim.ready); assert.equal(x.sockets[0].stopped, true);
  await x.store.start(x.s); assert.equal(x.reads.length, 1); assert.equal(x.sockets.length, 1);
  assert.equal(await claim.pending, claim.ready); x.store.reset();
});
test('direct page ownership before runtime preparation reserves the only live owner', async () => {
  const x = warm(); const claim = x.store.claim(x.s, 10); await x.store.start(x.s);
  assert.equal(await claim.pending, null); assert.equal(x.reads.length, 0); assert.equal(x.sockets.length, 0);
  x.store.release(claim.lease, queue()); assert.equal(x.sockets.length, 1); assert.equal(x.reads.length, 0); x.store.reset();
});
test('old page leases cannot overwrite a newer same-account claim', async () => {
  const x = warm(); await x.store.start(x.s); const old = x.store.claim(x.s, 10);
  x.store.reset(); await x.store.start(x.s); const current = x.store.claim(x.s, 10);
  x.store.release(old.lease, queue(99)); assert.equal(x.store.pageLease, current.lease); assert.equal(x.store.peek(x.s, 10).snapshot.rev, 7);
  x.store.reset();
});
test('late reads from a previous account or assignment scope cannot repopulate warm rows', async () => {
  const pending = deferred(); const x = warm({ loader: () => pending.promise });
  const start = x.store.start(x.s); await flush(); x.s.assigned_apparatus = [];
  pending.resolve(queue()); await start; assert.equal(x.store.peek(x.s, 10), null); assert.equal(x.sockets.length, 0); x.store.reset();
});
test('a null page release discards the old baseline and loads the new exact window', async () => {
  const x = warm(); await x.store.start(x.s); const claim = x.store.claim(x.s, 20, ' older ');
  assert.equal(await claim.pending, null); x.store.release(claim.lease, null); await flush();
  assert.deepEqual(x.reads, [[10, ''], [20, '']]); assert.equal(x.store.peek(x.s, 10), null); assert.ok(x.store.peek(x.s, 20, '')); assert.equal(x.store.peek(x.s, 20, 'older'), null); x.store.reset();
});
test('pause and resume reconnect the current cursor without downloading the queue', async () => {
  const x = warm(); await x.store.start(x.s); x.store.pause(); assert.equal(x.sockets[0].stopped, true);
  x.store.resume(); assert.equal(x.sockets.length, 2); assert.equal(x.reads.length, 1); assert.equal(x.sockets[1].snapshot().rev, 7); x.store.reset();
});
test('successive live snapshots preserve the latest compact state without HTTP reads', async () => {
  const x = warm(); await x.store.start(x.s);
  for (let rev = 8; rev <= 1007; rev++) x.sockets[0].apply({ ...queue().snapshot, rev });
  assert.equal(x.store.peek(x.s, 10).snapshot.rev, 1007); assert.equal(x.reads.length, 1); assert.equal(x.saves.length, 1000); x.store.reset();
});
test('repeated resync has one HTTP repair until a healthy cursor replenishes its budget', async () => {
  const c = clock(), x = warm();
  try {
    await x.store.start(x.s); x.sockets[0].invalidate(); await flush(); assert.equal(x.reads.length, 2);
    x.sockets.at(-1).invalidate(); c.advance(10); await flush(); x.sockets.at(-1).invalidate(); c.advance(10); await flush();
    assert.equal(x.reads.length, 2);
    const current = x.sockets.at(-1); const cursor = current.snapshot(); current.hooks.onReady({ ...cursor, resync: false }); current.invalidate(); await flush();
    assert.equal(x.reads.length, 3);
  } finally { x.store.reset(); c.restore(); }
});
test('permission loss removes rows and prevents background reconnect until a new session scope', async () => {
  const x = warm(); await x.store.start(x.s); x.sockets[0].hooks.onError({ statusCode: 403, code: 'forbidden' });
  assert.equal(x.store.peek(x.s, 10), null); x.store.resume(); assert.equal(x.sockets.length, 1); assert.equal(x.forgotten.length, 1); x.store.reset();
});
test('bounded preparation ignores a late result after its timeout', async () => {
  const c = clock(), pending = deferred(), x = warm({ loader: () => pending.promise });
  try { const start = x.store.start(x.s); await flush(); c.advance(10000); await start; pending.resolve(queue()); await flush();
    assert.equal(x.store.peek(x.s, 10), null); assert.equal(x.sockets.length, 0);
  } finally { x.store.reset(); c.restore(); }
});

function cache(options = {}) {
  const records = new Map(), writes = [], removed = [], s = session();
  const snapshots = { generation: 0, read: async (scope, key) => records.get(JSON.stringify([scope, key])) ?? null,
    writeEncoded: async (scope, key, value, generation) => { writes.push({ scope, key, value: JSON.parse(value), generation }); },
    remove: async (scope, key) => { removed.push([scope, key]); } };
  const instance = new cacheModule.WorkerQueueCache({ snapshots, current: session => session.active !== false, ...options });
  const record = (value = queue()) => records.set(JSON.stringify([scope.sessionReadScope(s), cacheModule.workerQueueCacheKey(10, '')]),
    { schema: 1, snapshot: value.snapshot, apparatus: value.catalog });
  return { s, instance, snapshots, record, records, writes, removed };
}
// @v2-test test/production_snapshot_store_test.dart
// @v2-test test/worker_queue_warm_page_test.dart
test('disk cache reconstructs rows and status from the compact snapshot with current assignments only', async () => {
  const x = cache(); x.record(); const result = await x.instance.restore(x.s, 10, '');
  assert.equal(result.orders[station][0].state, queue().orders[station][0].state); assert.equal(result.snapshot.queue_action_controls, undefined);
  assert.equal(await x.instance.restore(x.s, 20, ''), null); assert.equal(await x.instance.restore({ ...x.s, profile: { ...x.s.profile, ref: 'other' } }, 10, ''), null);
});
test('malformed compact authority and catalog identity produce a safe cache miss and removal', async () => {
  const x = cache(); const invalid = queue(); invalid.snapshot.queue_action_controls = {}; x.record(invalid);
  assert.equal(await x.instance.restore(x.s, 10, ''), null); assert.equal(x.removed.length, 1);
  x.record({ ...queue(), catalog: [{ id: 'not-canonical', name: 'Wrong', operation: 'print' }] });
  assert.equal(await x.instance.restore(x.s, 10, ''), null); assert.equal(x.removed.length, 2);
});
test('slow disk returns within 500ms and cannot later become a restored baseline', async () => {
  const c = clock(), pending = deferred(), x = cache(); x.snapshots.read = () => pending.promise;
  try { const restoring = x.instance.restore(x.s, 10, ''); c.advance(500); assert.equal(await restoring, null);
    pending.resolve({ schema: 1, snapshot: queue().snapshot, apparatus: queue().catalog }); await flush(); assert.equal(x.writes.length, 0);
  } finally { x.instance.reset(); c.restore(); }
});
test('save debounce captures immutable canonical bytes and fences disk generation', async () => {
  const c = clock(), x = cache(), baseline = queue();
  try { const saving = x.instance.save(x.s, 10, '', baseline); baseline.snapshot.worker_list_rows['work-1'].title = 'later UI change';
    c.advance(399); assert.equal(x.writes.length, 0); c.advance(1); await saving;
    assert.equal(x.writes.length, 1); assert.notEqual(x.writes[0].value.snapshot.worker_list_rows['work-1'].title, 'later UI change'); assert.equal(x.writes[0].generation, 0);
    const stale = x.instance.save(x.s, 10, '', queue(8)); x.snapshots.generation++; c.advance(400); await stale; assert.equal(x.writes.length, 1);
  } finally { x.instance.reset(); c.restore(); }
});
test('a newer canonical save invalidates an unfinished old disk restore', async () => {
  const c = clock(), pending = deferred(), x = cache(); x.snapshots.read = () => pending.promise;
  try { const restoring = x.instance.restore(x.s, 10, ''); const saving = x.instance.save(x.s, 10, '', queue(9));
    pending.resolve({ schema: 1, snapshot: queue(7).snapshot, apparatus: queue().catalog }); assert.equal(await restoring, null);
    c.advance(400); await saving; assert.equal(x.writes[0].value.snapshot.rev, 9);
  } finally { x.instance.reset(); c.restore(); }
});
test('account reset cancels debounced saves and pending restore results', async () => {
  const c = clock(), pending = deferred(), x = cache(); x.snapshots.read = () => pending.promise;
  try { const restoring = x.instance.restore(x.s, 10, ''), saving = x.instance.save(x.s, 10, '', queue()); x.instance.reset();
    pending.resolve({ schema: 1, snapshot: queue().snapshot, apparatus: queue().catalog }); c.advance(400);
    await saving; assert.equal(await restoring, null); assert.equal(x.writes.length, 0);
  } finally { x.instance.reset(); c.restore(); }
});
test('retiring authority cancels an unfinished save without deleting the last good disk record', async () => {
  const c = clock(), x = cache(); x.record();
  try {
    const saving = x.instance.save(x.s, 10, '', queue(9)); x.instance.cancelPending(x.s, 10, '');
    c.advance(400); await saving; assert.equal(x.writes.length, 0); assert.equal(x.removed.length, 0);
    assert.equal((await x.instance.restore(x.s, 10, '')).snapshot.rev, 7);
  } finally { x.instance.reset(); c.restore(); }
});
test('a page-exit flush promotes only the captured canonical save and keeps its generation fence', async () => {
  const c = clock(), x = cache();
  try {
    const saving = x.instance.save(x.s, 10, '', queue(9));
    await x.instance.flush(x.s, 10, ''); await saving;
    assert.equal(x.writes.length, 1); assert.equal(x.writes[0].value.snapshot.rev, 9);
    c.advance(400); assert.equal(x.writes.length, 1);
    const stale = x.instance.save(x.s, 10, '', queue(10)); x.snapshots.generation++;
    await x.instance.flush(x.s, 10, ''); await stale; assert.equal(x.writes.length, 1);
  } finally { x.instance.reset(); c.restore(); }
});
test('validated scoped v1 fallback snapshots survive cache without pretending to be compact rows', async () => {
  const record = loadContract('order_scan_bootstrap_api_test').find(value => value.test === 'bootstrap decodes context and QR proof in one authorized request');
  const raw = JSON.parse(record.responseBody.text).queue_context;
  const snapshot = legacy.decodeWorkerLegacySnapshot(raw, session());
  const x = cache();
  const key = JSON.stringify([scope.sessionReadScope(x.s), cacheModule.workerQueueCacheKey(10, '')]);
  x.records.set(key, { schema: 1, snapshot, apparatus: queue().catalog });
  const restored = await x.instance.restore(x.s, 10, '');
  assert.ok(restored); assert.notEqual(restored.snapshot.projection, 'worker_list_v1');
  assert.equal(restored.snapshot.maps[0].map.id, 'zakaz-scan-bootstrap');
  assert.equal(restored.snapshot.worker_list_rows, undefined);
  x.records.set(key, { schema: 1, snapshot: { ...snapshot, scope: '' }, apparatus: queue().catalog });
  assert.equal(await x.instance.restore(x.s, 10, ''), null, 'unscoped legacy data cannot be a reusable worker baseline');
});

test('runtime observes session scope and true background visits while retaining inactive dialogs', () => {
  let current = session(), transitioning = false, lifecycle, witness, reset; const calls = [];
  const runtime = load('workerQueueRuntime', {
    react: { useEffect: fn => fn() },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, listener) => { lifecycle = listener; } } },
    './auth': { ...auth, currentSession: () => current, sessionWitnessTransitioning: () => transitioning,
      subscribeSessionWitness: listener => { witness = listener; }, registerSessionResetHook: listener => { reset = listener; } },
    './workerQueueWarmStore': { workerQueueWarmStore: { start: session => { calls.push(['start', scope.sessionReadScope(session)]); return Promise.resolve(); }, pause: () => calls.push(['pause']), reset: () => calls.push(['reset']) } },
    './workerQueueCache': { workerQueueCache: { reset: () => calls.push(['cache-reset']) } },
  });
  runtime.useWorkerQueueRuntime(current); assert.equal(calls.at(-1)[0], 'start');
  lifecycle('inactive'); assert.equal(calls.length, 1); lifecycle('background'); assert.equal(calls.at(-1)[0], 'pause');
  lifecycle('active'); assert.equal(calls.at(-1)[0], 'start');
  const previous = calls.at(-1)[1]; current.assigned_apparatus = []; witness(); assert.notEqual(calls.at(-1)[1], previous);
  transitioning = true; witness(); assert.equal(calls.at(-1)[0], 'pause');
  current = null; transitioning = false; witness(); assert.equal(calls.at(-1)[0], 'cache-reset'); reset();
});
