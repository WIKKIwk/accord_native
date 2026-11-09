const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
test('unconnected Closed log sheet renders every source model section in order, with selectable IDs and QR text', () => {
  const Sheet = load('admin/AdminClosedLogSheet.tsx', { 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 }, Text: 'Text', View: 'View' },
    '../components/useWorkerColors': { useWorkerColors: () => ({ background: 'bg', surface: 'surface', text: 'text', muted: 'muted', icon: 'icon' }) } }).AdminClosedLogSheet;
  const model = { title: 'Transfer', apparatus: 'Print → Cut', icon: 'transfer', sections: [
    { id: 'event', title: 'Event details', fields: [{ label: 'Event', value: 'Transfer' }, { label: 'Event ID', value: 'evt', selectable: true }] },
    { id: 'freeze', title: 'Freeze', fields: [{ label: 'Status', value: 'Frozen' }] },
    { id: 'transfer', title: 'Transfer details', fields: [{ label: 'From', value: 'Print' }, { label: 'To', value: 'Cut' }] },
    { id: 'progress', title: 'Progress', fields: [], batches: [{ title: 'start • Print', status: 'done', fields: [{ label: 'Batch ID', value: 'b', selectable: true }],
      metrics: ['Produced: 12 kg'], note: { label: 'Note', value: 'careful' }, qr: { label: 'QR payload', payload: 'ABC', copyLabel: 'Copy', copiedText: 'Copied' } }] },
  ] };
  const tree = nodes(Sheet({ model })); assert.equal(tree[0].type, 'ScrollView'); assert.equal(tree[0].props.testID, 'admin-closed-log-sheet');
  const texts = tree.filter(value => value.type === 'Text').map(value => value.props.children);
  assert.deepEqual(texts, ['Transfer', 'Print → Cut', 'Event details', 'Event', 'Transfer', 'Event ID', 'evt', 'Freeze', 'Status', 'Frozen',
    'Transfer details', 'From', 'Print', 'To', 'Cut', 'Progress', 'start • Print', 'done', 'Batch ID', 'b', 'Produced: 12 kg', 'Note', 'careful', 'QR payload', 'ABC']);
  for (const value of ['evt', 'b', 'ABC']) assert.equal(tree.find(node => node.type === 'Text' && node.props.children === value).props.selectable, true);
  assert.equal(tree.some(node => node.props.onPress || node.props.onLongPress), false);
  assert.equal(tree.some(node => node.type === 'Text' && node.props.children === 'Copy'), false);
  assert.deepEqual(tree.find(node => node.type === 'SymbolView').props.name, { ios: 'arrow.left.arrow.right', android: 'swap_horiz' });
});
test('unconnected Closed log sheet renders zero-output metrics and the empty progress branch', () => {
  const Sheet = load('admin/AdminClosedLogSheet.tsx', { 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 }, Text: 'Text', View: 'View' },
    '../components/useWorkerColors': { useWorkerColors: () => ({ background: 'bg', surface: 'surface', text: 'text', muted: 'muted', icon: 'icon' }) } }).AdminClosedLogSheet;
  for (const content of [{ metrics: ['Total waste: 2', 'Edge waste: 0'] }, { empty: 'No progress' }]) {
    const tree = nodes(Sheet({ model: { title: 'Event', apparatus: '', icon: 'history', sections: [{ id: 'progress', title: 'Progress', fields: [], ...content }] } }));
    const values = tree.filter(value => value.type === 'Text').map(value => value.props.children);
    assert.deepEqual(values, ['Event', 'Progress', ...(content.metrics ?? [content.empty])]);
  }
});
