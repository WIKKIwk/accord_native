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
const scope = load('sessionReadScope');
const api = load('workerApi', { './auth': {}, './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'),
  './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerSnapshot': {}, './workerDetailApi': {}, './sessionReadScope': scope,
  './apparatusApi': {}, './workerQueueReadApi': {}, './workerQueueReadError': {} });
const { WorkerQueueController } = load('workerQueueController', { './workerApi': api, './sessionReadScope': scope });
const station = 'apparatus:default:bosma_7';
const session = () => ({ token: 'worker', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'a' }, capabilities: ['apparatus.queue.read'], assigned_apparatus: [station], assigned_apparatus_labels: ['Bosma'] });
function queue(rev = 7) {
  const raw = loadContract('worker_list_api_test').find(x => x.test.startsWith('worker HTTP and v2 socket'));
  const snapshot = { ...JSON.parse(raw.responseBody.text), rev };
  const catalog = [{ id: station, name: 'Bosma', operation: 'print' }];
  return api.queueFromSnapshot(catalog, snapshot, [station], ['Bosma'], catalog);
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function clock() {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout;
  let now = 0, id = 0; const timers = new Map();
  global.setTimeout = (fn, ms = 0) => { const key = ++id; timers.set(key, { fn, at: now + ms }); return key; };
  global.clearTimeout = key => timers.delete(key);
  return { advance(ms) { const end = now + ms; while (true) { const next = [...timers].filter(([, value]) => value.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; next[1].fn(); } now = end; }, restore() { global.setTimeout = originalSet; global.clearTimeout = originalClear; } };
}
function setup(overrides = {}, display = null, search = '', limit = 10) {
  const s = session(), sockets = [], reads = [], persisted = [], released = [], errors = [];
  let current = true;
  const dependencies = {
    current: () => current,
    initial: async () => { reads.push('initial'); return queue(); },
    snapshot: async (since, fresh) => { reads.push(['snapshot', since, fresh]); return queue(8).snapshot; },
    catalog: async () => { reads.push('catalog'); return queue().catalog; },
    live: (get, callbacks) => { const socket = { get, callbacks, stopped: false }; sockets.push(socket); return () => { socket.stopped = true; }; },
    claim: () => ({ lease: 1, ready: null, pending: Promise.resolve(null) }),
    release: (lease, value) => released.push({ lease, value }),
    restore: async () => null,
    persist: async value => { persisted.push(value); }, cancelPersist() {},
    forget: async () => { errors.push('forgotten'); },
    refreshAssignments: async () => { reads.push('profile'); },
    retryable: error => ![401, 403].includes(error?.statusCode) && error?.code !== 'production_map_snapshot_contract_invalid',
    ...overrides,
  };
  const controller = new WorkerQueueController(s, search, limit, dependencies, display);
  return { s, controller, sockets, reads, persisted, released, errors, dependencies, deactivate: () => { current = false; } };
}

// @v2-test test/admin_worker_list_loading_test.dart
// @v2-test test/worker_queue_warm_page_test.dart
test('a failed cold HTTP bootstrap still starts live recovery without periodic queue polling', async () => {
  const c = clock(); let initial = 0;
  const x = setup({ initial: async () => { initial++; throw new Error('Network request failed'); } });
  try {
    await x.controller.start(); assert.equal(initial, 1); assert.equal(x.sockets.length, 1); assert.equal(x.controller.getSnapshot().synchronized, false);
    c.advance(60000); await flush(); assert.equal(initial, 1, 'recovery timers reconnect sockets rather than poll HTTP');
  } finally { x.controller.dispose(); c.restore(); }
});
test('a failed new filter window retains previous display statuses and retires only write authority', async () => {
  const old = queue(); const c = clock();
  const x = setup({ initial: async () => { throw new Error('Temporary failure'); } }, old, 'older', 20);
  try {
    await x.controller.start(); const state = x.controller.getSnapshot();
    assert.equal(state.queue, old); assert.equal(state.queue.orders[station][0].state, old.orders[station][0].state);
    assert.equal(state.loadedWindow, null); assert.equal(state.synchronized, false); assert.equal(x.sockets.length, 1);
  } finally { x.controller.dispose(); c.restore(); }
});
test('ready disk rows bypass an unfinished warm read and are validated by a matching recovered cursor', async () => {
  const warm = deferred(); let initial = 0;
  const x = setup({ claim: () => ({ lease: 4, ready: null, pending: warm.promise }), restore: async () => queue(), initial: async () => { initial++; return queue(); } });
  await x.controller.start(); assert.equal(initial, 0); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 7);
  assert.equal(x.controller.getSnapshot().synchronized, false); assert.equal(x.persisted.length, 0);
  x.sockets[0].callbacks.ready({ ...queue().snapshot, resync: false, recovered: true });
  assert.equal(x.controller.getSnapshot().synchronized, true); assert.equal(initial, 0); assert.equal(x.persisted.length, 1);
  warm.resolve(queue(3)); await flush(); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 7); x.controller.dispose();
});
test('a hung optional disk restore is bounded to 500ms before normal HTTP startup', async () => {
  const c = clock(), disk = deferred(), x = setup({ restore: () => disk.promise });
  try { const start = x.controller.start(); c.advance(499); await flush(); assert.equal(x.reads.length, 0);
    c.advance(1); await start; assert.equal(x.reads[0], 'initial'); assert.equal(x.sockets.length, 1);
    disk.resolve(queue(3)); await flush(); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 7);
  } finally { x.controller.dispose(); c.restore(); }
});
test('burst invalidations join one in-flight snapshot read and coalesce a subsequent repair', async () => {
  const pending = deferred(); let total = 0, active = 0, peak = 0;
  const x = setup({ snapshot: async () => { total++; peak = Math.max(peak, ++active); try { return total === 1 ? await pending.promise : queue(9).snapshot; } finally { active--; } } });
  await x.controller.start(); const socket = x.sockets[0];
  for (let i = 0; i < 8; i++) socket.callbacks.invalidate();
  assert.equal(total, 1); assert.equal(x.controller.getSnapshot().synchronized, false);
  pending.resolve(queue(8).snapshot); await flush(); assert.equal(peak, 1); assert.equal(total, 2); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 9); x.controller.dispose();
});
test('a newer live snapshot defeats a delayed older HTTP refresh', async () => {
  const pending = deferred(), x = setup({ snapshot: () => pending.promise });
  await x.controller.start(); const reload = x.controller.reload();
  x.sockets[0].callbacks.snapshot(queue(20).snapshot); pending.resolve(queue(8).snapshot); await reload;
  assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 20); assert.equal(x.controller.getSnapshot().synchronized, true); x.controller.dispose();
});
test('a rejected older live snapshot cannot invalidate a newer in-flight HTTP refresh', async () => {
  const pending = deferred(), x = setup({ snapshot: () => pending.promise });
  await x.controller.start(); const reload = x.controller.reload();
  x.sockets[0].callbacks.snapshot(queue(6).snapshot); pending.resolve(queue(9).snapshot); await reload;
  assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 9); x.controller.dispose();
});
test('transient refresh errors retain the last display state instead of replacing it with pending', async () => {
  const x = setup({ snapshot: async () => { throw new Error('Connection reset'); } });
  await x.controller.start(); const before = x.controller.getSnapshot().queue; await x.controller.reload();
  assert.equal(x.controller.getSnapshot().queue, before); assert.equal(x.controller.getSnapshot().queue.orders[station][0].state, before.orders[station][0].state);
  assert.equal(x.controller.getSnapshot().synchronized, false); x.controller.dispose();
});
test('live data and an independent catalog read can recover a failed bootstrap without another queue HTTP read', async () => {
  let initial = 0, catalogs = 0;
  const x = setup({ initial: async () => { initial++; throw new Error('Bootstrap catalog timed out'); }, catalog: async () => { catalogs++; return queue().catalog; } });
  await x.controller.start(); x.sockets[0].callbacks.snapshot(queue(12).snapshot); await flush();
  assert.equal(initial, 1, 'the valid live snapshot must not be discarded in favour of another aggregate read');
  assert.ok(catalogs >= 1); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 12); assert.equal(x.controller.getSnapshot().synchronized, true); x.controller.dispose();
});
test('independent catalog failure cannot discard an accepted queue snapshot', async () => {
  const prepared = { ...queue(), catalog: [] }, x = setup({ claim: () => ({ lease: 2, ready: prepared, pending: Promise.resolve(prepared) }), catalog: async () => { throw new Error('Catalog timeout'); } });
  await x.controller.start(); x.sockets[0].callbacks.ready({ ...prepared.snapshot, recovered: true, resync: false }); await flush();
  await x.controller.refreshAll();
  assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 8); assert.equal(x.controller.getSnapshot().synchronized, true); x.controller.dispose();
});
test('a queue refresh cannot overwrite catalog metadata that completed while that refresh was in flight', async () => {
  const catalog = deferred(), snapshot = deferred(), prepared = { ...queue(), catalog: [] };
  const x = setup({ claim: () => ({ lease: 2, ready: prepared, pending: Promise.resolve(prepared) }),
    catalog: () => catalog.promise, snapshot: () => snapshot.promise });
  await x.controller.start(); x.sockets[0].callbacks.ready({ ...prepared.snapshot, recovered: true, resync: false });
  const refreshing = x.controller.refreshAll();
  catalog.resolve([{ ...queue().catalog[0], name: 'Updated apparatus label' }]); await flush();
  assert.equal(x.controller.getSnapshot().queue.catalog[0].name, 'Updated apparatus label');
  snapshot.resolve(queue(8).snapshot); await refreshing;
  assert.equal(x.controller.getSnapshot().queue.catalog[0]?.name, 'Updated apparatus label');
  assert.equal(x.controller.getSnapshot().queue.machines[0].name, 'Updated apparatus label'); x.controller.dispose();
});
for (const statusCode of [401, 403]) test(`terminal ${statusCode} error stops retry and invalidates persisted authority`, async () => {
  const c = clock(); let reads = 0;
  const x = setup({ initial: async () => { reads++; throw Object.assign(new Error('denied'), { statusCode }); } });
  try { await x.controller.start(); c.advance(60000); await flush(); assert.equal(reads, 1); assert.equal(x.sockets.length, 0); assert.equal(x.errors.length, 1); assert.equal(x.controller.getSnapshot().synchronized, false);
  } finally { x.controller.dispose(); c.restore(); }
});
test('scope disposal rejects late HTTP rows and prevents stale cache persistence', async () => {
  const pending = deferred(), x = setup({ initial: () => pending.promise });
  const start = x.controller.start(); await flush(); x.deactivate(); x.controller.dispose(); pending.resolve(queue()); await start;
  assert.equal(x.controller.getSnapshot().queue, null); assert.equal(x.persisted.length, 0); assert.equal(x.released.at(-1).value, null); assert.equal(x.sockets.length, 0);
});
test('background resume tolerates profile failure and same-scope token refresh without losing rows', async () => {
  const x = setup({ refreshAssignments: async () => { throw new Error('Profile timeout'); } });
  await x.controller.start(); x.sockets[0].callbacks.ready({ ...queue().snapshot, recovered: true, resync: false });
  x.controller.pause(); assert.equal(x.sockets[0].stopped, true); x.s.token = 'refreshed-same-account';
  await x.controller.resume(); assert.equal(x.sockets.length, 2); assert.equal(x.reads.filter(x => x === 'initial').length, 1); assert.equal(x.controller.getSnapshot().queue.snapshot.rev, 7); assert.equal(x.controller.getSnapshot().synchronized, false);
  x.sockets[1].callbacks.ready({ ...queue().snapshot, recovered: true, resync: false }); assert.equal(x.controller.getSnapshot().synchronized, true); x.controller.dispose();
});
test('pending writes prevent a successful-looking row snapshot from being handed back as a safe baseline', async () => {
  const x = setup(); await x.controller.start(); x.controller.setWritePending(true); x.controller.dispose();
  assert.equal(x.released.at(-1).value, null);
});

