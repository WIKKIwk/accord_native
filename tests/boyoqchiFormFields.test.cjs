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
const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiFormContent.tsx'), loaded = new Module(filename, module);
const mocks = {
  'react/jsx-runtime': jsx, react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
  '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ value, set() {} }) },
  'react-native': { BackHandler: {}, Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    StyleSheet: { create: value => value, absoluteFill: {} } },
  '../components/WorkerIconButton': {}, '../components/WorkerPaintPalette': {}, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
  '../components/useWorkerColors': { useWorkerColors: () => ({ muted: 'gray', surface: 'white' }) }, '../workerOrderLogic': { paintOptions: [] },
  './BoyoqchiImage': {}, './boyoqchiLogic': { boyoqchiInputAllowed: () => true }, './returnedPaintModel': { returnedPaintDouble: () => 0 },
  './useBoyoqchiText': { useBoyoqchiText: () => value => value },
};
loaded.filename = filename; loaded.paths = module.paths;
loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
loaded._compile(`${compiled}\nmodule.exports.__Field = Field; module.exports.__NamedFieldDialog = NamedFieldDialog;`, filename);
const { __Field: Field, __NamedFieldDialog: NamedFieldDialog } = loaded.exports;

test('ordinary and Pantone numeric fields show one label without repeating it as a placeholder', () => {
  for (const label of ['Mix', 'Pantone Blue']) {
    const tree = Field({ label, decimal: true, onChange() {} });
    const labels = nodes(tree, node => node.type === 'Text' && node.props.children === label);
    const input = nodes(tree, node => node.type === 'TextInput')[0];
    assert.equal(labels.length, 1); assert.equal(input.props.accessibilityLabel, label);
    assert.equal(input.props.placeholder, undefined);
  }
});

test('named-field dialog retains its exact explicit name and value hints', () => {
  const dialog = NamedFieldDialog({ paint: 'Pantone', close() {}, add() {} });
  const fields = nodes(dialog, node => node.type === Field);
  assert.deepEqual(fields.map(field => [field.props.label, field.props.placeholder]), [
    ['Majburiy nom', 'Masalan: Pantone Blue'], ['Qiymat', 'Masalan: 12.5'],
  ]);
  assert.deepEqual(fields.map(field => nodes(Field(field.props), node => node.type === 'TextInput')[0].props.placeholder),
    ['Masalan: Pantone Blue', 'Masalan: 12.5']);
});
