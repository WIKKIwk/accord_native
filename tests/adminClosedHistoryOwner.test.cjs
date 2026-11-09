const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const guard = load('shared/profileSessionGuard.ts'), routes = load('shared/appRoutes.ts'), scope = load('sessionReadScope.ts');
const dart = load('admin/dartJsonString.ts'), closed = load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart });
const audit = load('admin/adminWorkMapAuditModel.ts', { './dartJsonString': dart }), mobile = load('shared/mobileApiException.ts');
const History = load('admin/adminClosedHistoryController.ts', { '../shared/profileSessionGuard': guard, '../shared/mobileApiException': mobile,
  './adminWorkMapClosedModel': closed }).AdminClosedHistoryController;
const Window = load('admin/adminWorkMapController.ts', { './dartJsonString': dart, './adminWorkMapAuditModel': audit,
  './adminWorkMapClosedModel': closed }).AdminWorkMapController;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const session = () => ({ baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] });
const summary = () => ({ order_id: 'o', history_version: 'v1', order_number: '17', title: 'Film', product_code: '', completed_at_unix: 0,
  closed_by_display_name: 'Ana', closed_by_ref: '', closed_by_role: '', logs: [] });
const page = item => ({ projection: '', version: 'v', epoch: 'e', scope: 's', revision: 1, offset: 0, length: 1, total: 1, next_cursor: null,
  order_ids: [], pending_ids: [], order_rows: {}, pending_rows: {}, pending_orders: [], closed_orders: [item], workflow_audit: null, snapshot: null });