function workerScreenHarness(platform, nativeNavigation = true) {
  const hooks = [], effects = [], opened = [], updates = [], actionOptions = [], presentations = [], historyOpened = [], routes = []; let cursor = 0, locale = 'uz', rowElements = 0;
  const preparation = { calls: [], feedback: 0, result: { kind: 'menu', menu: { kind: 'bosma', actions: ['astatka', 'finish'], operation: 'print' } }, pending: null, error: null, paddonOptions: [] };
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) { const id = cursor++; if (!hooks[id]) hooks[id] = { value: typeof initial === 'function' ? initial() : initial }; return [hooks[id].value, value => { hooks[id].value = typeof value === 'function' ? value(hooks[id].value) : value; }]; },
    useRef(initial) { const id = cursor++; if (!hooks[id]) hooks[id] = { current: initial }; return hooks[id]; },
    useCallback(fn, deps) { const id = cursor++; if (!hooks[id] || !equal(deps, hooks[id].deps)) hooks[id] = { deps, fn }; return hooks[id].fn; },
    useMemo(fn, deps) { const id = cursor++; if (!hooks[id] || !equal(deps, hooks[id].deps)) hooks[id] = { deps, value: fn() }; return hooks[id].value; },
    useEffect(fn, deps) { const id = cursor++; if (!hooks[id] || !equal(deps, hooks[id].deps)) { const previous = hooks[id]; hooks[id] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); hooks[id].cleanup = fn(); }); } },
  };
  react.useLayoutEffect = react.useEffect;
  const sheet = { close() {}, open(value, options) { opened.push(value); actionOptions.push(options); presentations.push({ value, options }); }, update(value) { updates.push(value); }, isOpen: () => false };
  const currentQueue = queue();
  currentQueue.orders[station][0].state = 'in_progress';
  currentQueue.snapshot.order_controls['work-1'] = { state: 'active' };
  const queueState = { queue: currentQueue, synchronized: false, loadedWindow: 'previous-query-window', loading: false,
    error: new Error('Connection reset'), reload: async () => {}, controller: { setWritePending() {} } };
  const jsx = (type, props, key) => {
    if (type === 'WorkerOrderListItem') rowElements++;
    if (type === 'WorkerWipHistorySheet' && props?.ref) props.ref.current = { open: (...args) => historyOpened.push(args) };
    return { type, props: props ?? {}, key };
  };
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Platform: { OS: platform }, View: 'View', Modal: 'Modal', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-font': { useFonts: () => [true] }, 'expo-router': { router: { push: route => routes.push(route) }, useFocusEffect: effect => { preparation.blur = effect(); } },
    'react-native-reanimated': { useSharedValue: () => ({ set() {} }) },
    './components/useWorkerQueue': { useWorkerQueue: () => queueState },
    './components/useWorkerSearchInput': { useWorkerSearchInput: () => {
      const [query, change] = react.useState('');
      return { query: query.trim(), input: { change, getDraftQuery: () => preparation.draftQuery ?? query.trim() } };
    } },
    './components/useWorkerPaddonNavigation': { useWorkerPaddonNavigation: (_visible, owner) => { preparation.paddonOwner = owner; return preparation.paddonOptions; } },
    './workerQueueReadError': { workerQueueReadCanRetry: () => true,
      workerQueueReadAuthorizationError: error => [401, 403].includes(error?.statusCode) || error?.code === 'permission_denied' },
    './workerApi': api,
    './workerLongPress': { runWorkerMenuAction: async (...args) => { preparation.menuActionCursors.push(args[5]()); } },
    './workerLongPressFeedback': { workerLongPressFeedback() { preparation.feedback++; } },
    './workerLongPressPreparation': { prepareWorkerLongPress: async (...args) => {
      preparation.calls.push(args);
      if (preparation.error) throw preparation.error;
      return preparation.pending ? preparation.pending.promise : preparation.result;
    } },
    './shared/mobileApiException': load('shared/mobileApiException'),
    './workerControlsApi': { WorkerControlException: class extends Error {} },
    './auth': { activeSessionToken: () => preparation.current === false ? null : 'token', captureSessionWitness: () => preparation.current === false ? null : ({}), isSessionWitnessCurrent: () => preparation.current !== false && preparation.witnessCurrent !== false },
    './nativeSheet': { useNativeSheet: () => sheet },
    './components/useWorkerColors': { useWorkerColors: () => ({ background: '#000', surface: '#111' }) },
    './components/useWorkerOrderText': { useWorkerOrderText: () => ({ p: value => locale === 'uz' ? value : `${locale}:${value}`, t: value => value, locale }) },
    './components/useWorkerPeremotka': { useWorkerPeremotka: () => ({ state: { phase: 'closed' }, controller: {} }) },
    './components/useWorkerActivePaddon': { useWorkerActivePaddon: () => ({ state: { busy: false }, controller: {}, notice: '' }) },
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10, loadQueueLimit: async () => 10, saveQueueLimit: async () => {} },
    './workerQueuePresentation': { workerQueueLimitLabels: () => ({ title: 'Ko‘rsatish', all: 'Barchasi', counts: {} }) },
    './workerPaddonNavigation': load('workerPaddonNavigation'),
    './workerNavigation': { workerDailyWorkVisible: () => true, workerInventoryVisible: actor => actor.capabilities.includes('inventory.movement.manage') },
    './workerQueueWindow': { workerQueueSearch: value => value.trim() },
    './workerActivePaddon': { workerPaddonApparatus: () => null },
    './workerOrderBlocking': { workerOrderBusyTitle: () => '' },
    './workerSheetPresentation': load('workerSheetPresentation'),
    './sessionReadScope': scope,
  };
  const filename = path.resolve(__dirname, '../src/WorkerScreen.tsx'), mod = new Module(filename, module);
  mod.filename = filename;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : new Proxy({}, { get: (_value, name) => name });
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const s = session();
  s.capabilities.push('apparatus.queue.manage');
  return { opened, updates, actionOptions, presentations, historyOpened, queueState, session: s, routes, preparation, get rowElements() { return rowElements; }, setLocale(value) { locale = value; }, render() { cursor = 0; const tree = mod.exports.WorkerScreen({ session: s, nativeNavigation, onLogout() {} }); while (effects.length) effects.shift()(); return tree; } };
}
function nodes(tree, type, result = []) {
  if (!tree) return result;
  if (Array.isArray(tree)) { tree.forEach(item => nodes(item, type, result)); return result; }
  if (tree.type === type) result.push(tree);
  nodes(tree.props?.children, type, result); return result;
}
for (const platform of ['ios', 'android']) test(`${platform}: a 1000-order queue creates rows only when the native list requests them`, () => {
  const x = workerScreenHarness(platform), original = x.queueState.queue.orders[station][0];
  const rows = Array.from({ length: 1000 }, (_, index) => ({ ...original, id: `order-${index}`, code: String(index) }));
  x.queueState.queue.orders[station] = rows;
  const tree = x.render(), list = nodes(tree, 'WorkerTabs')[0].props.children(station);
  assert.equal(list.props.rows, rows, 'pass the unchanged model array to native virtualization');
  assert.equal(x.rowElements, 0, 'neither WorkerScreen nor its tab callback should construct all row elements');
  assert.equal(nodes(list, 'WorkerOrderListItem').length, 0);
  const requested = list.props.renderRow(rows[500], 500, rows.length, false);
  assert.equal(x.rowElements, 1); assert.equal(requested.props.orderId, 'order-500');
  assert.equal(list.props.rowKey(rows[500], 500), 'order-500');
  assert.equal(list.props.footer?.type, platform === 'android' ? 'Spacer' : undefined);
});
for (const platform of ['ios', 'android']) test(`${platform}: worker FAB uses assigned cutter eligibility independent of the selected queue tab`, () => {
  const x = workerScreenHarness(platform);
  let tree = x.render();
  assert.equal(nodes(tree, 'WorkerFab')[0].props.showPaddons, false);
  assert.equal(x.preparation.paddonOwner, x.session);
  x.preparation.paddonOptions = [{ id: 'paddons:another-cut' }];
  tree = x.render();
  assert.equal(nodes(tree, 'WorkerTabs')[0].props.selected, station);
  assert.equal(nodes(tree, 'WorkerFab')[0].props.showPaddons, true);
  x.preparation.paddonOptions = [];
  assert.equal(nodes(x.render(), 'WorkerFab')[0].props.showPaddons, false);
});
for (const platform of ['ios', 'android']) test(`${platform}: FAB scanner overlays the mounted queue and closing it preserves the list`, async () => {
  const x = workerScreenHarness(platform, platform === 'ios');
  x.render(); await flush(); let tree = x.render();
  const queueBefore = x.queueState.queue;
  nodes(tree, 'WorkerFab')[0].props.onScan(); tree = x.render();
  const scanner = nodes(tree, 'WorkerQrScanner')[0];
  assert.ok(scanner); assert.equal(nodes(tree, 'WorkerTabs').length, 1); assert.equal(nodes(tree, 'Modal').length, 0);
  assert.deepEqual(x.routes, []); assert.equal(scanner.props.current(), true);
  scanner.props.onClose(); tree = x.render();
  assert.equal(nodes(tree, 'WorkerQrScanner').length, 0); assert.equal(nodes(tree, 'WorkerTabs').length, 1);
  assert.equal(x.queueState.queue, queueBefore); assert.deepEqual(x.routes, []);
});
test('Android repeated scanner cancellation retains the selected tab, search, limit and queue owner without reloading', async () => {
  const x = workerScreenHarness('android', false); let reloads = 0;
  x.queueState.reload = async () => { reloads++; };
  x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerTabs')[0].props.onSearchChange('saved query'); tree = x.render();
  let tabs = nodes(tree, 'WorkerTabs')[0];
  nodes(tabs.props.children(station), 'WorkerQueueFilter')[0].props.onChange(20); tree = x.render();
  const queueBefore = x.queueState.queue, controllerBefore = x.queueState.controller;
  for (let cycle = 0; cycle < 3; cycle++) {
    nodes(tree, 'WorkerFab')[0].props.onScan(); tree = x.render();
    assert.equal(nodes(tree, 'WorkerTabs').length, 1, 'the scanner must leave the queue in the same rendered tree');
    nodes(tree, 'WorkerQrScanner')[0].props.onClose(); tree = x.render();
    tabs = nodes(tree, 'WorkerTabs')[0];
    assert.equal(tabs.props.selected, station); assert.equal(tabs.props.search, 'saved query');
    assert.equal(nodes(tabs.props.children(station), 'WorkerQueueFilter')[0].props.value, 20);
    assert.equal(x.queueState.queue, queueBefore); assert.equal(x.queueState.controller, controllerBefore);
  }
  assert.equal(reloads, 0); assert.deepEqual(x.routes, []); assert.deepEqual(x.opened, []);
});
for (const platform of ['ios', 'android']) test(`${platform} real WorkerScreen opens order sheet from retained unsynchronized rows with no stale action cursor`, async () => {
  const x = workerScreenHarness(platform); let tree = x.render(); await flush(); tree = x.render();
  const list = nodes(tree, 'WorkerTabs')[0].props.children(station, undefined, undefined);
  const row = list.props.renderRow(list.props.rows[0], 0, list.props.rows.length, false);
  assert.equal(row.props.statusText, platform === 'ios' ? 'worker.queue.status.in_progress' : undefined, 'iOS worker queue uses the requested small status indicator; other platform defaults are retained');
  assert.equal(row.props.supportingText, x.queueState.queue.orders[station][0].customer);
  assert.equal(nodes(list, 'WorkerQueueConnectionProgress')[0].props.active, true);
  row.props.onPress(); tree = x.render();
  const detail = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.opened[0];
  assert.ok(detail, 'a row tap must open its detail even while the list scope is revalidating');
  assert.equal(detail.type, 'OrderScreen'); assert.equal(detail.props.queueCursor, null);
  assert.equal(detail.props.preview.id, 'work-1'); assert.equal(detail.props.preview.state, 'in_progress');
  if (platform === 'ios') assert.equal(nodes(tree, 'WorkerOrderSheet').length, 1);
  assert.equal(nodes(tree, 'WorkerAlert')[0].props.alert, null, 'the old Navbat yangilanmoqda global gate must not block detail navigation');
});

