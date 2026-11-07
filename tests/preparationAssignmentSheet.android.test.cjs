const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, pred) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)]; }
function load(file, mocks, extra = '') {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
test('assignment keeps locked warehouses and enables the large save button only for changes', () => {
  let selected, saved;
  const react = { useState(initial) { selected ??= initial; return [selected, value => { selected = typeof value === 'function' ? value(selected) : value; }]; } };
  const modifiers = new Proxy({ Shapes: { RoundedCorner: value => value } }, { get: (object, key) => object[key] ?? ((...args) => ({ name: key, args })) });
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/jetpack-compose': { Host: 'Host', Row: 'Row', Column: 'Column', Text: 'Text',
    Checkbox: 'Checkbox', Button: 'Button', useMaterialColors: () => ({ surface: 'surface' }) }, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': {}, 'expo-symbols': {}, 'react-native': { StyleSheet: { create: value => value }, View: 'View' }, 'react-native-reanimated': {},
    'react-native-safe-area-context': {}, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './PreparationUI.android': { usePreparationText: () => value => value, PreparationText: 'PreparationText' } };
  const { AssignmentSheet } = load('preparation/PreparationMaterials.android.tsx', mocks, '\nexport { AssignmentSheet };\n');
  const props = { name: 'BOPP', choices: [{ name: 'Own', selected: true, editable: true }, { name: 'Other', selected: false, editable: true },
    { name: 'Locked', selected: true, editable: false }], save: value => { saved = value; } };
  let tree = AssignmentSheet(props), boxes = nodes(tree, node => node.type === 'Checkbox'), button = nodes(tree, node => node.type === 'Button')[0];
  const cards = nodes(tree, node => node.type === 'WorkerQueueCard');
  assert.equal(cards.length, 3); assert.equal(cards[0].props.first, true); assert.equal(cards[2].props.last, true);
  assert.equal(cards[2].props.onPress, undefined);
  assert.equal(button.props.enabled, false); assert.equal(boxes[2].props.enabled, false);
  assert.ok(button.props.modifiers.some(value => value.name === 'height' && value.args[0] === 56));
  const rows = nodes(tree, node => node.type === 'Row');
  rows[1].props.modifiers.find(value => value.name === 'clickable').args[0]();
  boxes[2].props.onCheckedChange(false);
  tree = AssignmentSheet(props); button = nodes(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.enabled, true); button.props.onClick(); assert.deepEqual(saved, ['Locked', 'Other', 'Own']);
});

test('cached choices cannot be saved until checked, and newly locked choices are retained', () => {
  let selected, saved;
  const react = { useState(initial) { selected ??= initial; return [selected, value => { selected = typeof value === 'function' ? value(selected) : value; }]; } };
  const modifiers = new Proxy({}, { get: (_object, key) => (...args) => ({ name: key, args }) });
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/jetpack-compose': { Host: 'Host', Row: 'Row', Column: 'Column', Text: 'Text',
    Checkbox: 'Checkbox', Button: 'Button', useMaterialColors: () => ({ surface: 'surface' }) }, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': {}, 'expo-symbols': {}, 'react-native': { StyleSheet: { create: value => value }, View: 'View', ActivityIndicator: 'ActivityIndicator' },
    'react-native-reanimated': {}, 'react-native-safe-area-context': {}, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './PreparationUI.android': { usePreparationText: () => value => value, PreparationText: 'PreparationText', PreparationButton: 'PreparationButton' } };
  const { AssignmentSheet } = load('preparation/PreparationMaterials.android.tsx', mocks, '\nexport { AssignmentSheet };\n');
  const cached = [{ name: 'Own', editable: true, selected: true }, { name: 'Other', editable: true, selected: false }];
  const props = { name: 'BOPP', choices: cached, loading: true, save: value => { saved = value; } };
  let tree = AssignmentSheet(props), boxes = nodes(tree, node => node.type === 'Checkbox');
  boxes[0].props.onCheckedChange(false); boxes[1].props.onCheckedChange(true);
  tree = AssignmentSheet(props);
  let button = nodes(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.enabled, false); button.props.onClick(); assert.equal(saved, undefined);
  const fresh = [{ name: 'Own', editable: false, selected: true }, { name: 'Other', editable: true, selected: false },
    { name: 'New', editable: true, selected: true }];
  tree = AssignmentSheet({ ...props, choices: fresh, loading: false });
  boxes = nodes(tree, node => node.type === 'Checkbox');
  assert.equal(boxes[0].props.value, true); assert.equal(boxes[0].props.enabled, false);
  button = nodes(tree, node => node.type === 'Button')[0]; assert.equal(button.props.enabled, true);
  button.props.onClick(); assert.deepEqual(saved, ['New', 'Other', 'Own']);
  tree = AssignmentSheet({ ...props, choices: fresh, loading: false, error: 'offline' });
  assert.equal(nodes(tree, node => node.type === 'Button')[0].props.enabled, false);
});

