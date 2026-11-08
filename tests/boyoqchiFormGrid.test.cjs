const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function compile(relative, mocks = {}, extra = '') {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + extra, filename); return loaded.exports;
}
function fixture() {
  const hooks = []; let cursor = 0;
  const react = { useState: initial => { const i = cursor++; if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value; }]; },
    useRef: initial => { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); }, useEffect() {} };
  const { paintOptions } = compile('workerOrderLogic.ts', { './workerControlsApi': {} });
  const { ReturnedPaintDraft } = compile('boyoqchi/returnedPaintDraft.ts', { './returnedPaintModel': {} });
  const { BoyoqchiFormContent, __Field: Field, __NamedFieldDialog: NamedFieldDialog } = compile('boyoqchi/BoyoqchiFormContent.tsx', {
    react, '@expo/ui': { Host: 'Host', Button: 'Button', RNHostView: 'RNHostView', TextInput: 'TextInput', useNativeState: value => ({ set() {}, value }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', BackHandler: {}, Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView',
      Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../components/useWorkerColors': { useWorkerColors: () => ({}) }, '../workerOrderLogic': { paintOptions },
    './BoyoqchiPaintPalette': { BoyoqchiPaintPalette: 'BoyoqchiPaintPalette' }, './BoyoqchiImage': {},
    './boyoqchiLogic': { boyoqchiInputAllowed: () => true }, './returnedPaintModel': {}, './useBoyoqchiText': { useBoyoqchiText: () => value => value },
  }, '\nmodule.exports.__Field = Field; module.exports.__NamedFieldDialog = NamedFieldDialog;');
  const draft = new ReturnedPaintDraft(() => {});
  const render = () => { cursor = 0; return BoyoqchiFormContent({ session: {}, draft, close() {}, onBusyChange() {}, save: async () => {} }); };
  return { render, Field, NamedFieldDialog, choose: name => nodes(render(), n => n.type === 'BoyoqchiPaintPalette')[0].props.onSelect(name) };
}
for (const [paint, fieldCount, plus] of [['Oq',8,['Pantone+']], ['Spirtlar',5,[]], ['Mix',0,['Mix+']], ['Pantone',0,['Pantone+','Mix+']]]) {
  test(`${paint} keeps fields and add buttons in bounded two-column cells`, () => {
    const f = fixture(); f.choose(paint); const tree = f.render();
    const fields = nodes(tree, n => n.type === f.Field); assert.equal(fields.length, fieldCount);
    for (const field of fields) {
      assert.equal(field.props.paintField, true);
      const cell = f.Field(field.props); assert.equal(cell.props.style[1].maxWidth, '50%');
      assert.equal(cell.props.style[1].flexBasis, '46%');
    }
    const cells = nodes(tree, n => n.type === 'View' && n.props.children?.type === 'WorkerSheetButton' && plus.includes(n.props.children.props.label));
    assert.deepEqual(cells.map(n => n.props.children.props.label), plus);
    for (const cell of cells) {
      assert.equal(cell.props.style.maxWidth, '50%'); assert.equal(cell.props.children.props.height, 56);
      cell.props.children.props.onPress();
      const dialog = nodes(f.render(), n => n.type === f.NamedFieldDialog)[0];
      assert.equal(dialog.props.paint, paint === 'Pantone' && cell.props.children.props.label === 'Mix+' ? 'Mix' : paint);
    }
  });
}