async function readyIosScreen() {
  const x = workerScreenHarness('ios');
  x.render(); await flush();
  x.queueState.synchronized = true;
  x.queueState.loadedWindow = JSON.stringify(['', 10]);
  x.queueState.error = null;
  return x;
}
const screenRows = (tree, tab = station) => {
  const list = nodes(tree, 'WorkerTabs')[0].props.children(tab, undefined, undefined);
  return list.props.rows.map((row, index) => list.props.renderRow(row, index, list.props.rows.length, false));
};

for (const platform of ['ios', 'android']) test(`${platform}: local search previews open fresh detail without lending the previous query cursor`, async () => {
  const x = workerScreenHarness(platform);
  x.queueState.synchronized = true; x.queueState.loadedWindow = JSON.stringify(['', 10]); x.queueState.error = null;
  x.render(); await flush();
  x.preparation.draftQuery = 'film';
  const tree = x.render(), list = nodes(tree, 'WorkerTabs')[0].props.children(station);
  assert.equal(list.props.input.getDraftQuery(), 'film'); assert.equal(list.props.serverQuery, '');
  assert.equal(list.props.sourceQuery, '');
  const preview = list.props.renderRow(list.props.rows[0], 0, 1, true);
  assert.equal(preview.props.last, true);
  preview.props.onPress();
  const opened = x.render(), detail = platform === 'ios' ? nodes(opened, 'OrderScreen')[0] : x.opened.at(-1);
  assert.equal(detail.props.queueCursor, null);
  assert.equal(detail.props.preview.id, 'work-1');
});

