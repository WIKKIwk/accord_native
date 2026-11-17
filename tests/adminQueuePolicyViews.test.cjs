const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/admin', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function nodes(value, predicate) { if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(child => nodes(child, predicate)); return [...(predicate(value) ? [value] : []), ...nodes(value.props?.children, predicate)]; }
function render(platform, statePatch = {}, locked = false) {
  const calls = [], modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
  const components = new Proxy({}, { get: (_target, name) => name === 'TopAppBar' ? Object.assign(() => {}, { NavigationIcon: 'NavigationIcon', Title: 'Title', Actions: 'Actions' }) : name });
  const model = { current: true, state: { data: { apparatus: [{}], policies: {} }, loading: false, loadError: null, invalidated: false, ...statePatch },
    rows: [{ apparatus: { id: 'apparatus:test:one' }, title: 'Printing', policy: { policy: 'strict_sequence', locked }, saving: false, enabled: !locked, change: value => calls.push(value) }],
    navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') }, reload: () => calls.push('retry'), a: key => key, t: key => key };
  const colors = new Proxy({}, { get: () => '#123456' }), mocks = {
    '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 15 }) }, 'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    '../shared/orders/OrdersList.android': { OrdersList: 'OrdersList' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' },
    './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' }, './AdminTypography.android': { AdminText: 'Text' },
    './AdminWorkerDetailNative.android': { workerDetailAlpha: (color, value) => `${color}:${value}`, workerDetailShape: value => value, workerDetailSegmentShape: (index, count) => [index, count] },
    './useAdminQueuePolicy': { useAdminQueuePolicy: () => model },
  };
  const Screen = load(`AdminQueuePolicyScreen.${platform}.tsx`, mocks).AdminQueuePolicyScreen;
  return { tree: Screen({ footer: { type: 'ActualDock', props: {} }, profileAction: { type: 'ActualProfile', props: {} }, topNotice: { type: 'ActualNotice', props: {} } }), model, calls };
}
for (const platform of ['ios', 'android']) test(`${platform} queue policy keeps real notice, dock and native initial states`, () => {
  const f = render(platform); assert.equal(nodes(f.tree, node => node.type === 'ActualNotice').length, 1);
  assert.equal(nodes(f.tree, node => node.type === 'ActualDock').length, 1); assert.equal(nodes(f.tree, node => node.type === 'AdminShellBodyFrame')[0].props.hasFooter, true);
  const loading = render(platform, { data: null, loading: true }).tree;
  assert.equal(nodes(loading, node => node.type === (platform === 'ios' ? 'ProgressView' : 'AdminLoadingIndicator')).length, 1);
  const failed = render(platform, { data: null, loadError: new Error('offline') });
  const retry = nodes(failed.tree, node => node.type === (platform === 'ios' ? 'Button' : 'TextButton')).find(node => platform === 'android' || node.props.label === 'retry');
  (retry.props.onClick ?? retry.props.onPress)(); assert.deepEqual(failed.calls, ['retry']);
});
test('Android queue options preserve strict/free order, selected taps, locked disablement and source list reserve', () => {
  const f = render('android'), list = nodes(f.tree, node => node.type === 'OrdersList')[0];
  assert.equal(list.props.onRefresh, undefined); assert.equal(list.props.topInset, 4); assert.equal(list.props.footer.props.style.height, 143);
  const entry = list.props.renderRow(f.model.rows[0], 0), tile = entry.type(entry.props);
  const options = nodes(tile, node => node.type === 'Surface' && node.props.selected !== undefined);
  assert.deepEqual(options.map(node => node.props.selected), [true, false]); options[0].props.onClick(); assert.deepEqual(f.calls, ['strict_sequence']);
  const locked = render('android', {}, true), lockedList = nodes(locked.tree, node => node.type === 'OrdersList')[0], lockedEntry = lockedList.props.renderRow(locked.model.rows[0], 0);
  const lockedOptions = nodes(lockedEntry.type(lockedEntry.props), node => node.type === 'Surface' && node.props.selected !== undefined);
  assert.ok(lockedOptions.every(node => node.props.enabled === false && node.props.onClick === undefined));
});
test('iOS queue uses a native segmented picker with source values and a comfortable disabled control', () => {
  const f = render('ios'), picker = nodes(f.tree, node => node.type === 'Picker')[0];
  assert.equal(picker.props.selection, 'strict_sequence'); assert.deepEqual(picker.props.children.map(child => child.props.modifiers[0].args[0]), ['strict_sequence', 'free_pick']);
  picker.props.onSelectionChange('free_pick'); assert.deepEqual(f.calls, ['free_pick']);
  const locked = nodes(render('ios', {}, true).tree, node => node.type === 'Picker')[0];
  assert.equal(locked.props.modifiers.find(item => item.name === 'disabled').args[0], true);
  assert.equal(locked.props.modifiers.find(item => item.name === 'frame').args[0].minHeight, 44);
});
