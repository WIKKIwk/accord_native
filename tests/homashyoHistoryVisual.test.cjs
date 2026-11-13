// Source-derived visual structure. Native text metrics/drawing still require phones.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const colors = { surface: 'surface', surfaceContainerLowest: 'lowest', onSurface: 'ink', onSurfaceVariant: 'muted', primary: 'primary', secondaryContainer: 'tile', onSecondaryContainer: 'tileInk' };
const modifier = new Proxy({ shapes: { roundedRectangle: value => ({ shape: 'roundedRectangle', ...value }) } }, { get: (target, key) => target[key] ?? ((...args) => ({ type: key, args })) });
function load(name, extra = {}) {
  const file = path.resolve(__dirname, '../src', name), m = new Module(file, module); m.filename = file; m.paths = module.paths;
  const mocks = { 'react/jsx-runtime': jsx,
    react: { useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, get) => get() },
    'react-native': { Text: 'NativeText', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    '@expo/ui/swift-ui': new Proxy({}, { get: (_, name) => name }), '@expo/ui/swift-ui/modifiers': modifier,
    '@expo/ui/jetpack-compose': new Proxy({ useMaterialColors: () => colors }, { get: (target, name) => target[name] ?? name }), '@expo/ui/jetpack-compose/modifiers': modifier,
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    '../preparation/PreparationUI.android': { usePreparationText: () => value => value, PreparationText: 'PreparationText' },
    './rawSplitModel': { rawSplitDisplay: value => value },
    './rawSplitHistoryPresentation': { rawSplitHistoryTitle: () => '100 → 98 kg', rawSplitHistorySubtitle: () => 'Raw W • 1 rulon • 2 kg chiqindi',
      rawSplitHistoryTime: () => '12:00', rawSplitIssueTime: () => '13.11 12:00', rawSplitIssueFullTime: () => '2026-11-13',
      rawSplitOutputSummary: () => '98 kg · 1000 mm · 20 mkm', rawSplitResultDetailRows: () => [{ label: 'Manba QR', value: 'parent' }],
      rawSplitIssueDetailRows: () => [{ label: 'QR', value: 'parent' }] }, ...extra };
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  return m.exports;
}
function content(node) { return typeof node?.type === 'function' && node.type.name === 'RawSplitDetailLine' ? node.type(node.props) : node?.props?.children; }
function find(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => find(value, predicate)); return [...(predicate(node) ? [node] : []), ...find(content(node), predicate)]; }
function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); return Array.isArray(node) ? node.map(text).join('') : node ? text(content(node)) : ''; }
function has(node, type, check = () => true) { return node.props.modifiers?.some(m => m.type === type && check(m.args[0])); }
const output = { stockId: 'child', barcode: 'child', labelName: 'Film', grossKg: '99', bobinaKg: '1', lengthM: '1000' };
const result = { id: 'result', outputs: [output] }, issue = { id: 'issue', source: { itemName: 'Film' }, check: { message: '1 kg hisobga olinmagan' }, note: 'note', actorName: 'Cutter' };
function history(platform) { const state = { snapshot: { history: [result, { ...result, id: 'second' }], issues: [issue] }, printer: null, error: null, busy: false };
  return load(`homashyo/RawSplitHistory.${platform}.tsx`).RawSplitHistory({ controller: { getSnapshot: () => state, subscribe() {}, reload: async () => {} }, onResult() {}, onIssue() {} }); }
