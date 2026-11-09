const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src');
function compile(relative, mocks) {
  const filename = path.join(root, relative), loaded = new Module(filename, module);
  loaded.require = name => name in mocks ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return loaded.exports;
}
const component = (name, records) => props => { records.push({ name, props }); return React.createElement('div', null, props.children); };

test('unrouted shell exposes only real search and tab selection, with no held-action callbacks', () => {
  const records = [], calls = [], boundary = {}, session = {}, tab = { key: 'a', block: { name: 'A' }, index: 0, selected: true, matchCount: 2 };
  const block = { key: 'a', block: tab.block, future: Promise.resolve([]), initialLocations: [] }, actions = { current: () => true,
    setSearch: value => calls.push(['search', value]), select: value => calls.push(['select', value]) };
  const state = { home: { kind: 'blocks', tabs: [tab], selected: tab, cellCounts: { a: {} } }, search: 'needle', blocks: [block], boundary, actions };
  const ui = { Host: component('Host', records), TextInput: component('TextInput', records), useNativeState: value => ({ get: () => value, set() {} }) };
  const native = Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, component(name, records)]));
  native.StyleSheet = { create: value => value };
  const mocks = { '@expo/ui': ui, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 5 }) },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surface: 'surface', onSurface: 'text', onSurfaceVariant: 'muted', secondaryContainer: 'selected', primary: 'primary' } }) },
    '../shared/localization': { localizedGetter: key => key }, './QolipReadOnlyHomeGrid': { QolipReadOnlyHomeGrid: component('Grid', records) },
    './useQolipHomeBlockRead': { useQolipHomeBlockRead: () => ({ invalid: false, locations: [], loading: false, error: false }) },
    './useReadOnlyQolipHome': { useReadOnlyQolipHome: (s, b) => { assert.equal(s, session); assert.equal(b, boundary); return state; } },
    './useQolipSettledHomeSession': { useQolipSettledHomeSession: () => ({ kind: 'ready', session, boundary }) },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${values.count}` : key }) } };
  const Shell = compile('qolip/QolipReadOnlyHome.tsx', mocks).QolipReadOnlyHomeShell;
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(Shell)); };
  assert.match(render(), /A 2/); const search = records.find(record => record.name === 'TextInput'); search.props.onChangeText('query');
  const tabs = records.filter(record => record.name === 'Pressable'); assert.equal(tabs.length, 1); tabs[0].props.onPress();
  assert.deepEqual(calls, [['search', 'query'], ['select', 0]]);
  assert.equal(records.some(record => record.props.onLongPress || record.props.onRefresh || record.props.onRetry || record.props.onPrint), false);
  state.home = { kind: 'retry' }; const error = render(); assert.match(error, /serverDisconnectedRetry/);
  assert.equal(records.some(record => record.name === 'Pressable'), false);
  state.home = { kind: 'refresh-unavailable' }; assert.match(render(), /home.load_failed/);
  assert.equal(records.some(record => record.name === 'Pressable'), false);
  state.home = { kind: 'invalid' }; assert.equal(render(), '');
});

for (const platform of ['ios', 'android']) test(`${platform} grid presents data without attach, move, print, refresh or retry actions`, () => {
  const records = [], native = Object.fromEntries(['ActivityIndicator', 'ScrollView', 'View'].map(name => [name, component(name, records)]));
  native.PlatformColor = name => name;
  const ui = Object.fromEntries(['Box', 'Column', 'FlowRow', 'Host', 'HStack', 'Image', 'ProgressView', 'RNHostView', 'Row', 'Spacer', 'Text', 'VStack']
    .map(name => [name, component(name, records)]));
  ui.useMaterialColors = () => ({ secondaryContainer: '#dddddd', surfaceContainerHighest: '#eeeeee', onSecondaryContainer: '#111111', primaryContainer: '#cccccc', onSurfaceVariant: '#222222' });
  const mod = name => (...args) => ({ name, args }), modifiers = Object.fromEntries(['accessibilityIdentifier', 'accessibilityLabel', 'background', 'frame', 'lineLimit',
    'clip', 'paddingAll', 'semantics', 'size', 'testID', 'weight'].map(name => [name, mod(name)]));
  modifiers.shapes = { roundedRectangle: () => 'rounded' }; modifiers.Shapes = { RoundedCorner: () => 'rounded', Circle: 'circle' };
  const actualGrid = { qolipGridLetters: ['A'], qolipGridRowCount: 1, qolipGridMatchBackground: value => value,
    qolipGridCells: () => ({ occupiedCells: 1, totalQuantity: 2, unplaced: [], rows: [[{ label: 'A1', letter: 'A', row: 1,
      items: [{}], title: 'Mold', quantity: 2, matchCount: 0 }]] }) };
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'react-native': native, 'expo-symbols': { SymbolView: component('SymbolView', records) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 10 }) },
    '../shared/localization': { localizedGetter: key => key, localizedMethod: (_key, _locale, values) => `count:${values.count}` },
    './qolipGridLogic': actualGrid, './useQolipGridScroll': { useQolipGridScroll: () => ({ panHandlers: {}, bindScroll() {}, onScroll() {}, onContentSizeChange() {}, onViewportWidth() {} }) },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${values.count}` : key }) } };
  const Grid = compile(`qolip/QolipReadOnlyHomeGrid.${platform}.tsx`, mocks).QolipReadOnlyHomeGrid;
  const render = props => { records.length = 0; return renderToStaticMarkup(React.createElement(Grid, props)); };
  const markup = render({ locations: [{}], loading: false, error: false, searchCounts: {} }); assert.match(markup, /Mold/); assert.match(markup, /count:2/);
  assert.equal(records.some(record => record.props.onPress || record.props.onClick || record.props.onLongPress || record.props.onRefresh), false);
  assert.equal(records.flatMap(record => record.props.modifiers ?? []).some(value => /click|tap|long/i.test(value.name)), false);
  assert.match(render({ locations: null, loading: false, error: true, searchCounts: {} }), /serverDisconnectedRetry/);
  assert.equal(records.some(record => record.props.onPress || record.props.onClick || record.props.onRetry), false);
  assert.match(render({ locations: null, loading: false, error: true, refreshUnavailable: true, searchCounts: {} }), /home.load_failed/);
  assert.equal(records.some(record => record.props.onPress || record.props.onClick || record.props.onRetry), false);
});

test('candidate source has no route or mutation/refresh handler in its dependency entry points', () => {
  const read = name => fs.readFileSync(path.join(root, `qolip/${name}`), 'utf8');
  const owner = read('qolipHomeOwnerState.ts'), runtime = read('qolipHomeOwnerRuntime.ts'), shell = read('QolipReadOnlyHome.tsx');
  assert.doesNotMatch(owner, /reorder:|retry:|refreshBlock:|routeChanged:|appResumed:|locationsChanged:/);
  assert.doesNotMatch(runtime, /setItem|saveOrder|qolipSave|qolipMove/);
  assert.doesNotMatch(shell, /router|onMenu|onProfile|onLongPress|onRefresh|onRetry|printCell|openCell/);
  for (const api of ['qolipBlocksApi.ts', 'qolipLocationsApi.ts']) assert.doesNotMatch(read(api), /method:\s*['"](?:POST|PUT|DELETE)['"]|qolipCreate|qolipSave|qolipMove/);
});
