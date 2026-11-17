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
  const calls = [], session = {}, witness = { session }, row = { id: 'one' };
  const model = { current: () => true, order: null, shown: null, code: 'FULL', title: 'Full order', customer: 'Buyer', imageId: 'image',
    materials: { value: [], loading: false, error: '' }, molds: { value: [], loading: false, error: '' }, moldItems: [],
    materialsExpanded: false, moldsExpanded: false, mapExpanded: false, mapFacts: { loading: false, error: '', value: [] }, mapRows: [],
    p: key => key, a: key => key, canReceive: true, notice: '', noticeId: 0, mapProgress: '0/2',
    retry: () => calls.push('retry'), receive: () => calls.push('receive'), toggleMaterials() {}, toggleMolds() {}, toggleMap() {},
    dismissNotice() {}, openMaterialQr: value => calls.push(['qr', value]), unlink: value => calls.push(['unlink', value]), canUnlink: () => true,
    openMoldQr: value => calls.push(['mold', value]), openStage: (...args) => calls.push(['stage', ...args]) };
  const view = compile('material/MaterialTaskDetail', {
    'react/jsx-runtime': jsx, react: { useState: value => [value, () => {}], useSyncExternalStore: (_s, get) => get() },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../auth': { sessionWitnessVersion: () => 1, subscribeSessionWitness: () => () => {} },
    '../components/WorkerExpansion': { WorkerExpansion: 'WorkerExpansion' }, '../components/WorkerMaterialList': { WorkerMaterialList: 'WorkerMaterialList' },
    '../components/WorkerOrderHeader': { WorkerOrderHeader: 'WorkerOrderHeader', WorkerOrderImage: 'WorkerOrderImage' },
    '../components/WorkerOrderOverview': { WorkerOrderOverview: 'WorkerOrderOverview' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../components/useWorkerColors': { useWorkerColors: () => ({}) }, '../customer/CustomerSnackbar': { CustomerSnackbar: 'CustomerSnackbar' },
    './useMaterialTaskDetailContent': { useMaterialTaskDetailContent: () => model },
  }).MaterialTaskDetail;
  return { calls, model, row, render: () => view({ session, witness, row, isCurrent: model.current, onClose: () => calls.push('close') }) };
}
test('detail renders the shared native information summary and full-order image identity', () => {
  const h = bodySetup(); assert.equal(nodes(h.render(), 'ActivityIndicator').length, 1);
  h.model.order = { map: { id: 'one' } }; h.model.shown = { order: h.model.order };
  const ready = h.render(), summary = nodes(ready, 'WorkerOrderOverview')[0];
  assert.equal(summary.props.code, 'FULL'); assert.equal(summary.props.summaryKind, 'information');
  assert.equal(summary.props.detail.customer, 'Buyer'); assert.deepEqual(summary.props.detail.stages, []);
  nodes(ready, 'WorkerOrderHeader')[0].props.onClose(); assert.equal(h.calls.at(-1), 'close');
  nodes(ready, 'WorkerSheetButton').find(node => node.props.label === 'action.assign').props.onPress();
  assert.equal(h.calls.at(-1), 'receive');
});
test('detail renders native assigned-material balance/unlink controls and readonly mold QR', () => {
  const h = bodySetup(), material = { barcode: 'R' }, mold = { qolip_code: 'Q' };
  h.model.order = { map: {} }; h.model.shown = { order: h.model.order };
  h.model.materials.value = [material]; h.model.materialsExpanded = true;
  h.model.molds.value = [mold]; h.model.moldsExpanded = true; h.model.moldItems = [{ product: mold, details: 'Blue', color: null }];
  const tree = h.render(), list = nodes(tree, 'WorkerMaterialList')[0];
  assert.equal(list.props.showBalances, undefined, 'existing aggregate balance display stays enabled');
  list.props.onUnlink(material); list.props.onLongPress(material);
  assert.deepEqual(h.calls.slice(-2), [['unlink', material], ['qr', material]]);
  nodes(tree, 'Pressable').find(node => node.props.onLongPress).props.onLongPress();
  assert.deepEqual(h.calls.at(-1), ['mold', mold]);
});
test('detail renders retry on read failure and hides after its original lifetime expires', () => {
  const h = bodySetup(); h.model.shown = { order: null, error: 'network' };
  nodes(h.render(), 'WorkerSheetButton')[0].props.onPress(); assert.equal(h.calls.at(-1), 'retry');
  h.model.current = () => false; assert.equal(h.render(), null);
});
