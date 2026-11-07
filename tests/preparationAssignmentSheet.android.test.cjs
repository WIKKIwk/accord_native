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
    'react-native-safe-area-context': {}, './PreparationUI.android': { usePreparationText: () => value => value, PreparationText: 'PreparationText' } };
  const { AssignmentSheet } = load('preparation/PreparationMaterials.android.tsx', mocks, '\nexport { AssignmentSheet };\n');
  const props = { name: 'BOPP', choices: [{ name: 'Own', selected: true, editable: true }, { name: 'Other', selected: false, editable: true },
    { name: 'Locked', selected: true, editable: false }], save: value => { saved = value; } };
  let tree = AssignmentSheet(props), boxes = nodes(tree, node => node.type === 'Checkbox'), button = nodes(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.enabled, false); assert.equal(boxes[2].props.enabled, false);
  assert.ok(button.props.modifiers.some(value => value.name === 'height' && value.args[0] === 56));
  boxes[1].props.onCheckedChange(true);
  tree = AssignmentSheet(props); button = nodes(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.enabled, true); button.props.onClick(); assert.deepEqual(saved, ['Locked', 'Other', 'Own']);
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