function accountFactory(auth = { activeSessionToken: value => value.token }) {
  return load('admin/adminClosedHistoryAccountWitness.ts', { '../auth': auth, '../sessionReadScope': scope,
    '../shared/appRoutes': routes }).adminClosedHistoryAccountWitness;
}
test('Closed account witness captures scope and route, propagates malformed guards and never revives after an observed loss', async () => {
  const create = accountFactory(), original = session(); let current = true;
  const valid = create(original, () => current); assert.equal(guard.isProfileSessionCurrent(valid), true);
  current = false; assert.equal(guard.isProfileSessionCurrent(valid), false); current = true; assert.equal(guard.isProfileSessionCurrent(valid), false);
  for (const change of ['token', 'scope', 'route']) {
    const value = session(), witness = create(value, () => true);
    if (change === 'token') value.token = ''; else if (change === 'scope') value.profile.ref = 'other'; else value.capabilities = [];
    assert.equal(guard.isProfileSessionCurrent(witness), false, change);
    Object.assign(value, session()); assert.equal(guard.isProfileSessionCurrent(witness), false, change);
  }
  for (const invalid of [() => false, () => { throw Error('bad'); }, async () => { throw Error('bad async'); }]) {
    const witness = create(session(), invalid); assert.equal(guard.isProfileSessionCurrent(witness), false); await tick();
  }
  let allowed = true; const routeWitness = load('admin/adminClosedHistoryAccountWitness.ts', { '../auth': { activeSessionToken: value => value.token },
    '../sessionReadScope': scope, '../shared/appRoutes': { ...routes, canOpenRoute: () => allowed } }).adminClosedHistoryAccountWitness(session(), () => true);
  assert.equal(guard.isProfileSessionCurrent(routeWitness), true); allowed = false; assert.equal(guard.isProfileSessionCurrent(routeWitness), false);
  allowed = true; assert.equal(guard.isProfileSessionCurrent(routeWitness), false);
});
test('Closed sheet boundary subscribes to account/history/window, hides immediately and closes after invalidation', () => {
  let live = true, locale = 'en', calls = 0, notifications = 0; const accountListeners = new Set(), historyListeners = new Set(), windowListeners = new Set(), localeListeners = new Set(), stops = [], effects = [];
  const add = (set, listener) => { set.add(listener); return () => set.delete(listener); };
  const react = { useCallback: callback => callback, useEffect: effect => effects.push(effect), useSyncExternalStore: (subscribe, snapshot) => {
    stops.push(subscribe(() => notifications++)); return snapshot();
  } };
  const Boundary = load('admin/AdminClosedLogBoundary.tsx', { react, '../auth': { subscribeSessionWitness: listener => add(accountListeners, listener) },
    '../shared/profileSessionGuard': guard, '../shared/localization/runtime': { localeController: { addListener: listener => add(localeListeners, listener), get locale() { return locale; } } },
    './AdminClosedLogSheet': { AdminClosedLogSheet: 'Sheet' }, './adminClosedLogPresentation': { adminClosedLogDetail: (detail, log, catalog, language) => ({ detail, log, catalog, language }) },
  }).AdminClosedLogBoundary;
  const selection = { detail: { order_id: 'o' }, log: { event_id: 'e' }, isCurrent: () => live }, history = { subscribe: listener => add(historyListeners, listener) },
    window = { subscribe: listener => add(windowListeners, listener) }, props = { selection, history, window, catalog: [{ id: 'a', name: 'A' }], close: () => calls++ };
  let result = Boundary(props); assert.equal(result.type, 'Sheet'); assert.equal(result.props.model.detail, selection.detail); assert.equal(result.props.model.language, 'en');
  assert.equal(accountListeners.size, 1); assert.equal(historyListeners.size, 1); assert.equal(windowListeners.size, 1); assert.equal(localeListeners.size, 1);
  for (const set of [accountListeners, historyListeners, windowListeners]) for (const notify of set) notify(); assert.equal(notifications, 3);
  effects.shift()(); assert.equal(calls, 0); stops.splice(0).forEach(stop => stop());
  locale = 'ur'; result = Boundary(props); assert.equal(result.props.model.language, 'ur'); effects.shift()(); stops.splice(0).forEach(stop => stop());
  live = false; result = Boundary(props); assert.equal(result, null); assert.equal(calls, 0); effects.shift()(); assert.equal(calls, 1);
  stops.splice(0).forEach(stop => stop()); assert.equal(accountListeners.size + historyListeners.size + windowListeners.size + localeListeners.size, 0);
});
function hooks() {
  const instances = new Map(); let active, cursor = 0, scheduled = [];
  const next = kind => { const index = cursor++, existing = active[index]; if (existing && existing.kind !== kind) throw Error('hook order changed');
    return active[index] ??= { kind }; };
  const same = (left, right) => left && right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]));
  const react = {
    useMemo(factory, deps) { const slot = next('memo'); if (!same(slot.deps, deps)) { slot.value = factory(); slot.deps = deps; } return slot.value; },
    useRef(initial) { const slot = next('ref'); return slot.value ??= { current: initial }; },
    useContext() { next('context'); return {}; },
    useSyncExternalStore(_subscribe, snapshot) { next('store'); return snapshot(); },
    useEffect(effect, deps) { const slot = next('effect'); if (!same(slot.deps, deps)) scheduled.push(() => { slot.cleanup?.(); slot.deps = deps; slot.create = effect; slot.cleanup = effect(); }); },
    useLayoutEffect(effect, deps) { const slot = next('layout'); if (!same(slot.deps, deps)) scheduled.push(() => { slot.cleanup?.(); slot.deps = deps; slot.cleanup = effect(); }); },
  };
  return { react, render(id, component, props) { active = instances.get(id) ?? []; instances.set(id, active); cursor = 0; const result = component(props);
    scheduled.splice(0).forEach(run => run()); return result; }, reattach(id) { for (const slot of instances.get(id) ?? []) if (slot.kind === 'effect') { slot.cleanup?.(); slot.cleanup = slot.create(); } },
    unmount(id) { for (const slot of instances.get(id) ?? []) slot.cleanup?.(); instances.delete(id); } };
}
test('prepared owner admits only the exact current summary, opens hydrated logs and never closes a newer sheet with an old callback', async () => {
  const h = hooks(), value = session(), account = { current: true }, original = summary(), reads = [], entries = [];
  const isCurrent = () => account.current, window = new Window({ isCurrent, request: { view: 'closed' }, read: async () => page(original) });
  window.start(); await tick(); let showing = false, currentEntry = null, closedCount = 0;
  const sheet = { isOpen: () => showing, open(content, options) { if (showing) return; showing = true; currentEntry = { content, options }; entries.push(currentEntry); },
    close() { if (!showing) return; showing = false; closedCount++; currentEntry.options?.onDismiss?.(); },
    dismiss() { if (!showing) return; showing = false; currentEntry.options?.onDismiss?.(); } };
  const auth = { activeSessionToken: candidate => candidate === value ? candidate.token : null, subscribeSessionWitness: () => () => {}, sessionWitnessVersion: () => 1 };
  const logSheet = load('admin/AdminClosedLogSheetOwner.tsx', { react: h.react, '../nativeSheet': {}, '../shared/profileSessionGuard': guard,
    './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' } }).createAdminClosedLogSheetOwner(sheet);
  const accountWitness = accountFactory(auth);
  const Owner = load('admin/AdminClosedHistoryOwner.tsx', { react: h.react, '../auth': auth, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/profileSessionGuard': guard, './AdminClosedHistoryContent': { AdminClosedHistoryContent: 'Content' }, './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' },
    './adminClosedHistoryAccountWitness': { adminClosedHistoryAccountWitness: accountWitness }, './adminClosedHistoryController': { AdminClosedHistoryController: History },
    './adminWorkMapClosedModel': closed, './adminWorkMapReader': { adminWorkMapClosedDetailReader: (_session, witness) => id => {
      assert.equal(guard.isProfileSessionCurrent(witness), true, 'one strict validator must accept the raw composed witness');
      const item = deferred(); reads.push({ id, witness, ...item }); return item.promise;
    } },
  }).AdminClosedHistoryOwner;
  const props = { session: value, isCurrent, window, summary: original, catalog: [{ id: 'a', name: 'A' }], logSheet };
  const render = () => { const outer = h.render('outer', Owner, props); return outer && h.render('bound', outer.type, outer.props); };
  let content = render(); assert.equal(content.type, 'Content'); assert.equal(content.props.state.expanded, false); assert.equal(reads.length, 0);
  h.reattach('bound'); await tick(); // StrictMode effect cleanup/re-attach must not dispose the live owner.
  content.props.onToggle(); assert.equal(reads.length, 1); assert.equal(reads[0].id, 'o'); content = render(); assert.equal(content.props.state.loading, true);
  const log = { event_id: 'e', created_at_unix: 0 }, detail = { ...original, logs: [log] }; reads[0].resolve(detail); await tick(); content = render();
  content.props.onLog(detail, { ...log }); assert.equal(entries.length, 0); content.props.onLog(detail, log); assert.equal(entries.length, 1);
  const oldClose = entries[0].content.props.close; assert.equal(entries[0].content.type, 'Boundary'); assert.equal(entries[0].content.props.selection.log, log);
  assert.equal(entries[0].options.dismissible, true, 'the source history sheet permits outside/back/drag dismissal');
  sheet.dismiss(); content.props.onLog(detail, log); assert.equal(entries.length, 2); oldClose(); assert.equal(sheet.isOpen(), true); assert.equal(closedCount, 0);
  const selection = entries[1].content.props.selection; content.props.onToggle(); assert.equal(guard.isProfileSessionCurrent(selection.isCurrent), false);
  entries[1].content.props.close(); assert.equal(sheet.isOpen(), false); assert.equal(closedCount, 1);
  assert.equal(h.render('outer', Owner, { ...props, summary: { ...original } }), null, 'same ID/version is not the same current summary object');
  content.props.onToggle(); content = render(); content.props.onLog(detail, log); assert.equal(entries.length, 3);
  const oldToggle = content.props.onToggle, oldSelection = entries[2].content.props.selection;
  window.configure(null); assert.equal(guard.isProfileSessionCurrent(oldSelection.isCurrent), false);
  window.configure({ view: 'closed' }); await tick(); assert.equal(guard.isProfileSessionCurrent(oldSelection.isCurrent), false);
  const fresh = render(); assert.equal(fresh.props.state.expanded, false); await tick(); oldToggle(); assert.equal(reads.length, 1);
  entries[2].content.props.close(); fresh.props.onToggle(); assert.equal(reads.length, 2);
  h.unmount('bound'); await tick(); reads[1].resolve(detail); await tick(); assert.equal(guard.isProfileSessionCurrent(reads[1].witness), false); window.dispose();
});
test('prepared owner rejects an observed same-object scope ABA before creating a history read', async () => {
  const h = hooks(), value = session(), original = summary(), auth = { activeSessionToken: candidate => candidate.token,
    subscribeSessionWitness: () => () => {}, sessionWitnessVersion: () => 1 }, isCurrent = () => true;
  const window = new Window({ isCurrent, request: { view: 'closed' }, read: async () => page(original) }); window.start(); await tick();
  let reads = 0; const Owner = load('admin/AdminClosedHistoryOwner.tsx', { react: h.react, '../auth': auth, '../nativeSheet': { useNativeSheet: () => ({}) },
    '../shared/profileSessionGuard': guard, './AdminClosedHistoryContent': { AdminClosedHistoryContent: 'Content' }, './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' },
    './adminClosedHistoryAccountWitness': { adminClosedHistoryAccountWitness: accountFactory(auth) }, './adminClosedHistoryController': { AdminClosedHistoryController: History },
    './adminWorkMapClosedModel': closed, './adminWorkMapReader': { adminWorkMapClosedDetailReader: () => () => { reads++; return Promise.resolve(original); } },
  }).AdminClosedHistoryOwner;
  const props = { session: value, isCurrent, window, summary: original, catalog: [], logSheet: { open() {} } };
  assert.ok(h.render('outer', Owner, props)); value.profile.ref = 'other'; assert.equal(h.render('outer', Owner, props), null);
  value.profile.ref = 'me'; assert.equal(h.render('outer', Owner, props), null); assert.equal(reads, 0); window.dispose();
});
test('prepared owner derives only its own displayed row and preserves its position in the full Closed window', async () => {
  const h = hooks(), value = session(), first = summary(), second = { ...summary(), order_id: 'o2', order_number: '18' }, isCurrent = () => true, sizes = [];
  const window = new Window({ isCurrent, request: { view: 'closed' }, read: async () => ({ ...page(first), length: 2, total: 2, closed_orders: [first, second] }) });
  window.start(); await tick(); const auth = { activeSessionToken: candidate => candidate.token, subscribeSessionWitness: () => () => {}, sessionWitnessVersion: () => 1 };
  const Owner = load('admin/AdminClosedHistoryOwner.tsx', { react: h.react, '../auth': auth, '../nativeSheet': { useNativeSheet: () => ({}) },
    '../shared/profileSessionGuard': guard, './AdminClosedHistoryContent': { AdminClosedHistoryContent: 'Content' }, './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' },
    './adminClosedHistoryAccountWitness': { adminClosedHistoryAccountWitness: accountFactory(auth) }, './adminClosedHistoryController': { AdminClosedHistoryController: History },
    './adminWorkMapClosedModel': { ...closed, adminWorkMapClosedRows: rows => { sizes.push(rows.length); return closed.adminWorkMapClosedRows(rows); } },
    './adminWorkMapReader': { adminWorkMapClosedDetailReader: () => () => { throw Error('unexpected read'); } },
  }).AdminClosedHistoryOwner;
  const outer = h.render('outer', Owner, { session: value, isCurrent, window, summary: second, catalog: [], logSheet: { open() {} } });
  const content = h.render('bound', outer.type, outer.props); assert.equal(content.props.row.position, '2'); assert.equal(content.props.row.id, 'o2'); assert.deepEqual(sizes, [1]);
  h.unmount('bound'); await tick(); window.dispose();
});
test('actual guarded Closed reader accepts the owner account/row composition and retires body-time changes', async () => {
  for (const change of ['none', 'account', 'window']) {
    const value = session(), original = summary(), auth = { activeSessionToken: candidate => candidate === value ? candidate.token : null };
    const window = new Window({ isCurrent: () => true, request: { view: 'closed' }, read: async () => page(original) }); window.start(); await tick();
    const ticket = window.closedHistoryTicket(original), account = accountFactory(auth)(value, () => true), body = deferred(), sent = [];
    const request = load('admin/adminProductionRequest.ts', { '../authorizedFetch': { authorizedFetch: async (_session, url, _init, check) => {
      check(); sent.push(url); return { status: 200, json: () => body.promise };
    } }, '../shared/mobileApiException': mobile, '../workerControlsApi': { productionMapResponseError: () => Error('unused') } });
    const closedApi = load('admin/adminClosedOrderDetailApi.ts', { './adminProductionRequest': request, '../workerClosedOrders': { closedProductionOrderFromJson: item => item } });
    const reader = load('admin/adminWorkMapReader.ts', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes, '../shared/profileSessionGuard': guard,
      '../shared/mobileApiException': mobile, '../apparatusApi': {}, '../productionOrderPageApi': {}, '../productionOrderDetailApi': {}, '../pendingOrderApi': {},
      './adminProductionRequest': request, './adminWorkMapMetadataModel': {}, './adminWorkMapOrderWeight': {}, './dartJsonString': dart,
      './adminOrderSummaryApi': {}, './adminClosedOrderDetailApi': closedApi }).adminWorkMapClosedDetailReader;
    const history = new History(ticket, { isCurrent: account, rowIsCurrent: candidate => window.closedHistoryIsCurrent(candidate) && window.getSnapshot().closed.includes(original),
      read: (id, witness) => reader(value, witness)(id) });
    history.toggle(); await tick(); assert.equal(sent.length, 1); assert.ok(sent[0].includes('closed-order?id=o'));
    if (change === 'account') value.profile.ref = 'other'; else if (change === 'window') window.configure(null);
    const log = { event_id: 'e', created_at_unix: 0 }, detail = { ...original, logs: [log] }; body.resolve(detail); await tick();
    if (change === 'none') { assert.equal(history.getSnapshot().detail, detail); assert.equal(guard.isProfileSessionCurrent(history.captureLog(detail, log).isCurrent), true); }
    else { assert.equal(history.getSnapshot().detail, null); assert.equal(history.captureLog(detail, log), null); }
    if (change === 'account') { value.profile.ref = 'me'; assert.equal(history.getSnapshot().detail, null); }
    if (change === 'window') { window.configure({ view: 'closed' }); await tick(); assert.equal(history.getSnapshot().detail, null); }
    history.dispose(); window.dispose();
  }
});