test('worker authorization withdrawal disables the retained local search baseline', () => {
  const x = workerScreenHarness('android');
  x.queueState.error = { code: 'permission_denied' };
  const list = nodes(x.render(), 'WorkerTabs')[0].props.children(station);
  assert.equal(list.props.previewAllowed, false);
});

for (const platform of ['ios', 'android']) test(`${platform}: long press during local search uses a point read without old queue authority`, async () => {
  const x = workerScreenHarness(platform);
  x.queueState.synchronized = true; x.queueState.loadedWindow = JSON.stringify(['', 10]); x.queueState.error = null;
  x.render(); await flush();
  x.preparation.draftQuery = 'film';
  const list = nodes(x.render(), 'WorkerTabs')[0].props.children(station);
  const preview = list.props.renderRow(list.props.rows[0], 0, 1, true);
  await preview.props.onLongPress();
  assert.equal(x.preparation.calls.length, 1);
  assert.equal(x.preparation.calls[0][4](), null, 'raw query differs from the previous confirmed server window');
});

for (const platform of ['ios', 'android']) test(`${platform}: preflight confirmation also rejects the previous cursor for a local preview`, async () => {
  const x = workerScreenHarness(platform);
  x.queueState.synchronized = true; x.queueState.loadedWindow = JSON.stringify(['', 10]); x.queueState.error = null;
  x.queueState.queue.orders[station][0].state = 'print_preflight_passed';
  x.preparation.menuActionCursors = [];
  x.preparation.result = { kind: 'menu', menu: { kind: 'reopen' } };
  x.render(); await flush();
  x.preparation.draftQuery = 'film';
  const list = nodes(x.render(), 'WorkerTabs')[0].props.children(station);
  await list.props.renderRow(list.props.rows[0], 0, 1, true).props.onLongPress();
  const alert = nodes(x.render(), 'WorkerAlert')[0].props.alert;
  assert.equal(typeof alert.onConfirm, 'function');
  alert.onConfirm(); await flush();
  assert.deepEqual(x.preparation.menuActionCursors, [null]);
});

for (const platform of ['ios', 'android']) test(`${platform} open order receives each remote queue revision immediately without remounting its sheet`, async () => {
  const x = workerScreenHarness(platform, platform === 'ios');
  x.queueState.synchronized = true; x.queueState.error = null; x.queueState.loadedWindow = JSON.stringify(['', 10]);
  x.render(); await flush(); let tree = x.render();
  screenRows(tree)[0].props.onPress(); tree = x.render();
  const initial = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.opened.at(-1);
  const presentation = nodes(tree, 'WorkerOrderSheet')[0];
  const initialEpoch = initial.props.queueCursor.epoch;
  for (const [revision, epoch] of [[8, initialEpoch], [9, initialEpoch], [1, 'new-epoch']]) {
    const next = structuredClone(x.queueState.queue);
    next.snapshot.rev = revision; next.snapshot.epoch = epoch;
    next.machines[0].name = `Current apparatus ${epoch}/${revision}`;
    next.catalog[0].name = `Current catalog ${epoch}/${revision}`;
    x.queueState.queue = next; tree = x.render();
    const detail = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.updates.at(-1);
    assert.equal(detail.props.queueCursor, next.snapshot, 'the first render after a remote update must carry the current snapshot');
    assert.equal(detail.props.queueCursor.rev, revision); assert.equal(detail.props.queueCursor.epoch, epoch);
    assert.equal(detail.props.apparatus, next.machines[0]); assert.equal(detail.props.apparatusCatalog, next.catalog);
    assert.equal(detail.key, initial.key, 'live refresh must preserve the order component and unfinished form state');
    assert.equal(detail.props.onClose, initial.props.onClose);
    if (platform === 'ios') assert.equal(nodes(tree, 'WorkerOrderSheet')[0].key, presentation.key);
  }
  x.queueState.synchronized = false; tree = x.render();
  const retired = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.updates.at(-1);
  assert.equal(retired.props.queueCursor, null, 'connection loss must immediately withdraw the list cursor');
  x.queueState.synchronized = true; tree = x.render();
  const recovered = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.updates.at(-1);
  assert.equal(recovered.props.queueCursor, x.queueState.queue.snapshot);
});