test('assignment sheet opens with cached choices, retries errors and ignores late responses after dismissal', async () => {
  const slots = [], effects = []; let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useEffect(effect, deps) { const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) effects.push(() => {
        old?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
      }); },
  };
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui/jetpack-compose': {}, '@expo/ui/jetpack-compose/modifiers': {},
    'expo-router': {}, 'expo-symbols': {}, 'react-native': { StyleSheet: { create: value => value } },
    'react-native-reanimated': {}, 'react-native-safe-area-context': {},
    './usePreparationMaterials': { preparationMaterialsErrorMessage: () => 'offline' } };
  const { AssignmentSheetLoader } = load('preparation/PreparationMaterials.android.tsx', mocks, '\nexport { AssignmentSheetLoader };\n');
  const cached = [{ name: 'Old', selected: true, editable: true }], fresh = [{ name: 'New', selected: false, editable: true }];
  let finish, reject, calls = 0;
  const loadChoices = () => { calls++; return new Promise((resolve, fail) => { finish = resolve; reject = fail; }); };
  const props = { name: 'BOPP', initialChoices: cached, load: loadChoices, save() {} };
  const render = () => { cursor = 0; const tree = AssignmentSheetLoader(props); while (effects.length) effects.shift()(); return tree; };
  let tree = render();
  assert.equal(tree.props.loading, true); assert.equal(tree.props.choices, cached); assert.equal(calls, 1);
  reject(new Error('offline')); await new Promise(resolve => setImmediate(resolve));
  tree = render(); assert.equal(tree.props.loading, false); assert.equal(tree.props.error, 'offline');
  tree.props.retry(); tree = render(); assert.equal(tree.props.loading, true); assert.equal(calls, 2);
  finish(fresh); await new Promise(resolve => setImmediate(resolve));
  tree = render(); assert.equal(tree.props.loading, false); assert.deepEqual(tree.props.choices, fresh);
  tree.props.retry(); render(); const lastEffect = slots.at(-1); lastEffect.cleanup();
  finish(cached); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(slots[0].value, fresh);
});

test('fit-content sheet stays capped and existing compact sheets keep their fixed height', () => {
  const sheet = Object.assign(function Sheet() {}, {});
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': { Host: 'Host', ModalBottomSheet: sheet, RNHostView: 'RNHostView' },
    'react-native': { View: 'View', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 20 }) },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'Provider' } } };
  const { WorkerOrderSheet } = load('components/WorkerOrderSheet.android.tsx', mocks);
  const render = fitContent => WorkerOrderSheet({ children: 'content', onClose() {}, compact: true, fitContent });
  let tree = render(true), view = nodes(tree, n => n.type === 'View')[0];
  assert.equal(view.props.style.maxHeight, 520); assert.equal(view.props.style.height, undefined);
  assert.equal(nodes(tree, n => n.type === 'ScrollView')[0].props.style.flexShrink, 1);
  tree = render(false); view = nodes(tree, n => n.type === 'View')[0]; assert.equal(view.props.style.height, 520);
});
