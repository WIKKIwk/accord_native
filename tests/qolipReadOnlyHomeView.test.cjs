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
const retryMock = records => props => { records.push({ name: 'Retry', props }); return React.createElement('div', null,
  props.refreshUnavailable ? 'home.load_failed' : 'serverDisconnectedRetry'); };

test('unrouted shell supplies real search, tabs and failed-read retries, with held actions absent', () => {
  const records = [], calls = [], boundary = {}, session = {}, tab = { key: 'a', block: { name: 'A' }, index: 0, selected: true, matchCount: 2 };
  const block = { key: 'a', block: tab.block, future: Promise.resolve([]), initialLocations: [] }, actions = { current: () => true,
    setSearch: value => calls.push(['search', value]), select: value => calls.push(['select', value]),
    retryBlocks: () => calls.push(['retry-blocks']), retryBlock: value => calls.push(['retry-block', value]) };
  const state = { home: { kind: 'blocks', tabs: [tab], selected: tab, cellCounts: { a: {} } }, search: 'needle', blocks: [block], boundary, actions };
  const ui = { Host: component('Host', records), TextInput: component('TextInput', records), useNativeState: value => ({ get: () => value, set() {} }) };
  const native = Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, component(name, records)]));
  native.StyleSheet = { create: value => value };
  const mocks = { '@expo/ui': ui, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 5 }) },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surface: 'surface', onSurface: 'text', onSurfaceVariant: 'muted', secondaryContainer: 'selected', primary: 'primary' } }) },
    './QolipReadOnlyHomeGrid': { QolipReadOnlyHomeGrid: component('Grid', records) }, './QolipReadOnlyRetry': { QolipReadOnlyRetry: retryMock(records) },
    './useQolipHomeBlockRead': { useQolipHomeBlockRead: () => ({ invalid: false, locations: [], loading: false, error: false }) },
    './useReadOnlyQolipHome': { useReadOnlyQolipHome: (s, b) => { assert.equal(s, session); assert.equal(b, boundary); return state; } },
    './useQolipSettledHomeSession': { useQolipSettledHomeSession: () => ({ kind: 'ready', session, boundary }) },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${values.count}` : key }) } };
  const Shell = compile('qolip/QolipReadOnlyHome.tsx', mocks).QolipReadOnlyHomeShell;
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(Shell)); };
  assert.match(render(), /A 2/); records.find(record => record.name === 'TextInput').props.onChangeText('query');
  const tabs = records.filter(record => record.name === 'Pressable'); assert.equal(tabs.length, 1); tabs[0].props.onPress();
  records.find(record => record.name === 'Grid').props.onRetry();
  assert.deepEqual(calls, [['search', 'query'], ['select', 0], ['retry-block', 'A']]);
  assert.equal(records.some(record => record.props.onLongPress || record.props.onRefresh || record.props.onPrint), false);
  state.home = { kind: 'retry' }; assert.match(render(), /serverDisconnectedRetry/); records.find(record => record.name === 'Retry').props.onRetry();
  state.home = { kind: 'refresh-unavailable' }; assert.match(render(), /home.load_failed/); records.find(record => record.name === 'Retry').props.onRetry();
  assert.deepEqual(calls.slice(-2), [['retry-blocks'], ['retry-blocks']]);
  state.home = { kind: 'invalid' }; assert.equal(render(), '');
});

for (const platform of ['ios', 'android']) test(`${platform} grid exposes only explicit failed-read retry`, () => {
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
    '../shared/localization': { localizedMethod: (_key, _locale, values) => `count:${values.count}` }, './QolipReadOnlyRetry': { QolipReadOnlyRetry: retryMock(records) },
    './qolipGridLogic': actualGrid, './useQolipGridScroll': { useQolipGridScroll: () => ({ panHandlers: {}, bindScroll() {}, onScroll() {}, onContentSizeChange() {}, onViewportWidth() {} }) },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${values.count}` : key }) } };
  const Grid = compile(`qolip/QolipReadOnlyHomeGrid.${platform}.tsx`, mocks).QolipReadOnlyHomeGrid;
  const render = props => { records.length = 0; return renderToStaticMarkup(React.createElement(Grid, props)); }; let retries = 0;
  const onRetry = () => { retries++; }, markup = render({ locations: [{}], loading: false, error: false, searchCounts: {}, onRetry });
  assert.match(markup, /Mold/); assert.match(markup, /count:2/);
  assert.equal(records.some(record => record.props.onPress || record.props.onClick || record.props.onLongPress || record.props.onRefresh), false);
  assert.equal(records.flatMap(record => record.props.modifiers ?? []).some(value => /click|tap|long/i.test(value.name)), false);
  assert.match(render({ locations: null, loading: false, error: true, searchCounts: {}, onRetry }), /serverDisconnectedRetry/);
  records.find(record => record.name === 'Retry').props.onRetry(); assert.equal(retries, 1);
  assert.match(render({ locations: null, loading: false, error: true, refreshUnavailable: true, searchCounts: {}, onRetry }), /home.load_failed/);
  records.find(record => record.name === 'Retry').props.onRetry(); assert.equal(retries, 2);
});

test('retry surface uses the source label and a native button with the real callback', () => {
  const records = []; let retries = 0; const ui = { Host: component('Host', records), Button: component('Button', records) };
  const native = { Text: component('Text', records), View: component('View', records), StyleSheet: { create: value => value } };
  const Retry = compile('qolip/QolipReadOnlyRetry.tsx', { '@expo/ui': ui, 'react-native': native,
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { onSurfaceVariant: 'muted' } }) },
    '../shared/localization': { localizedGetter: key => key }, './useQolipText': { useQolipText: () => ({ locale: 'uz', text: key => key }) } }).QolipReadOnlyRetry;
  assert.match(renderToStaticMarkup(React.createElement(Retry, { onRetry: () => { retries++; } })), /serverDisconnectedRetry/);
  assert.equal(records.find(record => record.name === 'Host').props.matchContents, true);
  const button = records.find(record => record.name === 'Button'); assert.equal(button.props.label, 'retry'); assert.equal(button.props.variant, 'text');
  button.props.onPress(); assert.equal(retries, 1);
  records.length = 0; assert.match(renderToStaticMarkup(React.createElement(Retry, { refreshUnavailable: true, onRetry() {} })), /home.load_failed/);
});

test('candidate source has no route, mutation or lifecycle refresh in its dependency entry points', () => {
  const read = name => fs.readFileSync(path.join(root, `qolip/${name}`), 'utf8');
  const owner = read('qolipHomeOwnerState.ts'), runtime = read('qolipHomeOwnerRuntime.ts'), shell = read('QolipReadOnlyHome.tsx');
  assert.doesNotMatch(owner, /reorder:|routeChanged:|appResumed:|locationsChanged:/);
  assert.doesNotMatch(runtime, /setItem|saveOrder|qolipSave|qolipMove/);
  assert.doesNotMatch(shell, /router|onMenu|onProfile|onLongPress|onRefresh|printCell|openCell/);
  for (const api of ['qolipBlocksApi.ts', 'qolipLocationsApi.ts']) assert.doesNotMatch(read(api), /method:\s*['"](?:POST|PUT|DELETE)['"]|qolipCreate|qolipSave|qolipMove/);
});