test('Android delayed row callbacks still open detail from the latest committed queue', async () => {
  const x = workerScreenHarness('android', false);
  x.queueState.synchronized = true; x.queueState.error = null; x.queueState.loadedWindow = JSON.stringify(['', 10]);
  x.render(); await flush(); let tree = x.render();
  const delayedPress = screenRows(tree)[0].props.onPress;
  const next = structuredClone(x.queueState.queue); next.snapshot.rev = 8;
  x.queueState.queue = next; x.render();
  delayedPress();
  assert.equal(x.opened.at(-1).props.queueCursor, next.snapshot);
});

test('worker drawer transfer opens the real inventory screen and permission loss blocks entry', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  const drawer = nodes(tree, 'WorkerDrawer')[0];
  drawer.props.onSelect('transfer'); tree = x.render();
  assert.equal(nodes(tree, 'WorkerInventoryScreen').length, 0);
  assert.equal(nodes(tree, 'WorkerAlert')[0].props.alert, null);
  x.session.capabilities.push('inventory.movement.manage'); tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('transfer'); tree = x.render();
  assert.equal(nodes(tree, 'WorkerInventoryScreen').length, 1);
  assert.equal(nodes(tree, 'WorkerFab').length, 0);
  assert.equal(nodes(tree, 'WorkerBottomBar').length, 0);
  nodes(tree, 'WorkerInventoryScreen')[0].props.onBack(); tree = x.render();
  assert.equal(nodes(tree, 'WorkerInventoryScreen').length, 0);
  assert.equal(nodes(tree, 'WorkerTabs').length, 1);
});

test('Android drawer opens the assigned Paddon page with its own working navigation', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('paddons:cut'); tree = x.render();
  const page = x.presentations.at(-1); assert.equal(page.value.type, 'WorkerPaddonPage'); assert.equal(page.value.props.apparatus, 'cut');
  assert.equal(page.options.presentation, 'page'); assert.equal(nodes(tree, 'WorkerTabs').length, 1);
  page.value.props.onSelect('profile'); tree = x.render();
  assert.equal(nodes(tree, 'ProfileScreen').length, 0);
  page.options.onDismiss(); tree = x.render(); assert.equal(nodes(tree, 'ProfileScreen').length, 1);
});

test('Android Paddon Home and back returns retain the mounted queue, tab, search, limit and owner', async () => {
  const x = workerScreenHarness('android', false); let reloads = 0;
  x.queueState.reload = async () => { reloads++; };
  x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerTabs')[0].props.onSelect('completed'); nodes(tree, 'WorkerTabs')[0].props.onSearchChange('saved query');
  tree = x.render(); nodes(nodes(tree, 'WorkerTabs')[0].props.children('completed'), 'WorkerQueueFilter')[0].props.onChange(20);
  const queue = x.queueState.queue, controller = x.queueState.controller;
  for (const destination of ['home', 'queue', 'back']) {
    tree = x.render(); nodes(tree, 'WorkerFab')[0].props.onSelect('paddons:cut'); tree = x.render();
    assert.equal(nodes(tree, 'WorkerTabs').length, 1); assert.equal(nodes(tree, 'WorkerPaddons').length, 0);
    const page = x.presentations.at(-1);
    assert.equal(page.value.type, 'WorkerPaddonPage'); assert.equal(page.options.presentation, 'page');
    if (destination === 'back') page.value.props.onBack(); else page.value.props.onSelect(destination);
    page.options.onDismiss(); tree = x.render(); const tabs = nodes(tree, 'WorkerTabs')[0];
    assert.equal(tabs.props.selected, 'completed'); assert.equal(tabs.props.search, 'saved query');
    assert.equal(nodes(tabs.props.children('completed'), 'WorkerQueueFilter')[0].props.value, 20);
    assert.equal(x.queueState.queue, queue); assert.equal(x.queueState.controller, controller);
  }
  assert.equal(reloads, 0); assert.deepEqual(x.routes, []);
});

test('a closed Android Paddon page cannot navigate after its session witness expires', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerFab')[0].props.onSelect('paddons:cut'); const page = x.presentations.at(-1);
  page.value.props.onSelect('profile'); x.preparation.witnessCurrent = false; page.options.onDismiss();
  tree = x.render(); assert.equal(nodes(tree, 'ProfileScreen').length, 0); assert.equal(nodes(tree, 'WorkerTabs').length, 1);
});

test('opening Android Paddons cancels a pending order action before covering the queue', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  const read = deferred(); x.preparation.pending = read;
  const opening = screenRows(tree)[0].props.onLongPress();
  nodes(tree, 'WorkerFab')[0].props.onSelect('paddons:cut');
  assert.equal(x.preparation.calls[0][6].aborted, true);
  read.resolve(x.preparation.result); await opening; tree = x.render();
  assert.deepEqual(x.presentations.map(page => page.value.type), ['WorkerPaddonPage']);
  assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0); assert.equal(nodes(tree, 'WorkerTabs').length, 1);
});

test('iOS Paddon navigation pushes above the existing home queue without replacing it', async () => {
  const x = workerScreenHarness('ios'); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerTabs')[0].props.onSelect('completed'); nodes(tree, 'WorkerTabs')[0].props.onSearchChange('saved query');
  tree = x.render(); nodes(tree, 'WorkerFab')[0].props.onSelect('paddons:cut'); tree = x.render();
  assert.deepEqual(x.routes, ['/ios-worker/paddons?apparatus=cut&name=']);
  const tabs = nodes(tree, 'WorkerTabs')[0]; assert.equal(tabs.props.selected, 'completed'); assert.equal(tabs.props.search, 'saved query');
  assert.equal(x.presentations.length, 0);
});

test('Android daily work opens above the existing queue and repeated Home returns retain its tab and search', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush();
  let tree = x.render(), reloads = 0;
  x.queueState.reload = async () => { reloads++; };
  const queue = x.queueState.queue;
  nodes(tree, 'WorkerTabs')[0].props.onSelect('completed');
  nodes(tree, 'WorkerTabs')[0].props.onSearchChange('film');
  for (let cycle = 0; cycle < 3; cycle++) {
    tree = x.render();
    nodes(tree, 'WorkerDrawer')[0].props.onSelect('daily'); tree = x.render();
    const tabs = nodes(tree, 'WorkerTabs');
    assert.equal(tabs.length, 1, 'the queue subtree must stay mounted while daily work covers it');
    assert.equal(tabs[0].props.selected, 'completed'); assert.equal(tabs[0].props.search, 'film');
    assert.equal(nodes(tree, 'DailyWorkScreen').length, 0, 'daily work must not replace the queue inline');
    const page = x.presentations.at(-1);
    assert.equal(page.value.type, 'WorkerDailyPage'); assert.equal(page.options.presentation, 'page');
    page.value.props.onSelect('home'); page.options.onDismiss(); tree = x.render();
    assert.equal(nodes(tree, 'WorkerTabs')[0].props.selected, 'completed');
    assert.equal(nodes(tree, 'WorkerTabs')[0].props.search, 'film');
    assert.equal(x.queueState.queue, queue);
  }
  assert.equal(reloads, 0);
});