function details(platform, issueMode = false) { const mod = load(`homashyo/RawSplitDetails.${platform}.tsx`); return issueMode ? mod.RawSplitIssueDetails({ issue, hasResult: false }) : mod.RawSplitDetails({ result, printerLabel: 'wifi', showWifiSelector: true, wifiPrinter: 'zebra', onSelectPrinter() {}, onWifiChanged() {}, onReprint: async () => {}, onReprintAll: async () => {}, onError() {} }); }
test('Android history keeps V2 edge insets, joined radii, padding and three typography levels through the reused card', () => {
  const cards = find(history('android'), node => node.type === 'WorkerQueueCard');
  assert.equal(cards.length, 3); assert.equal(cards[0].props.containerStyle.paddingHorizontal, 4);
  assert.equal(cards[0].props.style.paddingStart, 16); assert.equal(cards[0].props.style.paddingEnd, 12); assert.equal(cards[0].props.style.paddingVertical, 13);
  assert.equal(cards[0].props.style.borderTopLeftRadius, 18); assert.equal(cards[0].props.style.borderBottomLeftRadius, 6);
  assert.equal(cards[1].props.style.borderTopLeftRadius, 6); assert.equal(cards[1].props.style.borderBottomLeftRadius, 18);
  const title = find(cards[0], node => node.type === 'NativeText' && text(node) === '100 → 98 kg')[0];
  assert.deepEqual([title.props.style.fontSize, title.props.style.fontWeight], [14, '700']);
  const subtitle = find(cards[0], node => node.type === 'NativeText' && text(node).startsWith('Raw W'))[0];
  assert.deepEqual([subtitle.props.style.fontSize, subtitle.props.style.lineHeight], [12, 15]);
  assert.equal(find(cards[0], node => node.type === 'NativeText' && text(node) === '12:00')[0].props.style.fontSize, 11);
});
test('iOS history uses native plain List, source edge spacing and title/subtitle/time hierarchy', () => {
  const tree = history('ios'), list = find(tree, node => node.type === 'List')[0]; assert.ok(has(list, 'listStyle', value => value === 'plain'));
  const row = find(tree, node => node.type === 'Button')[0]; assert.ok(has(row, 'listRowInsets', value => value.leading === 4 && value.trailing === 4));
  const title = find(row, node => node.type === 'Text' && text(node) === '100 → 98 kg')[0]; assert.ok(has(title, 'font', value => value.size === 14 && value.weight === 'bold'));
  assert.ok(find(row, node => node.type === 'Text' && text(node).startsWith('Raw W')).some(node => has(node, 'font', value => value.textStyle === 'caption')));
  assert.ok(find(row, node => node.type === 'Text' && text(node) === '12:00').some(node => has(node, 'font', value => value.textStyle === 'caption2')));
});
for (const platform of ['ios', 'android']) for (const issueMode of [false, true]) test(`${platform} ${issueMode ? 'issue' : 'result'} detail has natural-height content and a colored 44-point header tile`, () => {
  const tree = details(platform, issueMode); assert.equal(find(tree, node => node.type === 'ScrollView').length, 0);
  assert.equal(tree.props.style?.minHeight, undefined);
  if (platform === 'android') {
    assert.equal(tree.type, 'View'); assert.equal(tree.props.style.paddingTop, 12); assert.equal(tree.props.style.paddingBottom, 20);
    const tile = find(tree, node => node.type === 'View' && node.props.style?.width === 44)[0]; assert.equal(tile.props.style.height, 44); assert.equal(tile.props.style.backgroundColor, 'tile');
    const title = find(tree, node => node.type === 'NativeText' && text(node) === (issueMode ? 'Film' : '100 → 98 kg'))[0]; assert.deepEqual([title.props.style.fontSize, title.props.style.fontWeight], [20, '800']);
  } else {
    assert.deepEqual(tree.props.matchContents, { vertical: true });
    const tile = find(tree, node => node.type === 'Image')[0]; assert.ok(has(tile, 'frame', value => value.width === 44 && value.height === 44));
    assert.ok(has(tile, 'background', value => value === 'tile'));
    const title = find(tree, node => node.type === 'Text' && text(node) === (issueMode ? 'Film' : '100 → 98 kg'))[0]; assert.ok(has(title, 'font', value => value.textStyle === 'title3' && value.weight === 'heavy'));
  }
});
test('Android result keeps the compact shared Wi-Fi selector in its printer row', () => {
  const tree = details('android'), selector = find(tree, node => node.type === 'DropdownFilter')[0]; assert.equal(selector.props.inline, true);
  const row = find(tree, node => node.type === 'View' && node.props.style?.flexDirection === 'row' && text(node).includes('Printer: wifi'))[0];
  assert.ok(find(row, node => node === selector).length); assert.equal(selector.props.selectedLabel, 'Zebra');
});
test('reused card defaults remain unchanged unless Homashyo passes geometry', () => {
  const { WorkerQueueCard } = load('components/WorkerQueueCard.android.tsx');
  const tree = WorkerQueueCard({ backgroundColor: 'surface', first: true, last: true, children: 'row' });
  assert.equal(tree.props.style[0].paddingHorizontal, 8); assert.equal(tree.props.children.props.style[1].borderTopLeftRadius, 16);
  const custom = WorkerQueueCard({ backgroundColor: 'surface', first: true, last: true, style: { paddingStart: 16 }, containerStyle: { paddingHorizontal: 4 }, children: 'row' });
  assert.equal(custom.props.style.at(-1).paddingHorizontal, 4); assert.equal(custom.props.children.props.style.at(-1).paddingStart, 16);
});

test('iOS reprint-all fills the native button label rather than attaching ignored children to a label prop', () => {
  const tree = details('ios'), button = find(tree, node => node.type === 'Button' && text(node).includes('Barchasini qayta chop etish'))[0];
  assert.equal(button.props.label, undefined); assert.ok(has(button, 'accessibilityLabel', value => value === 'Barchasini qayta chop etish'));
  const row = find(button, node => node.type === 'HStack')[0]; assert.ok(has(row, 'frame', value => value.maxWidth === Infinity));
  assert.ok(find(row, node => node.type === 'Image' && node.props.systemName === 'printer').length);
});
