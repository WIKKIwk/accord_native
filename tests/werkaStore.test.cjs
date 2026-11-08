const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name === '../auth' ? { currentSession: () => null }
    : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const { WerkaStore } = load(path.resolve(__dirname, '../src/werka/werkaStore.ts'));
const makeStore = (api, active) => new WerkaStore(api, active, () => true);
const session = ref => ({ baseUrl: 'https://example.invalid', token: `fake-${ref}`, profile: { role: 'werka', ref },
  capabilities: ['werka.access'], assigned_apparatus: [], assigned_item_groups: [], assigned_warehouses: [] });
const record = (id, supplier = 's') => ({ id, record_type: '', supplier_ref: supplier, supplier_name: supplier, item_code: '', item_name: '',
  uom: 'kg', sent_qty: 1, accepted_qty: 0, amount: 0, currency: '', note: '', event_type: '', highlight: '', status: 'pending', created_label: '' });
const home = (id, pendingCount = 1) => ({ summary: { pendingCount, confirmedCount: 2, returnedCount: 3 }, pendingItems: [record(id)] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const baseApi = overrides => ({ home: async () => home('home'), pending: async () => [record('pending')], history: async () => [],
  breakdown: async () => [], details: async () => [], ...overrides });

test('bootstrap, full pending projections and refresh preserve V2 loaded-state behavior', async () => {
  let homes = 0; const store = makeStore(baseApi({ home: async () => { homes++; return home('home'); } }), session('A'));
  await store.bootstrapHome(); await store.bootstrapHome(); assert.equal(homes, 1);
  assert.equal(store.getSnapshot().loadedHome, true); assert.equal(store.getPendingItems()[0].id, 'home');
  await store.bootstrapPending(); assert.equal(store.getSummary().pendingCount, 1);
  assert.equal(store.getBreakdownItems('pending')[0].supplierRef, 's'); assert.equal(store.getDetailItems('pending', ' s ')[0].id, 'pending');
  await store.bootstrapHome(true); assert.equal(homes, 2);
});
test('home refresh notifies at load start and once after data and loading settle', async () => {
  const store = makeStore(baseApi(), session('A')), snapshots = [];
  store.subscribe(() => snapshots.push({ loading: store.getSnapshot().loadingHome, loaded: store.getSnapshot().loadedHome }));
  await store.refreshHome();
  assert.deepEqual(snapshots, [{ loading: true, loaded: false }, { loading: false, loaded: true }]);
});
test('old account home response cannot replace the new account or its loading state', async () => {
  const a = deferred(), b = deferred();
  const store = makeStore(baseApi({ home: current => current.profile.ref === 'A' ? a.promise : b.promise }), session('A'));
  const old = store.refreshHome(); assert.equal(store.getSnapshot().loadingHome, true);
  store.setSession(session('B')); const next = store.refreshHome();
  a.resolve(home('old-private')); await old;
  assert.equal(store.getSnapshot().loadingHome, true); assert.deepEqual(store.getSnapshot().pendingItems, []);
  b.resolve(home('new-only', 4)); await next;
  assert.equal(store.getSnapshot().loadingHome, false); assert.equal(store.getPendingItems()[0].id, 'new-only');
  assert.equal(store.getSummary().pendingCount, 4);
});
test('late errors and results for pending, breakdown and detail are ignored after switch', async () => {
  const pending = deferred(), breakdown = deferred(), detail = deferred();
  const store = makeStore(baseApi({ pending: () => pending.promise, breakdown: () => breakdown.promise, details: () => detail.promise }), session('A'));
  const tasks = [store.refreshPending(), store.refreshBreakdown('confirmed'), store.refreshDetail('returned', 's')];
  store.setSession(session('B'));
  pending.reject(new Error('old')); breakdown.resolve([{ supplierRef: 'old' }]); detail.resolve([record('old')]);
  await Promise.all(tasks);
  assert.equal(store.getSnapshot().pendingError, null); assert.equal(store.getSnapshot().loadingPending, false);
  assert.deepEqual(store.getBreakdownItems('confirmed'), []); assert.deepEqual(store.getDetailItems('returned', 's'), []);
});
test('bootstrap and write-result generations cannot cross accounts', async () => {
  const write = deferred(), store = makeStore(baseApi({ home: async () => home('B') }), session('A'));
  const oldGeneration = store.captureGeneration(), submitted = write.promise.then(result => store.recordCreatedPending(result, oldGeneration));
  store.setSession(session('B'));
  await store.bootstrapHome(false, { generation: oldGeneration, value: home('A-bootstrap') });
  write.resolve(record('A-write')); assert.equal(await submitted, false);
  assert.deepEqual(store.getPendingItems().map(item => item.id), ['B']);
  assert.equal(store.setHomePendingListExpanded(false, oldGeneration), false);
  assert.equal(store.setHomePendingListExpanded(false, store.captureGeneration()), true);
  store.setSession(session('C')); assert.equal(store.getSnapshot().homePendingListExpanded, false);
});
test('a current-account mutation updates the isolated runtime and is cleared on account switch', async () => {
  const store = makeStore(baseApi(), session('A'));
  await store.bootstrapHome(); const generation = store.captureGeneration();
  assert.equal(store.recordCreatedPending(record('created'), generation), true);
  assert.equal(store.getSummary().pendingCount, 2); assert.deepEqual(new Set(store.getPendingItems().map(item => item.id)), new Set(['home', 'created']));
  store.setSession(session('B'));
  assert.equal(store.getSummary().pendingCount, 0); assert.deepEqual(store.getPendingItems(), []);
});
test('same-scope token refresh keeps data, and dispose ignores in-flight completion', async () => {
  const pending = deferred(), a = session('A'), store = makeStore(baseApi({ pending: () => pending.promise }), a);
  await store.bootstrapHome(); const generation = store.captureGeneration();
  a.token = 'new-fake-token'; store.setSession(a);
  assert.equal(store.captureGeneration(), generation); assert.equal(store.getPendingItems()[0].id, 'home');
  const read = store.refreshPending(); store.dispose(); pending.resolve([record('late')]); await read;
  assert.deepEqual(store.getSnapshot().fullPendingItems, []); assert.equal(store.recordCreatedPending(record('late'), generation), false);
});
test('a replacement login for the same account still invalidates old in-flight work', async () => {
  const read = deferred(), a = session('A'), store = makeStore(baseApi({ home: () => read.promise }), a);
  const old = store.refreshHome(), generation = store.captureGeneration();
  store.setSession(session('A'));
  assert.notEqual(store.captureGeneration(), generation);
  read.resolve(home('old-login')); await old;
  assert.deepEqual(store.getSnapshot().pendingItems, []); assert.equal(store.getSnapshot().loadingHome, false);
});
test('an in-place read-scope change rejects a late result even before an explicit refresh', async () => {
  const read = deferred(), a = session('A'), store = makeStore(baseApi({ home: () => read.promise }), a);
  const old = store.refreshHome(), generation = store.captureGeneration();
  a.assigned_warehouses = ['new-warehouse'];
  read.resolve(home('old-scope')); await old;
  assert.notEqual(store.captureGeneration(), generation);
  assert.deepEqual(store.getSnapshot().pendingItems, []); assert.equal(store.getSnapshot().loadingHome, false);
});
test('active session check hides old data before the UI lifecycle installs the new session', async () => {
  const a = session('A'), b = session('B'), late = deferred(); let active = a, aReads = 0, historyCalls = 0;
  const api = baseApi({ home: current => current === a && ++aReads === 2 ? late.promise : Promise.resolve(home(current.profile.ref)),
    history: async () => { historyCalls++; return []; } });
  const store = new WerkaStore(api, a, candidate => candidate === active);
  await store.bootstrapHome(); assert.equal(store.getPendingItems()[0].id, 'A');
  const old = store.refreshHome(); active = b;
  assert.deepEqual(store.getSnapshot().pendingItems, []); assert.deepEqual(store.getPendingItems(), []);
  await store.refreshHistory(); assert.equal(historyCalls, 0);
  late.resolve(home('late-A')); await old;
  assert.deepEqual(store.getSnapshot().pendingItems, []);
  store.setSession(b); await store.bootstrapHome(); assert.equal(store.getPendingItems()[0].id, 'B');
});
