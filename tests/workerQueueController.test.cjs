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

function workerScreenHarness(platform) {
  const hooks = [], effects = [], opened = [], historyOpened = []; let cursor = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) { const id = cursor++; if (!hooks[id]) hooks[id] = { value: typeof initial === 'function' ? initial() : initial }; return [hooks[id].value, value => { hooks[id].value = typeof value === 'function' ? value(hooks[id].value) : value; }]; },
    useRef(initial) { const id = cursor++; if (!hooks[id]) hooks[id] = { current: initial }; return hooks[id]; },
    useCallback(fn, deps) { const id = cursor++; if (!hooks[id] || !equal(deps, hooks[id].deps)) hooks[id] = { deps, fn }; return hooks[id].fn; },
    useEffect(fn, deps) { const id = cursor++; if (!hooks[id] || !equal(deps, hooks[id].deps)) { const previous = hooks[id]; hooks[id] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); hooks[id].cleanup = fn(); }); } },
  };
  react.useLayoutEffect = react.useEffect;
  const sheet = { close() {}, open: value => opened.push(value), update() {}, isOpen: () => false };
  const currentQueue = queue();
  currentQueue.orders[station][0].state = 'in_progress';
  currentQueue.snapshot.order_controls['work-1'] = { state: 'active' };
  const queueState = { queue: currentQueue, synchronized: false, loadedWindow: 'previous-query-window', loading: false,
    error: new Error('Connection reset'), reload: async () => {}, controller: { setWritePending() {} } };
  const jsx = (type, props, key) => {
    if (type === 'WorkerWipHistorySheet' && props?.ref) props.ref.current = { open: (...args) => historyOpened.push(args) };
    return { type, props: props ?? {}, key };
  };
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Platform: { OS: platform }, View: 'View', Modal: 'Modal', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-font': { useFonts: () => [true] }, 'expo-router': { router: {} },
    'react-native-reanimated': { useSharedValue: () => ({ set() {} }) },
    './components/useWorkerQueue': { useWorkerQueue: () => queueState },
    './workerQueueReadError': { workerQueueReadCanRetry: () => true },
    './workerApi': api,
    './auth': { activeSessionToken: () => 'token', captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => true },
    './nativeSheet': { useNativeSheet: () => sheet },
    './components/useWorkerColors': { useWorkerColors: () => ({ background: '#000', surface: '#111' }) },
    './components/useWorkerOrderText': { useWorkerOrderText: () => ({ p: value => value }) },
    './components/useWorkerPeremotka': { useWorkerPeremotka: () => ({ state: { phase: 'closed' }, controller: {} }) },
    './components/useWorkerActivePaddon': { useWorkerActivePaddon: () => ({ state: { busy: false }, controller: {}, notice: '' }) },
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10, loadQueueLimit: async () => 10, saveQueueLimit: async () => {} },
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
  return { opened, historyOpened, queueState, session: s, render() { cursor = 0; const tree = mod.exports.WorkerScreen({ session: s, nativeNavigation: true, onLogout() {} }); while (effects.length) effects.shift()(); return tree; } };
}
function nodes(tree, type, result = []) {
  if (!tree) return result;
  if (Array.isArray(tree)) { tree.forEach(item => nodes(item, type, result)); return result; }
  if (tree.type === type) result.push(tree);
  nodes(tree.props?.children, type, result); return result;
}
for (const platform of ['ios', 'android']) test(`${platform} real WorkerScreen opens order sheet from retained unsynchronized rows with no stale action cursor`, async () => {
  const x = workerScreenHarness(platform); let tree = x.render(); await flush(); tree = x.render();
  const list = nodes(tree, 'WorkerTabs')[0].props.children(station, undefined, undefined);
  const row = nodes(list, 'WorkerOrderListItem')[0];
  assert.equal(row.props.statusText, 'Ish jarayonida');
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
const screenRows = (tree, tab = station) => nodes(nodes(tree, 'WorkerTabs')[0].props.children(tab, undefined, undefined), 'WorkerOrderListItem');
function onlySheet(tree) {
  const sheets = nodes(tree, 'WorkerOrderSheet');
  assert.equal(sheets.length, 1, 'there must be exactly one order presentation');
  assert.ok(sheets[0].key != null, 'each native presentation needs its own React identity');
  return sheets[0];
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
  tree = x.render(); const menu = onlySheet(tree);
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
    open(); tree = x.render(); const current = onlySheet(tree);
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
  row.props.onLongPress(); tree = x.render(); const menu = onlySheet(tree);
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
  row.props.onLongPress(); tree = x.render(); const nextMenu = onlySheet(tree);
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
  history.props.onDismiss(); row.props.onLongPress(); tree = x.render(); const menu = onlySheet(tree);
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
    tree = x.render();
    const oldDismiss = kind === 'history' ? nodes(tree, 'WorkerWipHistorySheet')[0].props.onDismiss : onlySheet(tree).props.onClose;
    const oldChoice = nodes(tree, 'WorkerLongPressActions')[0]?.props.onChoose;
    const oldPresentationKey = kind === 'history' ? undefined : onlySheet(tree).key;

    x.session.profile.ref = 'replacement-account';
    x.render(); await flush(); tree = x.render();
    assert.equal(nodes(tree, 'WorkerOrderSheet').length, 0, `${kind} must leave the new read scope`);
    assert.notEqual(nodes(tree, 'WorkerWipHistorySheet')[0].key, originalHistoryKey, 'history selection must be remounted at an account boundary');
    const rows = screenRows(tree);
    rows[0].props.onLongPress(); tree = x.render(); const replacement = onlySheet(tree);
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
  const warm = { claim: () => ({ lease: ++warmLease, ready: null, pending: Promise.resolve(null) }),
    release(lease) { if (lease === warmLease) backgroundRestarts++; }, peek: () => null };
  const hook = load('components/useWorkerQueue', {
    react,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } } },
    '../auth': { activeSessionToken: value => value.token, sessionWitnessVersion: () => 0, subscribeSessionWitness: () => () => {} },
    '../sessionReadScope': scope, '../workerQueueController': { WorkerQueueController: Controller },
    '../workerApi': { loadWorkerQueueBaseline: async () => queue(), loadWorkerQueueCatalog: async () => queue().catalog, loadWorkerQueueSnapshot: async () => queue(8).snapshot },
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
    c.advance(350); await flush(); changed = render('older', 20); assert.ok(changed.queue);
    s.assigned_apparatus = []; const boundary = render('older', 20);
    assert.notEqual(boundary.controller, changed.controller); assert.equal(boundary.queue, null, 'old-account/assignment display cannot cross its read scope');
    await flush(); assert.equal(listeners.size, 1);
  } finally {
    owners.forEach(owner => owner.dispose()); c.restore();
  }
});
