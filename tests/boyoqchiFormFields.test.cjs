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
let fieldFocus = false;
const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiFormContent.tsx'), loaded = new Module(filename, module);
const mocks = {
  'react/jsx-runtime': jsx, react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value === false ? fieldFocus : value, next => { if (typeof next === 'boolean') fieldFocus = next; }] },
  '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ value, set() {} }) },
  'react-native': { BackHandler: {}, Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    StyleSheet: { create: value => value, absoluteFill: {} } },
  '../components/WorkerIconButton': {}, './BoyoqchiUsageSwipe': { BoyoqchiUsageSwipe: 'BoyoqchiUsageSwipe' }, './BoyoqchiPaintPalette': {}, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
  '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { outlineVariant: '#theme-outline' } }) }, '../components/useWorkerColors': { useWorkerColors: () => ({ muted: 'gray', surface: 'white' }) }, '../workerOrderLogic': { paintOptions: [] },
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


test('paint fields use pinned V2 border colors and focus thickness without changing dialog fields', () => {
  const expected = { Mix: '#8A6A4A', '1w Oq': '#C9B9AA', '7w Oq': '#C9B9AA', Qora: '#202124',
    Sariq: '#E0B52D', Qizil: '#E53935', 'Ko‘k': '#1E88E5', Spirt: '#6AAED6',
    'Mix+': '#8A6A4A', 'Pantone+': '#8E6BBE', 'Pantone Blue': '#theme-outline' };
  for (const [label, color] of Object.entries(expected)) {
    fieldFocus = false;
    const get = () => nodes(Field({ label, paintField: true, outlineColor: '#theme-outline', decimal: true, onChange() {} }), node => node.type === 'TextInput')[0];
    let input = get();
    assert.equal(input.props.style.borderColor, color);
    assert.equal(input.props.style.borderWidth, 1.2);
    assert.equal(input.props.style.borderRadius, 12);
    input.props.onFocus(); input = get(); assert.equal(input.props.style.borderWidth, 1.8);
    input.props.onBlur(); input = get(); assert.equal(input.props.style.borderWidth, 1.2);
  }
  const dialog = NamedFieldDialog({ paint: 'Pantone', close() {}, add() {} });
  for (const field of nodes(dialog, node => node.type === Field)) {
    assert.equal(nodes(Field(field.props), node => node.type === 'TextInput')[0].props.style, undefined);
  }
});


test('unlisted paint labels fall back safely if no theme outline is supplied', () => {
  const field = Field({ label: 'Custom', paintField: true, onChange() {} });
  assert.equal(nodes(field, node => node.type === 'TextInput')[0].props.style.borderColor, 'gray');
});
