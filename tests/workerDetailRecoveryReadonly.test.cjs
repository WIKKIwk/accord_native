const assert = require('node:assert/strict'), test = require('node:test');
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), ts = require('typescript');
function load(name, mocks) {
  const filename = path.resolve(__dirname, '../src', name), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const { WorkerDetailRecovery } = load('workerDetailRecovery.ts', {});
const wait = () => new Promise(resolve => setTimeout(resolve, 5));
const pending = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(read) {
  const hooks = [], effects = []; let cursor = 0, dirty = false;
  const react = { useContext: () => null, useRef: value => { const index = cursor++; return hooks[index] ?? (hooks[index] = { current: value }); },
    useState: value => { const index = cursor++; hooks[index] ??= { value }; return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; dirty = true; }]; },
    useEffect: (run, deps) => { const index = cursor++, before = hooks[index];
      if (!before || deps.some((value, i) => value !== before.deps[i])) effects.push(() => { before?.cleanup?.(); hooks[index] = { deps, cleanup: run() }; }); } };
  react.useLayoutEffect = react.useEffect;
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = load('components/WorkerOrderDetails.tsx', {
    react, 'react/jsx-runtime': jsx, '@expo/ui': { Button: 'Button', Column: 'Column', Host: 'Host', ListItem: 'ListItem' },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    '../auth': { activeSessionToken: session => session.token }, '../sessionReadScope': { sessionReadScope: session => session.scope },
    '../workerDetailRecovery': { WorkerDetailRecovery }, '../workerDetailRecoveryRead': { readWorkerDetailSnapshot: read },
    '../workerOrderPresentation': { workerOrderPresentationDenied: error => error.statusCode === 403 },
    '../workerApi': { workerOrderDetailFromSnapshot: value => ({ map: value.maps[0].map, customer: '', stages: [] }) },
    './WorkerOrderSyncProgress': { WorkerOrderSyncProgress: 'SyncProgress' }, './useWorkerColors': { useWorkerColors: () => ({}) },
    './WorkerOrderHeader': { WorkerOrderHeader: 'Header', WorkerOrderImage: 'Image' }, './WorkerIconButton': {},
    './WorkerOrderOverview': { WorkerOrderOverview: 'Overview' }, './workerSheetContext': { WorkerSheetCloseContext: {} },
  }).WorkerOrderDetails;
  const props = { session: { token: 'token', scope: 'scope' }, apparatusId: 'press', order: { id: 'order', code: '0198', title: 'Row preview' }, queueCursor: { epoch: 'epoch', rev: 1 }, queueWindow: 'ten', onClose() {} };
  const render = () => { let tree; do { dirty = false; cursor = 0; tree = component(props); while (effects.length) effects.shift()(); } while (dirty); return tree; };
  return { props, render, close: () => { hooks.forEach(hook => hook?.cleanup?.()); } };
}
function node(tree, type) { if (!tree || typeof tree !== 'object') return null; if (Array.isArray(tree)) return tree.map(value => node(value, type)).find(Boolean); return tree.type === type ? tree : node(tree.props?.children, type); }
test('actual read-only sheet displays preview before first GET then retains hydrated detail while new list revision loads', async () => {
  const first = pending(), second = pending(); let reads = 0;
  const h = fixture(() => (++reads === 1 ? first : second).promise);
  try {
    assert.equal(node(h.render(), 'Overview').props.title, 'Row preview'); await wait();
    first.resolve({ maps: [{ map: { title: 'Full scoped map' } }] }); await wait();
    assert.equal(node(h.render(), 'Overview').props.title, 'Full scoped map');
    h.props.queueCursor = { epoch: 'epoch', rev: 2 }; h.props.queueWindow = 'twenty';
    assert.equal(node(h.render(), 'Overview').props.title, 'Full scoped map'); await wait(); assert.equal(reads, 2);
    second.resolve({ maps: [{ map: { title: 'Fresh scoped map' } }] }); await wait();
    assert.equal(node(h.render(), 'Overview').props.title, 'Fresh scoped map');
  } finally { h.close(); }
});
test('actual read-only initial failure keeps error and Retry, without automatic polling', async () => {
  let reads = 0; const h = fixture(async () => { reads++; throw Error('Initial detail failed'); });
  try { h.render(); await wait(); const tree = h.render(); assert.equal(node(tree, 'Overview').props.title, 'Row preview');
    assert.equal(node(tree, 'Button').props.label, 'Qayta urinish'); await wait(); assert.equal(reads, 1);
  } finally { h.close(); }
});
