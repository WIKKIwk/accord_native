/* global __dirname */
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
function picker(platform) {
  const filename = path.resolve(__dirname, `../src/shared/orders/PickerSheetContent.${platform}.tsx`);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const nativeState = value => ({ get: () => value, set: next => { value = next; } });
  const colors = { onSurface: 'text', onSurfaceVariant: 'muted', surfaceContainerHighest: 'surface', outlineVariant: 'border', primary: 'primary' };
  const swift = { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', ProgressView: 'ProgressView',
    Text: 'Text', TextField: 'TextField', VStack: 'VStack', useNativeState: nativeState };
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useEffect: fn => fn() },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: nativeState },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => colors },
    '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_, name) => value => ({ name, value }) }),
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View',
      StyleSheet: { create: value => value, hairlineWidth: 1 } },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reanimated': { useSharedValue: nativeState },
    '../../components/WorkerIconButton.android': { WorkerIconButton: 'WorkerIconButton' },
    '../../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    './OrdersList': { OrdersList: 'OrdersList' },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports.PickerSheetContent;
}

for (const platform of ['android', 'ios']) {
  test(`${platform} preparation picker keeps search, selection, photo search and paging on the shared list`, () => {
    const render = picker(platform), calls = [];
    const items = [{ key: 'one', title: 'Order 1', subtitle: '001', select: () => calls.push('one') },
      { key: 'two', title: 'Order 2', subtitle: '002', select: () => calls.push('two') }];
    const props = { title: 'Order tanlang', hint: 'Qidirish', closeLabel: 'Yopish', emptyLabel: 'Bo‘sh', items,
      hasMore: true, onSearch: query => calls.push(['search', query]), onClose: () => calls.push('close'),
      onLoadMore: () => calls.push('next'), onPhoto: () => calls.push('photo'), photoLabel: 'Rasm' };
    const tree = render(props), list = nodes(tree, node => node.type === 'OrdersList')[0];
    assert.equal(list.props.rows, items);
    const first = list.props.renderRow(items[0], 0), last = list.props.renderRow(items[1], 1);
    assert.ok(nodes(last, node => node.props?.children === 'Order 2').length);
    assert.ok(nodes(last, node => node.props?.children === '002').length);
    if (platform === 'android') {
      nodes(tree, node => node.type === 'TextInput')[0].props.onChangeText('qog‘oz');
      nodes(tree, node => node.type === 'WorkerIconButton')[0].props.onPress();
      nodes(tree, node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Rasm')[0].props.onPress();
      assert.equal(first.props.first, true); assert.equal(last.props.last, true);
      last.props.onPress(); list.props.onEndReached();
      nodes(render({ ...props, loading: true }), node => node.type === 'OrdersList')[0].props.onEndReached();
      nodes(render({ ...props, hasMore: false }), node => node.type === 'OrdersList')[0].props.onEndReached();
    } else {
      nodes(tree, node => node.type === 'TextField')[0].props.onTextChange('qog‘oz');
      nodes(tree, node => node.type === 'Button' && node.props.label === 'Yopish')[0].props.onPress();
      nodes(tree, node => node.type === 'Button' && node.props.label === 'Rasm')[0].props.onPress();
      last.props.onPress(); last.props.modifiers.find(modifier => modifier.name === 'onAppear').value();
      const busyList = nodes(render({ ...props, loading: true }), node => node.type === 'OrdersList')[0];
      busyList.props.renderRow(items[1], 1).props.modifiers.find(modifier => modifier.name === 'onAppear').value();
      const finalList = nodes(render({ ...props, hasMore: false }), node => node.type === 'OrdersList')[0];
      assert.equal(finalList.props.renderRow(items[1], 1).props.modifiers.some(modifier => modifier.name === 'onAppear'), false);
    }
    assert.deepEqual(calls, [['search', 'qog‘oz'], 'close', 'photo', 'two', 'next']);
  });
}

test('the shared Android picker supports passive group headings and opt-in multi-selection with a separate confirm action', () => {
  const calls = [], render = picker('android');
  const items = [{ key: 'default', title: 'Default', heading: true }, { key: 'a', title: 'A', selected: true, select: () => calls.push('toggle') },
    { key: 'custom', title: 'Custom', heading: true }, { key: 'b', title: 'B', selected: false, select: () => calls.push('other') }];
  const tree = render({ title: 'Equipment', closeLabel: 'Close', onClose: () => calls.push('close'), items, showSelectionIndicator: true,
    footerAction: jsx.jsx('Confirm', { onPress: () => calls.push('confirm') }) });
  const list = nodes(tree, node => node.type === 'OrdersList')[0], heading = list.props.renderRow(items[0], 0), choice = list.props.renderRow(items[1], 1);
  assert.equal(heading.props.accessibilityRole, 'header'); assert.equal(heading.props.onPress, undefined);
  assert.equal(choice.props.first, true); assert.equal(choice.props.last, true); assert.equal(choice.props.selected, true);
  assert.equal(nodes(choice, node => node.type === 'SymbolView')[0].props.name.android, 'check_circle');
  choice.props.onPress(); nodes(tree, node => node.type === 'Confirm')[0].props.onPress();
  assert.deepEqual(calls, ['toggle', 'confirm']);
});