test('Android daily work defers destination navigation until its native page is removed', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('daily');
  const page = x.presentations.at(-1);
  page.value.props.onSelect('chat'); assert.deepEqual(x.routes, []);
  page.options.onDismiss(); assert.deepEqual(x.routes, ['/android-chat']);
  tree = x.render(); assert.equal(nodes(tree, 'WorkerTabs').length, 1);
});

test('Android profile opens the same daily page and native Back retains the previous profile', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('profile'); tree = x.render();
  nodes(tree, 'ProfileScreen')[0].props.onDailyWork(); tree = x.render();
  const page = x.presentations.at(-1);
  assert.equal(page.value.type, 'WorkerDailyPage');
  assert.equal(nodes(tree, 'ProfileScreen').length, 1);
  page.value.props.onBack(); page.options.onDismiss(); tree = x.render();
  assert.equal(nodes(tree, 'ProfileScreen').length, 1);
  assert.equal(nodes(tree, 'DailyWorkScreen').length, 0);
});

test('Android daily page cannot navigate or reopen after its session expires', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('daily'); const page = x.presentations.at(-1);
  page.value.props.onSelect('profile'); x.preparation.current = false; page.options.onDismiss();
  tree = x.render(); assert.equal(nodes(tree, 'WorkerTabs').length, 1); assert.equal(nodes(tree, 'ProfileScreen').length, 0);
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('daily'); assert.equal(x.presentations.length, 1);
});

test('Android daily page navigation survives a token refresh within the same account scope', async () => {
  const x = workerScreenHarness('android', false); x.render(); await flush(); let tree = x.render();
  nodes(tree, 'WorkerDrawer')[0].props.onSelect('daily'); const page = x.presentations.at(-1);
  x.preparation.witnessCurrent = false; x.session.token = 'refreshed-same-account';
  page.value.props.onSelect('profile'); page.options.onDismiss(); tree = x.render();
  assert.equal(nodes(tree, 'ProfileScreen').length, 1);
});

test('worker queue subtitles preserve the V2 temporary-pause label instead of invented status text', async () => {
  const x = workerScreenHarness('ios'); x.render(); await flush();
  x.queueState.queue.orders[station][0].temporarilyPaused = true;
  const tree = x.render(), row = screenRows(tree)[0];
  assert.equal(row.props.supportingText, `worker.temporary_pause.status • ${x.queueState.queue.orders[station][0].customer}`);
  assert.equal(row.props.statusText, 'worker.queue.status.in_progress');
  assert.equal(row.props.statusDetail, row.props.supportingText);
  const list = nodes(tree, 'WorkerTabs')[0].props.children(station);
  assert.ok(nodes(list, 'ListItem').some(node => node.props.children === 'worker.queue.your.apparatus'));
});

test('iOS worker status indicators follow current card tone/state and refresh labels when locale changes', async () => {
  const x = workerScreenHarness('ios'); x.render(); await flush();
  const order = x.queueState.queue.orders[station][0];
  for (const [cardTone, state, key] of [
    ['neutral', 'pending', 'worker.queue.status.pending'], ['neutral', 'in_progress', 'worker.queue.status.in_progress'],
    ['paused', 'in_progress', 'worker.queue.status.paused'], ['frozen', 'pending', 'worker.queue.status.frozen'],
    ['print_preflight', 'pending', 'worker.queue.status.print_preflight'],
    ['print_preflight_passed', 'pending', 'worker.queue.status.print_preflight_passed'],
  ]) {
    order.cardTone = cardTone; order.state = state;
    assert.equal(screenRows(x.render())[0].props.statusText, key);
    x.setLocale('ru'); const row = screenRows(x.render())[0];
    assert.equal(row.props.statusText, `ru:${key}`); assert.equal(row.props.statusDetail, order.customer);
    x.setLocale('uz');
  }
});

test('iOS retained unvalidated rows can open a scoped action menu, but a changed query retires its read', async () => {
  const x = workerScreenHarness('ios'); x.render(); await flush(); let tree = x.render();
  const row = screenRows(tree)[0];
  row.props.onLongPress(); await flush(); tree = x.render();
  const menu = nodes(tree, 'WorkerLongPressActions')[0];
  assert.ok(menu);
  const sheet = onlySheet(tree);
  assert.equal(sheet.props.fitContent, true);
  assert.equal(sheet.props.compact, true);
  assert.equal(sheet.props.heightFraction, 0.86);
  const getCursor = x.preparation.calls[0][4];
  assert.equal(getCursor(), null, 'the fresh scoped control read owns authorization while the list is unvalidated');
  assert.equal(menu.props.prepared, x.preparation.result);
  assert.equal(nodes(tree, 'WorkerAlert')[0].props.alert, null);
  nodes(tree, 'WorkerTabs')[0].props.onSearchChange('new query'); x.render();
  assert.throws(getCursor, /worker.error.sync/);
});
function onlySheet(tree) {
  const sheets = nodes(tree, 'WorkerOrderSheet');
  assert.equal(sheets.length, 1, 'there must be exactly one order presentation');
  assert.ok(sheets[0].key != null, 'each native presentation needs its own React identity');
  return sheets[0];
}