test('two actual Closed row owners share one native route and an old retirement cannot pop the newer row', async () => {
  const h = hooks(), value = session(), first = summary(), second = { ...summary(), order_id: 'o2', order_number: '18' }, isCurrent = () => true;
  const window = new Window({ isCurrent, request: { view: 'closed' }, read: async () => ({ ...page(first), length: 2, total: 2, closed_orders: [first, second] }) });
  window.start(); await tick();
  const queued = [], stack = [], popped = [], unmount = new Map();
  const native = load('nativeSheet.tsx', { react: h.react, 'expo-router': { router: { push: route => queued.push(route.params.id) } },
    './components/WorkerSecurity': { SecurityContext: {} } });
  const sheet = h.render('screen', native.useNativeSheet);
  const logSheet = load('admin/AdminClosedLogSheetOwner.tsx', { react: h.react, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/profileSessionGuard': guard, './AdminClosedLogBoundary': { AdminClosedLogBoundary: 'Boundary' } }).createAdminClosedLogSheetOwner(sheet);
  const auth = { activeSessionToken: candidate => candidate.token, subscribeSessionWitness: () => () => {}, sessionWitnessVersion: () => 1 };
  const logs = { o: { event_id: 'a', created_at_unix: 0 }, o2: { event_id: 'b', created_at_unix: 0 } };
  const details = { o: { ...first, logs: [logs.o] }, o2: { ...second, logs: [logs.o2] } };
  const Owner = load('admin/AdminClosedHistoryOwner.tsx', { react: h.react, '../auth': auth, '../shared/profileSessionGuard': guard,
    './AdminClosedHistoryContent': { AdminClosedHistoryContent: 'Content' }, './adminClosedHistoryAccountWitness': { adminClosedHistoryAccountWitness: accountFactory(auth) },
    './adminClosedHistoryController': { AdminClosedHistoryController: History }, './adminWorkMapClosedModel': closed,
    './adminWorkMapReader': { adminWorkMapClosedDetailReader: () => async id => details[id] } }).AdminClosedHistoryOwner;
  const render = (id, item) => { const outer = h.render('outer-' + id, Owner, { session: value, isCurrent, window, summary: item, catalog: [], logSheet });
    return h.render('bound-' + id, outer.type, outer.props); };
  const mount = () => { const id = queued.shift(); stack.push(id); unmount.set(id, native.mountNativeSheet(id, () => {
    const top = stack.pop(); popped.push([id, top]); unmount.get(top)?.(); unmount.delete(top);
  })); return id; };
  let rowA = render('A', first), rowB = render('B', second); rowA.props.onToggle(); rowB.props.onToggle(); await tick();
  rowA = render('A', first); rowB = render('B', second);
  rowA.props.onLog(details.o, logs.o); rowB.props.onLog(details.o2, logs.o2); assert.equal(queued.length, 1);
  const a = mount(), oldClose = native.getNativeSheet(a).content.props.close;
  native.closeNativeSheet(a); await tick(); rowB.props.onLog(details.o2, logs.o2); assert.equal(queued.length, 1);
  const b = mount(); rowA.props.onToggle(); oldClose(); assert.deepEqual(stack, [b]); assert.equal(native.getNativeSheet(b).closing, false);
  native.closeNativeSheet(b); await tick(); assert.deepEqual(popped, [[a, a], [b, b]]);
  h.unmount('bound-A'); h.unmount('bound-B'); h.unmount('screen'); window.dispose(); await tick();
});
