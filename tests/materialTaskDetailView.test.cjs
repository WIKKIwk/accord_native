const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.tsx`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function sheetSetup() {
  const session = { token: 'normal', profile: { role: 'material_taminotchi' } }, witness = { session }, listeners = new Set(), calls = [];
  let valid = true, permitted = true, open = false, stored, cleanup;
  const sheet = { isOpen: () => open, open: (content, options) => { open = true; stored = { content, options }; calls.push('open'); },
    close: () => { open = false; calls.push('close'); } };
  const hooks = { useCallback: value => value, useRef: value => ({ current: value }), useEffect: effect => { cleanup = effect(); } };
  const { useMaterialTaskDetail } = compile('material/useMaterialTaskDetail', { 'react/jsx-runtime': jsx, react: hooks,
    '../auth': { isSessionWitnessCurrent: value => value === witness && valid,
      subscribeSessionWitness: fn => { listeners.add(fn); return () => listeners.delete(fn); } }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/appRoutes': { appRoutes: { materialTasks: 'task' }, canOpenRoute: () => permitted },
    '../shared/camera/synchronousGuard': { isSynchronouslyTrue: fn => { try { return fn() === true; } catch { return false; } } },
    './MaterialTaskDetail': { MaterialTaskDetail: 'MaterialTaskDetail' }, './materialTestSession': { isMaterialTestSession: value => value.token === 'test-mode-token' } });
  const show = useMaterialTaskDetail(session, witness);
  return { session, witness, calls, show, stored: () => stored, cleanup: () => cleanup(),
    invalidate: () => { valid = false; listeners.forEach(fn => fn()); }, deny: () => { permitted = false; listeners.forEach(fn => fn()); } };
}
test('valid row opens the existing non-dismissible sheet with a distinct modal lifetime', async () => {
  const h = sheetSetup(); let selected = true; const row = { id: 'one' };
  const pending = h.show(row, () => selected); assert.equal(h.calls[0], 'open'); const { content, options } = h.stored();
  assert.equal(content.type, 'MaterialTaskDetail'); assert.equal(content.props.row, row); assert.equal(options.dismissible, false);
  // Opening the root modal blurs/disposes the list, but the already-authorized read-only detail keeps its own lifetime.
  selected = false; assert.equal(content.props.isCurrent(), true); content.props.onClose(); await pending;
  assert.equal(content.props.isCurrent(), false); assert.deepEqual(h.calls, ['open', 'close']); options.onDismiss();
  assert.deepEqual(h.calls, ['open', 'close']); h.cleanup();
});
test('stale selection, test token, bad role or permission opens no sheet', () => {
  for (const change of ['selection', 'test-token', 'role', 'permission']) {
    const h = sheetSetup(); if (change === 'test-token') h.session.token = 'test-mode-token';
    if (change === 'role') h.session.profile.role = 'admin'; if (change === 'permission') h.deny();
    assert.equal(h.show({ id: 'one' }, () => change !== 'selection'), undefined); assert.deepEqual(h.calls, []); h.cleanup();
  }
});
test('session transition or unmount closes detail and invalidates late callbacks', async () => {
  for (const change of ['transition', 'unmount']) {
    const h = sheetSetup(), pending = h.show({ id: 'one' }, () => true), content = h.stored().content;
    if (change === 'transition') h.invalidate(); else h.cleanup(); await pending;
    assert.equal(content.props.isCurrent(), false); assert.deepEqual(h.calls, ['open', 'close']);
    content.props.onClose(); h.stored().options.onDismiss(); assert.deepEqual(h.calls, ['open', 'close']);
  }
});
test('only one detail opens while a sheet is already active', async () => {
  const h = sheetSetup(), pending = h.show({ id: 'one' }, () => true);
  assert.equal(h.show({ id: 'two' }, () => true), undefined); h.stored().options.onDismiss(); await pending;
  assert.deepEqual(h.calls, ['open']); h.cleanup();
});

function bodySetup() {
  const session = {}, witness = { session }, row = { id: 'one', code: 'C1', order_number: '', title: 'Summary', customer_name: 'Customer' };
  const effects = [], slots = [], calls = []; let cursor = 0, current = true, pending = null;
  const react = { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useEffect: fn => { effects.push(fn); }, useSyncExternalStore: (_s, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, 'react-native': { ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../auth': { sessionWitnessVersion: () => 1, subscribeSessionWitness: () => () => {} },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerOrderOverview': { WorkerOrderOverview: 'WorkerOrderOverview' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../shared/camera/synchronousGuard': { isSynchronouslyTrue: fn => fn() === true },
    './materialTaskDetailApi': { readMaterialTaskDetail: (_s, _w, _r, guard) => { calls.push(guard); return pending; } } };
  const view = compile('material/MaterialTaskDetail', mocks).MaterialTaskDetail;
  return { session, witness, row, effects, calls, setPending: value => { pending = value; }, setCurrent: value => { current = value; },
    render: () => { cursor = 0; return view({ session, witness, row, isCurrent: () => current, onClose: () => calls.push('close') }); } };
}
test('detail reuses the native order overview after full data loads', async () => {
  const h = bodySetup(); h.setPending(Promise.resolve({ map: { id: 'one', code: 'FULL', title: 'Full order', customer_name: 'Buyer' } }));
  const loading = h.render(); assert.equal(nodes(loading, 'ActivityIndicator').length, 1); h.effects.shift()(); await new Promise(resolve => setImmediate(resolve));
  const ready = h.render(), summary = nodes(ready, 'WorkerOrderOverview')[0]; assert.ok(summary); assert.equal(summary.props.code, 'FULL');
  assert.equal(summary.props.detail.customer, 'Buyer'); assert.deepEqual(summary.props.detail.stages, []);
  nodes(ready, 'WorkerIconButton')[0].props.onPress(); assert.equal(h.calls.at(-1), 'close');
});
test('detail shows retry on read failure and hides after lifetime expires', async () => {
  const h = bodySetup(); h.setPending(Promise.reject(Error('network'))); h.render(); h.effects.shift()(); await new Promise(resolve => setImmediate(resolve));
  const failed = h.render(), retry = nodes(failed, 'WorkerSheetButton')[0]; assert.ok(retry); retry.props.onPress();
  assert.equal(nodes(h.render(), 'ActivityIndicator').length, 1); h.setCurrent(false); assert.equal(h.render(), null);
});
