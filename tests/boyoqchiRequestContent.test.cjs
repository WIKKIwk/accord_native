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
function load(relative, mocks = {}, extra = '') {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + extra, filename);
  return loaded.exports;
}
const logic = load('boyoqchi/boyoqchiLogic.ts', { './returnedPaintModel': { returnedPaintDouble: raw => Number(raw) } });
const { BoyoqchiRequestContent, __Row: Row } = load('boyoqchi/BoyoqchiRequestContent.tsx', {
  'react-native': { StyleSheet: { create: value => value, hairlineWidth: 1 }, Text: 'Text', View: 'View' },
  '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
  '../components/useWorkerColors': { useWorkerColors: () => ({ text: 'text', field: 'field' }) },
  './boyoqchiLogic': logic, './BoyoqchiImage': { BoyoqchiImage: 'BoyoqchiImage' },
  './useBoyoqchiText': { useBoyoqchiText: () => value => value },
}, '\nmodule.exports.__Row = Row;');
const request = { order_name: 'Name', order_code: '42', order_id: 'id', sender_display_name: 'Operator', sender_ref: 'ref',
  apparatus: 'press', created_at: new Date(2026, 0, 2), status: 'waiting_for_boyoqchi_input', image: null,
  items: [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { Mix: '1.250' } }] };

test('Home metadata uses V2 fixed label width and left-aligned values while item names stay bold', () => {
  const tree = BoyoqchiRequestContent({ session: {}, request, home: true, apparatus: [], onEdit() {} });
  const metadata = nodes(tree, n => n.type === Row); assert.deepEqual(metadata.map(n => n.props.label), ['Order', 'Operator', 'Time', 'Location']);
  for (const item of metadata) {
    const rendered = Row(item.props), texts = nodes(rendered, n => n.type === 'Text');
    assert.equal(rendered.props.style[1].gap, 0);
    assert.equal(texts[0].props.style[0].width, 74);
    assert.equal(texts[1].props.style[1].textAlign, 'left');
  }
  const rich = nodes(tree, n => n.type === 'Text' && Array.isArray(n.props.children) && n.props.children[0]?.props?.children === 'Oq')[0];
  assert.equal(rich.props.children[0].props.style.fontWeight, '700');
  assert.equal(rich.props.children[1], ': Mix — 1.25');
});

test('waiting Astatka retains split metadata and opens the existing paint form with a palette icon', () => {
  let opened = 0;
  const tree = BoyoqchiRequestContent({ session: {}, request, home: false, apparatus: [], onEdit: () => opened++ });
  const row = nodes(tree, n => n.type === Row)[0]; const texts = nodes(Row(row.props), n => n.type === 'Text');
  assert.equal(texts[0].props.style[0].flex, 1); assert.equal(texts[1].props.style[1].textAlign, 'right');
  assert.equal(texts[1].props.style[1].fontWeight, '800');
  const button = nodes(tree, n => n.type === 'WorkerSheetButton')[0];
  assert.deepEqual(button.props.icon, { ios: 'paintpalette', android: 'palette' });
  button.props.onPress(); assert.equal(opened, 1);
  const done = BoyoqchiRequestContent({ session: {}, request: { ...request, status: 'done' }, home: false, apparatus: [], onEdit() {} });
  assert.equal(nodes(done, n => n.type === 'WorkerSheetButton').length, 0);
});