for (const platform of ['ios', 'android']) {
  test(`${platform} pending long press gives feedback without presenting an empty sheet, including repeated holds`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    const read = deferred(); x.preparation.pending = read;
    const rows = screenRows(x.render()), first = rows[0].props.onLongPress();
    rows[0].props.onLongPress(); rows[1].props.onLongPress(); rows[1].props.onPress();
    assert.equal(x.preparation.feedback, 3); assert.equal(x.preparation.calls.length, 1);
    assert.equal(nodes(x.render(), 'WorkerOrderSheet').length, 0); assert.equal(x.opened.length, 0);
    read.resolve({ kind: 'none' }); await first;
    assert.equal(nodes(x.render(), 'WorkerOrderSheet').length, 0); assert.equal(x.opened.length, 0);
    rows[0].props.onPress();
    assert.equal(platform === 'ios' ? nodes(x.render(), 'OrderScreen').length : x.opened.length, 1, 'a no-action result releases its presentation owner');
  });

  test(`${platform} long press mounts ready actions once and queue/locale rerenders do not restart the read`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    const read = deferred(); x.preparation.pending = read;
    const opening = screenRows(x.render())[0].props.onLongPress();
    for (let revision = 8; revision < 12; revision++) {
      x.queueState.queue.snapshot.rev = revision; x.setLocale('ru'); x.render();
    }
    assert.equal(x.preparation.calls.length, 1); assert.equal(x.opened.length, 0);
    read.resolve(x.preparation.result); await opening;
    const menu = platform === 'ios' ? nodes(x.render(), 'WorkerLongPressActions')[0] : x.opened[0];
    assert.equal(menu.props.prepared, x.preparation.result);
    if (platform === 'android') {
      const { dismissible, compact, fitContent, heightFraction } = x.actionOptions[0];
      assert.deepEqual({ dismissible, compact, fitContent, heightFraction }, { dismissible: true, compact: true, fitContent: true, heightFraction: 0.86 });
    }
    x.render(); x.setLocale('uz'); x.render(); assert.equal(x.preparation.calls.length, 1);
  });

  test(`${platform} a failed long press shows a short source notice and the next gesture can recover`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    const row = screenRows(x.render())[0]; x.preparation.error = new TypeError('Network request failed');
    await row.props.onLongPress(); let tree = x.render();
    assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0); assert.equal(x.opened.length, 0);
    assert.equal(nodes(tree, 'WorkerCutSheets')[0].props.notice, 'worker.error.sync');
    assert.equal(nodes(tree, 'WorkerAlert')[0].props.alert, null);
    x.preparation.error = null; await screenRows(tree)[0].props.onLongPress(); tree = x.render();
    assert.equal(platform === 'ios' ? nodes(tree, 'WorkerLongPressActions').length : x.opened.length, 1);
    assert.equal(x.preparation.calls.length, 2);
  });

  test(`${platform} changing the queue query cancels pending actions and ignores their delayed result`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    const read = deferred(); x.preparation.pending = read;
    const opening = screenRows(x.render())[0].props.onLongPress();
    nodes(x.render(), 'WorkerTabs')[0].props.onSearchChange('new query'); x.render();
    assert.equal(x.preparation.calls[0][6].aborted, true);
    read.resolve(x.preparation.result); await opening;
    let tree = x.render(); assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0); assert.equal(x.opened.length, 0);
    assert.equal(nodes(tree, 'WorkerCutSheets')[0].props.notice, '');
    x.preparation.pending = null; await screenRows(tree)[0].props.onLongPress(); tree = x.render();
    assert.equal(platform === 'ios' ? nodes(tree, 'WorkerLongPressActions').length : x.opened.length, 1);
  });

  test(`${platform} leaving the queue cancels a slow long press before it can present over another page`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    const read = deferred(); x.preparation.pending = read;
    const opening = screenRows(x.render())[0].props.onLongPress();
    x.preparation.blur(); assert.equal(x.preparation.calls[0][6].aborted, true);
    read.resolve(x.preparation.result); await opening;
    assert.equal(nodes(x.render(), 'WorkerOrderSheet').length, 0); assert.equal(x.opened.length, 0);
  });

  test(`${platform} a pending order with prior astatka opens its report directly with no intermediate menu`, async () => {
    const x = workerScreenHarness(platform); x.render(); await flush();
    x.preparation.result = { kind: 'astatka' };
    await screenRows(x.render())[0].props.onLongPress(); const tree = x.render();
    assert.equal(nodes(tree, 'WorkerLongPressActions').length, 0);
    const detail = platform === 'ios' ? nodes(tree, 'OrderScreen')[0] : x.opened[0];
    assert.equal(detail.props.initialAction, 'astatka');
  });
}

test('iOS same-frame taps across rows keep the first presentation until native dismissal', async () => {
  const x = await readyIosScreen(); let tree = x.render();
  const rows = screenRows(tree);
  assert.ok(rows.length >= 2);
  rows[0].props.onPress(); rows[0].props.onPress(); rows[1].props.onPress();
  tree = x.render(); const first = onlySheet(tree);
  assert.equal(nodes(tree, 'OrderScreen')[0].props.orderId, rows[0].props.orderId);
  // A native closing animation still owns its presentation until onDismiss/onClose.
  rows[1].props.onPress(); tree = x.render();
  assert.equal(onlySheet(tree).key, first.key);
  first.props.onClose();
  rows[1].props.onPress(); tree = x.render(); const second = onlySheet(tree);
  assert.notEqual(second.key, first.key);
  assert.equal(nodes(tree, 'OrderScreen')[0].props.orderId, rows[1].props.orderId);
  first.props.onClose(); tree = x.render();
  assert.equal(onlySheet(tree).key, second.key, 'an old native dismissal cannot clear the new order');
});

test('iOS tap and long press share one synchronous presentation owner', async () => {
  const x = await readyIosScreen(); let tree = x.render(); const rows = screenRows(tree);
  rows[0].props.onPress(); rows[1].props.onLongPress();
  tree = x.render(); const detail = onlySheet(tree);
  assert.equal(nodes(tree, 'WorkerLongPressActions').length, 0);
  detail.props.onClose(); rows[1].props.onLongPress(); rows[0].props.onPress();
  await flush(); tree = x.render(); const menu = onlySheet(tree);
  assert.notEqual(menu.key, detail.key);
  assert.equal(nodes(tree, 'OrderScreen').length, 0);
  assert.equal(nodes(tree, 'WorkerLongPressActions')[0].props.order.id, rows[1].props.orderId);
  detail.props.onClose(); tree = x.render();
  assert.equal(onlySheet(tree).key, menu.key);
});

test('iOS twenty mixed detail/menu cycles reject old callbacks without exhausting sheet ownership', async () => {
  const x = await readyIosScreen(); let tree = x.render(); const rows = screenRows(tree), oldDismissals = [];
  const identities = new Set();
  for (let cycle = 0; cycle < 20; cycle++) {
    const row = rows[cycle % rows.length];
    const open = cycle % 2 ? row.props.onLongPress : row.props.onPress;
    open(); await flush(); tree = x.render(); const current = onlySheet(tree);
    assert.equal(identities.has(current.key), false, 'a new presentation cannot reuse a dismissed native host');
    identities.add(current.key);
    for (const dismiss of oldDismissals) dismiss();
    tree = x.render(); assert.equal(onlySheet(tree).key, current.key);
    assert.equal(nodes(tree, 'OrderScreen').length + nodes(tree, 'WorkerLongPressActions').length, 1);
    current.props.onClose(); oldDismissals.push(current.props.onClose);
    tree = x.render(); assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0);
  }
  rows[0].props.onPress(); tree = x.render();
  assert.ok(onlySheet(tree));
  assert.equal(nodes(tree, 'OrderScreen')[0].props.orderId, rows[0].props.orderId);
});

test('iOS menu selection hands off to detail only after native dismissal and ignores the retired menu', async () => {
  const x = await readyIosScreen(); let tree = x.render(); const row = screenRows(tree)[0];
  row.props.onLongPress(); await flush(); tree = x.render(); const menu = onlySheet(tree);
  const actions = nodes(tree, 'WorkerLongPressActions')[0];
  actions.props.onChoose('astatka'); tree = x.render();
  assert.equal(onlySheet(tree).key, menu.key, 'choosing a destination must not mount it during native dismissal');
  assert.equal(nodes(tree, 'OrderScreen').length, 0);
  menu.props.onClose(); tree = x.render(); const detail = onlySheet(tree);
  assert.notEqual(detail.key, menu.key);
  assert.equal(nodes(tree, 'WorkerLongPressActions').length, 0);
  assert.equal(nodes(tree, 'OrderScreen')[0].props.initialAction, 'astatka');
  assert.equal(nodes(tree, 'OrderScreen')[0].props.orderId, row.props.orderId);
  menu.props.onClose(); tree = x.render();
  assert.equal(onlySheet(tree).key, detail.key, 'a duplicated menu dismissal cannot remove its destination');
  detail.props.onClose();
  row.props.onLongPress(); await flush(); tree = x.render(); const nextMenu = onlySheet(tree);
  actions.props.onChoose('complete');
  nextMenu.props.onClose(); tree = x.render();
  assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0, 'a retired menu choice must not enqueue an action on the new menu');
});

