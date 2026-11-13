/* global __dirname */
// Source-derived layout checks; native geometry, wrapping and accessibility still need a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const Module = require('node:module'); const path = require('node:path');
const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, match) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => find(value, match));
  return [...(match(node) ? [node] : []), ...find(node.props?.children, match)];
}
const modifier = (node, kind) => node.props.modifiers?.find(item => item.kind === kind)?.args[0];
const buttonName = node => node.props.label ?? modifier(node, 'accessibilityLabel');
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : '';
function flat(nodes) { return [nodes].flat(Infinity).flatMap(node => node?.type === 'Fragment' ? flat(node.props.children) : node && typeof node === 'object' ? [node] : []); }
function setup() {
  const filename = path.resolve(__dirname, '../src/homashyo/RawSplitHome.ios.tsx'), mod = new Module(filename, module), calls = [];
  const state = { error: null, snapshotError: null, pendingCheck: 'ready', pending: null, pendingIssue: null, busy: false, snapshot: { warehouses: ['Raw'] },
    barcode: 'PARENT', source: { itemName: 'Film', warehouse: 'Raw' }, printer: { transport: 'wifi' }, wifiPrinter: 'zebra',
    outputs: [{ id: 'a', width: '400', gross: '40', bobina: '1', length: '100' }], waste: '2', showIssue: false };
  const controller = { getSnapshot: () => state, subscribe() {}, locked: false, writesHeld: false,
    widthPlan: { canAdd: true, errors: [null] }, wasteCheck: null, reload() {}, setBarcode: value => calls.push(['barcode', value]),
    lookup: async () => calls.push('lookup'), setWifiPrinter: value => calls.push(['wifi', value]), removeRoll: index => calls.push(['remove', index]),
    setOutput() {}, confirmWidth() {}, addRoll: () => calls.push('add'), setWaste() {}, save: async () => calls.push('save') };
  const swift = new Proxy({ useNativeState: initial => ({ get: () => initial, set() {} }) }, { get: (o, key) => o[key] ?? key });
  const mocks = { 'react/jsx-runtime': jsx,
    react: { useEffect() {}, useLayoutEffect() {}, useSyncExternalStore: (_sub, get) => get() },
    '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) }),
    'react-native': { PlatformColor: name => name, ScrollView: 'ScrollView' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => 'hold' },
    './useRawSplitIssueScroll.ios': { useRawSplitIssueScroll: () => ({ scroll: {}, measureContent() {}, measureIssueOrigin() {} }) },
    './rawSplitHomePresentation': { rawSplitBalance: () => 'Hisob teng ✓', rawSplitNetLabel: () => 'Netto: 39 kg',
      rawSplitSourceSummary: () => '100 kg · 1000 mm · 20 mkm', rawSplitWasteWidthLabel: () => 'Atxotga ketadi: 10 mm',
      rawSplitWidthSummary: () => 'Qolgan 600 mm — yana rulon kiriting' } };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { state, controller, calls, render: () => mod.exports.RawSplitHome({ controller, onScan: () => calls.push('scan') }) };
}
test('iOS Home keeps V2 source and waste separators and explicit source spacing', () => {
  const h = setup(), tree = h.render(), root = find(tree, n => n.type === 'VStack' && n.props.modifiers?.some(m => m.kind === 'onGeometryChange'))[0];
  assert.equal(root.props.spacing, 0); assert.equal(tree.props.contentContainerStyle.paddingBottom, 100);
  assert.deepEqual(modifier(root, 'padding'), { horizontal: 16, vertical: 20 });
  const children = flat(root.props.children), dividers = children.filter(n => n.type === 'Divider');
  assert.equal(dividers.length, 2); dividers.forEach(n => assert.equal(modifier(n, 'frame').height, 32));
  const title = children.findIndex(n => n.type === 'Text' && text(n) === 'Film');
  assert.equal(children[title - 1].type, 'Divider'); assert.equal(modifier(children[title + 1], 'frame').height, 4);
  assert.equal(modifier(children[title], 'font').textStyle, 'headline');
  h.state.source = null; assert.equal(find(h.render(), n => n.type === 'Divider').length, 0);
});
test('iOS Home places remove at trailing edge and measures paired fields and Netto/add as equal flexible columns', () => {
  const h = setup(), tree = h.render();
  const header = find(tree, n => n.type === 'HStack' && Array.isArray(n.props.children) && n.props.children.some(c => c?.props?.label === 'Rulonni olib tashlash'))[0];
  const label = header.props.children[0]; assert.equal(modifier(label, 'frame').maxWidth, Infinity);
  assert.equal(modifier(label, 'frame').alignment, 'leading');
  const paired = find(tree, n => n.type === 'HStack' && Array.isArray(n.props.children) && n.props.children.length === 2 &&
    n.props.children.every(child => child?.type?.name === 'Input'));
  assert.equal(paired.length, 2); paired.forEach(row => { assert.equal(row.props.spacing, 12); row.props.children.forEach(child => {
    const field = child.type(child.props); assert.equal(modifier(field, 'frame').maxWidth, Infinity);
  }); });
  const net = find(tree, n => n.type === 'HStack' && Array.isArray(n.props.children) && n.props.children[0]?.props?.children === 'Netto: 39 kg')[0];
  assert.equal(modifier(net.props.children[0], 'frame').maxWidth, Infinity);
  assert.equal(modifier(net.props.children[1], 'frame').maxWidth, Infinity);
  net.props.children[1].props.onPress(); assert.deepEqual(h.calls, ['add']);
});
test('iOS lookup arrow lives inside the barcode border and retains field submit and accessible button action', () => {
  const h = setup(), input = find(h.render(), n => n.type?.name === 'Input' && n.props.label === 'Rulon QR / shtrix-kodi')[0];
  const rendered = input.type(input.props), bordered = find(rendered, n => n.type === 'HStack' && modifier(n, 'strokeBorder'))[0];
  const field = find(bordered, n => n.type === 'TextField')[0], button = find(bordered, n => n.type === 'Button')[0];
  assert.equal(modifier(field, 'textFieldStyle'), 'plain'); assert.equal(button.props.label, 'Rulonni topish');
  assert.equal(modifier(button, 'accessibilityLabel'), 'Rulonni topish');
  button.props.onPress(); field.props.modifiers.find(m => m.kind === 'onSubmit').args[0](); assert.deepEqual(h.calls, ['lookup', 'lookup']);
});
test('iOS Home uses small muted metadata and centered waste text while primary labels fill their buttons', () => {
  const h = setup(), tree = h.render();
  for (const value of ['Ombor: Raw', 'Netto: 39 kg', 'Atxotga ketadi: 10 mm']) {
    const labels = find(tree, n => n.type === 'Text' && text(n) === value); assert.ok(labels.length);
    labels.forEach(n => { assert.equal(modifier(n, 'font').textStyle, 'caption'); assert.equal(modifier(n, 'foregroundStyle').style, 'secondary'); });
  }
  const waste = find(tree, n => n.type === 'Text' && text(n) === 'Atxotga ketadi: 10 mm')[0];
  assert.equal(modifier(waste, 'frame').alignment, 'center');
  for (const label of ['Skanerlash', 'Saqlash va chop etish']) {
    const button = find(tree, n => n.type === 'Button' && buttonName(n) === label)[0];
    assert.equal(button.props.label, undefined); assert.equal(modifier(button.props.children, 'frame').maxWidth, Infinity); button.props.onPress();
  }
  assert.deepEqual(h.calls, ['scan', 'save']);
  h.controller.locked = true;
  const button = find(h.render(), n => n.type === 'Button' && buttonName(n) === 'Saqlash va chop etish')[0];
  assert.equal(modifier(button, 'disabled'), true);
});
