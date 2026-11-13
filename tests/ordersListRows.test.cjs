/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const element = (type, props, key) => ({ type, props, key, $$typeof: 'element' });
const jsx = { Fragment: 'Fragment', jsx: element, jsxs: element };
const isValidElement = node => node?.$$typeof === 'element';
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/shared/orders', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
function android() {
  const hooks = [], frames = [];
  let cursor = 0;
  const originalFrame = global.requestAnimationFrame, originalCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  global.cancelAnimationFrame = () => {};
  const state = value => ({ get: () => value, set: next => { value = next; } });
  const react = {
    isValidElement,
    Children: { toArray: value => [value].flat(Infinity).filter(value => value !== null && value !== undefined && value !== false) },
    cloneElement: (node, props) => ({ ...node, props: { ...node.props, ...props } }),
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect() {},
    useRef(value) { const id = cursor++; return hooks[id] ??= { current: value }; },
    useState(value) {
      const id = cursor++, hook = hooks[id] ??= { value };
      return [hook.value, next => { hook.value = next; }];
    },
  };
  const { OrdersList } = load('OrdersList.android.tsx', {
    'react/jsx-runtime': jsx, react,
    '@expo/ui/jetpack-compose': { Column: 'Column', Host: 'Host', useMaterialColors: () => ({}) },
    'react-native': { RefreshControl: 'RefreshControl', View: 'View' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', useNativeGesture: config => config },
    'react-native-reanimated': { __esModule: true, default: { FlatList: 'FlatList' }, scrollTo() {}, useAnimatedReaction() {},
      useAnimatedRef: () => null, useAnimatedScrollHandler: handlers => handlers, useSharedValue: state },
    './OrderListItem': { OrderListItem: 'OrderListItem' },
    '../../components/workerOrderPalette': { WorkerOrderPalette: { Provider: 'Palette' } },
  });
  return {
    render(props) { cursor = 0; return nodes(OrdersList(props), 'FlatList')[0]; },
    frame() { frames.shift()?.(); },
    restore() { global.requestAnimationFrame = originalFrame; global.cancelAnimationFrame = originalCancel; },
  };
}
const common = { active: true, onRefresh: async () => {}, headerOffset: { get: () => 0 }, headerHeight: { get: () => 70 }, topInset: 118 };

test('Android prepares no order elements for 1000 data rows until FlatList requests a visible row', () => {
  const x = android(), calls = [], rows = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
  try {
    const header = element('Filter', {}, 'filter'), footer = element('Spacer', {}, 'spacer');
    const list = x.render({ ...common, children: header, footer, rows,
      rowKey: row => row.id, renderRow: (row, index) => { calls.push([row.id, index]); return element('OrderListItem', { imageActive: true, id: row.id }); },
      passthrough: node => node.type === 'Filter' });
    assert.deepEqual(calls, []);
    assert.equal(list.props.data.length, 1002);
    assert.equal(list.props.data[1], rows[0]); assert.equal(list.props.data[1000], rows[999]);
    assert.equal(list.props.data[1001], footer);
    const rendered = list.props.renderItem({ item: list.props.data[18], index: 18 });
    assert.deepEqual(calls, [['17', 17]]);
    assert.equal(nodes(rendered, 'OrderListItem')[0].props.imageActive, false);
    assert.equal(nodes(rendered, 'Host').length, 0);
    assert.equal(list.props.keyExtractor(rows[17], 18), 'row:17');
    assert.equal(list.props.renderItem({ item: header, index: 0 }).props.children, header);
    const end = list.props.renderItem({ item: footer, index: 1001 });
    assert.equal(nodes(end, 'Column')[0].props.children, footer);
  } finally { x.restore(); }
});

test('Android row keys survive order movement and visible data rows retain staged image loading', () => {
  const x = android(), a = { id: 'a' }, b = { id: 'b' }, header = element('Filter', {}, 'filter');
  const props = { ...common, children: header, rows: [a, b], rowKey: row => row.id,
    renderRow: row => element('OrderListItem', { id: row.id, imageActive: true }) };
  try {
    let list = x.render(props);
    const key = list.props.keyExtractor(b, 2);
    list.props.onViewableItemsChanged({ viewableItems: [{ item: b, key }] });
    x.frame(); x.frame();
    list = x.render({ ...props, rows: [b, a] });
    assert.equal(list.props.keyExtractor(b, 1), key);
    assert.equal(nodes(list.props.renderItem({ item: b, index: 1 }), 'OrderListItem')[0].props.imageActive, true);
  } finally { x.restore(); }
});

test('Android existing element children preserve passthrough, image gating and refresh behavior', async () => {
  const x = android(); let refreshed = 0;
  try {
    const order = element('OrderListItem', { imageActive: true }, 'existing'), filter = element('Filter', {}, 'filter');
    const list = x.render({ ...common, children: [filter, order], onRefresh: async () => { refreshed++; }, passthrough: node => node === filter });
    assert.equal(list.props.data[1], order);
    assert.equal(list.props.renderItem({ item: filter, index: 0 }).props.children, filter);
    assert.equal(nodes(list.props.renderItem({ item: order, index: 1 }), 'OrderListItem')[0].props.imageActive, false);
    await list.props.refreshControl.props.onRefresh();
    assert.equal(refreshed, 1);
  } finally { x.restore(); }
});

test('iOS passes raw rows to native List.ForEach and renders only a requested item with fresh actions', () => {
  function List() {}
  List.ForEach = 'ForEach';
  const modifier = (...args) => args;
  const { OrdersList } = load('OrdersList.ios.tsx', {
    'react/jsx-runtime': jsx, react: { useCallback: fn => fn },
    '@expo/ui/swift-ui': { List },
    '@expo/ui/swift-ui/modifiers': { listStyle: modifier, refreshable: modifier, scrollContentBackground: modifier, scrollEdgeEffectStyle: modifier },
  });
  const calls = [], rows = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
  const header = element('Filter', {}), footer = element('Footer', {});
  const props = { ...common, children: header, footer, rows, rowKey: row => row.id,
    renderRow: (row, index) => { calls.push(['old', row.id, index]); return element('Order', { id: row.id }); } };
  let tree = OrdersList(props), list = nodes(tree, 'ForEach')[0];
  assert.deepEqual(calls, []); assert.equal(list.props.data, rows);
  assert.equal(tree.props.children[0], header); assert.equal(tree.props.children[2], footer);
  assert.equal(list.props.keyExtractor(rows[888], 888), '888');
  list.props.children({ item: rows[888], index: 888 });
  assert.deepEqual(calls, [['old', '888', 888]]);
  tree = OrdersList({ ...props, renderRow: (row, index) => { calls.push(['new', row.id, index]); return element('Order', {}); } });
  list = nodes(tree, 'ForEach')[0]; list.props.children({ item: rows[7], index: 7 });
  assert.deepEqual(calls.at(-1), ['new', '7', 7]);
});