test('iOS completed history holds the shared owner through dismissal and cannot release a later sheet', async () => {
  const x = await readyIosScreen(); let tree = x.render();
  const row = screenRows(tree)[0], completed = screenRows(tree, 'completed')[0];
  assert.ok(completed);
  completed.props.onPress(); row.props.onPress(); row.props.onLongPress();
  tree = x.render();
  assert.equal(x.historyOpened.length, 1);
  assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0, 'detail and menu cannot overlap completed history');
  const history = nodes(tree, 'WorkerWipHistorySheet')[0];
  completed.props.onPress(); assert.equal(x.historyOpened.length, 1);
  history.props.onDismiss(); row.props.onLongPress(); await flush(); tree = x.render(); const menu = onlySheet(tree);
  history.props.onDismiss(); tree = x.render();
  assert.equal(onlySheet(tree).key, menu.key);
  row.props.onPress(); tree = x.render();
  assert.equal(onlySheet(tree).key, menu.key, 'stale history dismissal cannot unlock an active menu');
});

test('iOS read-scope changes retire detail, menu and history generations without unlocking their replacements', async () => {
  for (const kind of ['detail', 'menu', 'history']) {
    const x = await readyIosScreen(); let tree = x.render();
    const originalHistoryKey = nodes(tree, 'WorkerWipHistorySheet')[0].key;
    if (kind === 'history') screenRows(tree, 'completed')[0].props.onPress();
    else screenRows(tree)[0].props[kind === 'detail' ? 'onPress' : 'onLongPress']();
    await flush();
    tree = x.render();
    const oldDismiss = kind === 'history' ? nodes(tree, 'WorkerWipHistorySheet')[0].props.onDismiss : onlySheet(tree).props.onClose;
    const oldChoice = nodes(tree, 'WorkerLongPressActions')[0]?.props.onChoose;
    const oldPresentationKey = kind === 'history' ? undefined : onlySheet(tree).key;

    x.session.profile.ref = 'replacement-account';
    x.render(); await flush(); tree = x.render();
    assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0, `${kind} must leave the new read scope`);
    assert.notEqual(nodes(tree, 'WorkerWipHistorySheet')[0].key, originalHistoryKey, 'history selection must be remounted at an account boundary');
    const rows = screenRows(tree);
    rows[0].props.onLongPress(); await flush(); tree = x.render(); const replacement = onlySheet(tree);
    if (oldPresentationKey !== undefined) assert.notEqual(replacement.key, oldPresentationKey, 'reset cannot reuse an old presentation generation');
    oldChoice?.('astatka'); oldDismiss();
    rows[1].props.onPress(); tree = x.render();
    assert.equal(onlySheet(tree).key, replacement.key, `${kind} callbacks cannot unlock a new account's menu`);
    assert.equal(nodes(tree, 'OrderScreen').length, 0);
    replacement.props.onClose(); tree = x.render();
    assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0, 'retired choices cannot create a cross-account handoff');
    rows[1].props.onPress(); tree = x.render();
    assert.equal(nodes(tree, 'OrderScreen')[0].props.orderId, rows[1].props.orderId);
  }
});

test('safe page disposal flushes its final baseline after cancelling obsolete scheduled saves', async () => {
  const c = clock(), writes = []; let scheduled;
  const x = setup({
    persist: async (value, flushNow = false) => {
      if (scheduled !== undefined) clearTimeout(scheduled);
      if (flushNow) { scheduled = undefined; writes.push(value.snapshot.rev); }
      else scheduled = setTimeout(() => { scheduled = undefined; writes.push(value.snapshot.rev); }, 400);
    },
    cancelPersist: () => { if (scheduled !== undefined) clearTimeout(scheduled); scheduled = undefined; },
  });
  try { await x.controller.start(); x.sockets[0].callbacks.snapshot(queue(11).snapshot); x.controller.dispose();
    c.advance(400); await flush(); assert.deepEqual(writes, [11]); assert.equal(x.released.at(-1).value.snapshot.rev, 11);
  } finally { x.controller.dispose(); c.restore(); }
});

test('useWorkerQueue replaces owners for a changed query or assignment scope while token refresh keeps the owner', async () => {
  const c = clock(), hooks = [], effects = [], owners = [], listeners = new Set(); let index = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    useRef(initial) { const id = index++; if (!hooks[id]) hooks[id] = { current: initial }; return hooks[id]; },
    useState(initial) { const id = index++; if (!hooks[id]) hooks[id] = { value: typeof initial === 'function' ? initial() : initial }; return [hooks[id].value, value => { hooks[id].value = typeof value === 'function' ? value(hooks[id].value) : value; }]; },
    useMemo(fn, deps) { const id = index++; if (!hooks[id] || !equal(deps, hooks[id].deps)) hooks[id] = { deps, value: fn() }; return hooks[id].value; },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useEffect(fn, deps) { const id = index++; if (!hooks[id] || !equal(deps, hooks[id].deps)) { const previous = hooks[id]; hooks[id] = { deps }; effects.push(() => { previous?.cleanup?.(); hooks[id].cleanup = fn(); }); } },
  };
  class Controller extends WorkerQueueController { constructor(...args) { super(...args); owners.push(this); } }
  let warmLease = 0, backgroundRestarts = 0;
  const baselineWindows = [];
  const warm = { claim: () => ({ lease: ++warmLease, ready: null, pending: Promise.resolve(null) }),
    release(lease) { if (lease === warmLease) backgroundRestarts++; }, peek: () => null };
  const hook = load('components/useWorkerQueue', {
    react,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } } },
    '../auth': { activeSessionToken: value => value.token, sessionWitnessVersion: () => 0, subscribeSessionWitness: () => () => {} },
    '../sessionReadScope': scope, '../workerQueueController': { WorkerQueueController: Controller },
    '../workerApi': { loadWorkerQueueBaseline: async (_session, search, limit) => { baselineWindows.push([search, limit]); return queue(); }, loadWorkerQueueCatalog: async () => queue().catalog, loadWorkerQueueSnapshot: async () => queue(8).snapshot },
    '../workerQueueReadError': { workerQueueReadCanRetry: () => true },
    '../workerLive': { subscribeWorkerLive: () => () => {} }, '../workerQueueWarmStore': { workerQueueWarmStore: warm },
    '../workerQueueCache': { cancelPendingWorkerQueueSave() {}, forgetWorkerQueue: async () => {}, restoreWorkerQueue: async () => null,
      saveWorkerQueue: async () => {}, flushWorkerQueueSave: async () => {} },
    '../profileApi': { profile: async () => ({}) },
  });
  const s = session();
  const render = (search = '', limit = 10) => { index = 0; const value = hook.useWorkerQueue(s, search, limit, true); while (effects.length) effects.shift()(); return value; };
  try {
    render(); c.advance(0); await flush(); let first = render(); assert.equal(owners.length, 1); assert.ok(first.queue);
    s.token = 'refreshed'; let refreshed = render(); assert.equal(refreshed.controller, first.controller); assert.equal(owners.length, 1);
    let changed = render('older', 20); assert.notEqual(changed.controller, first.controller); assert.equal(changed.queue, first.queue);
    await flush(); assert.equal(listeners.size, 1);
    assert.equal(backgroundRestarts, 0, 'changing a live page query must reserve the next page owner before the old release can restart background I/O');
    c.advance(0); await flush(); changed = render('older', 20); assert.ok(changed.queue);
    assert.deepEqual(baselineWindows, [['', 10], ['older', 20]], 'a committed query starts immediately without another debounce');
    s.assigned_apparatus = []; const boundary = render('older', 20);
    assert.notEqual(boundary.controller, changed.controller); assert.equal(boundary.queue, null, 'old-account/assignment display cannot cross its read scope');
    await flush(); assert.equal(listeners.size, 1);
  } finally {
    owners.forEach(owner => owner.dispose()); c.restore();
  }
});
