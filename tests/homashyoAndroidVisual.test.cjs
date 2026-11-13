// Source-derived visual grouping with mocked native controls; no device rendering is claimed.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const Module = require('node:module'); const path = require('node:path');
const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate)) : [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
const colors = { surfaceContainerHigh: 'darkFill', surfaceContainerHighest: 'lightFill', onSurface: 'ink', onSurfaceVariant: 'muted', outlineVariant: 'outline', primary: 'primary', error: 'error' };
function home() {
  const calls = [], theme = { mode: 'light' }, state = { barcode: 'source', source: { itemName: 'Film', warehouse: 'Raw' }, outputs: [
    { id: 'one', width: '400', gross: '40', bobina: '1', length: '1000' }], waste: '2', issueNote: '', showIssue: false,
    printer: { transport: 'wifi' }, wifiPrinter: 'zebra', snapshot: { warehouses: ['Raw'] }, pendingCheck: 'ready',
    pending: null, pendingIssue: null, error: null, snapshotError: null, issueError: null, busy: false };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, locked: false, writesHeld: false,
    widthPlan: { errors: [null], canAdd: true }, wasteCheck: null, lookup: () => calls.push('lookup'),
    setWifiPrinter: value => calls.push(['wifi', value]) };
  const compose = new Proxy({ Shape: { RoundedCorner: props => props }, useMaterialColors: () => colors,
    useNativeState: initial => ({ get: () => initial, set() {} }),
    OutlinedTextField: Object.assign(() => {}, { Label: 'Label', TrailingIcon: 'TrailingIcon' }) }, { get: (o, name) => o[name] ?? name });
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect() {}, useLayoutEffect() {}, useRef: current => ({ current }),
    useState: initial => [initial, () => {}], useSyncExternalStore: (_subscribe, get) => get() },
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': {
      fillMaxWidth: () => ({ modifier: 'fillMaxWidth' }), semantics: value => ({ modifier: 'semantics', value }), testID: value => ({ modifier: 'testID', value }) },
    'react-native': { ScrollView: 'ScrollView', View: 'View', Text: 'NativeText' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/useBaseTheme': { useBaseTheme: () => theme },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../preparation/PreparationUI.android': { PreparationText: 'Text', usePreparationText: () => value => value },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => '' }, './rawSplitHomePresentation': {
      rawSplitBalance: () => 'Hisob teng ✓', rawSplitSourceSummary: () => '100 kg', rawSplitNetLabel: () => 'Netto: 39 kg',
      rawSplitWasteWidthLabel: () => 'Atxotga ketadi: 200 mm', rawSplitWidthSummary: () => 'Qolgan 200 mm — atxot' } };
  const filename = path.resolve(__dirname, '../src/homashyo/RawSplitHome.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { calls, state, controller, compose, theme, render: () => mod.exports.RawSplitHome({ controller, onScan() {} }) };
}

test('barcode lookup remains inside the native field with identical lock and search behavior', () => {
  const h = home(); let tree = h.render();
  let input = find(tree, n => n.props.label === 'Rulon QR / shtrix-kodi')[0];
  let field = find(input.type(input.props), n => n.type === h.compose.OutlinedTextField)[0];
  assert.deepEqual(field.props.shape.cornerRadii, { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 });
  assert.equal(field.props.colors.unfocusedContainerColor, 'lightFill');
  h.theme.mode = 'dark'; assert.equal(find(input.type(input.props), n => n.type === h.compose.OutlinedTextField)[0].props.colors.unfocusedContainerColor, 'darkFill');
  const slot = find(field, n => n.type === 'TrailingIcon')[0], action = find(slot, n => n.type === 'IconButton')[0];
  assert.equal(action.props.enabled, true); action.props.onClick(); field.props.keyboardActions.onSearch();
  assert.deepEqual(h.calls, ['lookup', 'lookup']);
  h.controller.locked = true; tree = h.render(); input = find(tree, n => n.props.label === 'Rulon QR / shtrix-kodi')[0];
  field = find(input.type(input.props), n => n.type === h.compose.OutlinedTextField)[0];
  assert.equal(field.props.enabled, false); assert.equal(find(field, n => n.type === 'IconButton')[0].props.enabled, false);
});

test('source and waste retain separate dividers, muted small metadata and centered width feedback', () => {
  const tree = home().render(); assert.deepEqual(tree.props.contentContainerStyle, { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 });
  const dividers = find(tree, n => n.type?.name === 'SectionDivider'); assert.equal(dividers.length, 2);
  for (const divider of dividers) {
    const rendered = divider.type(divider.props); assert.equal(rendered.props.style.height, 32);
    assert.equal(find(rendered, n => n.type === 'HorizontalDivider')[0].props.color, 'outline');
  }
  const metadata = find(tree, n => n.type?.name === 'SmallText');
  for (const label of ['Ombor: Raw', 'Printer: wifi', 'Netto: 39 kg']) assert.ok(metadata.some(n => n.props.children === label), label);
  const width = metadata.find(n => n.props.children === 'Atxotga ketadi: 200 mm'), rendered = width.type(width.props);
  const text = find(rendered, n => n.type === 'Text')[0];
  assert.equal(text.props.color, 'muted'); assert.equal(text.props.style.fontSize, 12); assert.equal(text.props.style.textAlign, 'center');
  assert.equal(find(tree, n => n.props.style?.marginBottom === 20).length, 1);
});

test('printer choice stays inline and source primary actions retain full and compact sizes', () => {
  const h = home(), tree = h.render(), dropdown = find(tree, n => n.type === 'DropdownFilter')[0];
  const row = find(tree, n => n.type === 'View' && n.props.style?.marginTop === 16)[0];
  assert.ok(find(row, n => n === dropdown).length); assert.equal(dropdown.props.inline, true);
  assert.equal(dropdown.props.enabled, true); dropdown.props.onChange('godex'); assert.deepEqual(h.calls, [['wifi', 'godex']]);
  const buttons = find(tree, n => n.type === 'Button');
  for (const label of ['Skanerlash', 'Saqlash va chop etish']) assert.equal(buttons.find(n => n.props.label === label).props.height, 56);
  assert.equal(buttons.find(n => n.props.label === '+ rulon').props.height, 24);
});
