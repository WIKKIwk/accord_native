const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function fixture() {
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiFormContent.tsx'), loaded = new Module(filename, module);
  const hooks = [], busyChanges = []; let cursor = 0, back, closes = 0, saves = 0, resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const react = {
    useState: initial => { const i = cursor++; if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value; }]; },
    useRef: initial => { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); },
    useEffect: (effect, deps) => { const i = cursor++, prior = hooks[i];
      if (prior && deps?.length === prior.deps?.length && deps.every((value, j) => Object.is(value, prior.deps[j]))) return;
      prior?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; },
  };
  const mocks = {
    'react/jsx-runtime': jsx, react,
    '@expo/ui': { Host: 'Host', Button: 'Button', RNHostView: 'RNHostView', TextInput: 'TextInput', useNativeState: value => ({ value, set() {} }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss() {} }, BackHandler: { addEventListener: (_event, callback) => { back = callback; return { remove() {} }; } },
      Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, './BoyoqchiPaintPalette': { BoyoqchiPaintPalette: 'BoyoqchiPaintPalette' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../workerOrderLogic': { paintOptions: [] }, './BoyoqchiImage': { BoyoqchiImage: 'BoyoqchiImage' },
    './boyoqchiLogic': { boyoqchiInputAllowed: () => true, boyoqchiSaveInput: () => ({ items: [{ name: 'paint' }], error: '' }) },
    './returnedPaintModel': {}, './useBoyoqchiText': { useBoyoqchiText: () => value => value },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const draft = { selectedUsageIndex: 0, image: null, fieldLabelsFor: () => [], valuesFor: () => [] };
  const render = () => { cursor = 0; return loaded.exports.BoyoqchiFormContent({ session: {}, draft, close: () => { closes++; },
    onBusyChange: value => busyChanges.push(value), save: () => { saves++; return pending; } }); };
  return { render, busyChanges, back: () => back(), closes: () => closes, saves: () => saves, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function saveButton(tree) { return nodes(tree, node => node.type === 'WorkerSheetButton' && node.props.label === 'Saqlash')[0]; }

test('pending save shows a disabled spinner, blocks back and duplicate saves, then closes after success', async () => {
  const f = fixture(), idle = f.render(), press = saveButton(idle).props.onPress;
  press(); press(); assert.equal(f.saves(), 1);
  const busy = f.render();
  assert.equal(nodes(busy, node => node.type === 'ActivityIndicator').length, 1);
  assert.equal(nodes(busy, node => node.type === 'Button' && node.props.disabled === true).length, 1);
  assert.equal(saveButton(busy), undefined); assert.equal(f.back(), true);
  assert.deepEqual(f.busyChanges, [true]);
  f.resolve(); await tick();
  assert.equal(f.closes(), 1); assert.equal(f.back(), false); assert.deepEqual(f.busyChanges, [true, false]);
  assert.ok(saveButton(f.render()));
});

test('rejected save removes spinner, restores dismissal and shows the existing error', async () => {
  const f = fixture(), idle = f.render();
  saveButton(idle).props.onPress(); f.render();
  f.reject(new Error('offline')); await tick();
  const failed = f.render();
  assert.equal(nodes(failed, node => node.type === 'ActivityIndicator').length, 0);
  assert.ok(saveButton(failed)); assert.equal(f.closes(), 0); assert.equal(f.back(), false);
  assert.deepEqual(f.busyChanges, [true, false]);
  assert.ok(nodes(failed, node => node.type === 'Text' && node.props.children === 'Qaytarilgan bo‘yoq saqlanmadi').length);
});

test('uncertain completion visibly asks the user to refresh and reconcile without automatic resubmission', async () => {
  const f = fixture(), idle = f.render(); saveButton(idle).props.onPress(); f.render();
  const failure = new Error('Saqlash natijasi aniq emas. Ro‘yxatni yangilab, hisobotni tekshiring.');
  failure.name = 'ReturnedPaintReconciliationError'; f.reject(failure); await tick();
  const failed = f.render();
  assert.ok(nodes(failed, node => node.type === 'Text' && node.props.children === failure.message).length);
  assert.equal(f.saves(), 1); assert.equal(f.closes(), 0); assert.equal(f.back(), false);
});

test('demo-unavailable completion error is shown without automatic resubmission', async () => {
  const f = fixture(), idle = f.render(); saveButton(idle).props.onPress(); f.render();
  const failure = new Error('Demo rejimi hozircha mavjud emas.'); failure.name = 'BoyoqchiDemoUnavailableError';
  f.reject(failure); await tick(); const failed = f.render();
  assert.ok(nodes(failed, node => node.type === 'Text' && node.props.children === failure.message).length);
  assert.equal(f.saves(), 1); assert.equal(f.closes(), 0);
});
