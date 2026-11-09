const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: read-only Paddon content preserves source order, states and real refresh callback`, () => {
    const state = { phase: 'ready', scope: { needsApparatus: false }, refreshing: false }, calls = [];
    const content = { title: 'Paddon Rezka', subtitle: 'Subtitle', loadFailed: 'Failed', retry: 'Retry', options: [{ id: 'a', title: 'Paddon A' }, { id: 'b', title: 'Paddon B' }],
      summaryTitle: 'Location title', summarySubtitle: 'Location subtitle', paddonMetric: 'Paddons: 2', wipMetric: 'WIP: 5',
      emptyTitle: 'Empty title', emptyBody: 'Empty body', rows: [{ code: 'P1', count: '2 WIP', subtitle: 'Peremotka' }, { code: 'P2', count: '3 WIP', subtitle: '' }] };
    let current = true; const snapshot = { session: {} }, navigation = { icon: 'back', label: 'Back', onPress() {} };
    const components = new Proxy({ useMaterialColors: () => ({}) }, { get: (value, key) => value[key] ?? key });
    const modifiers = new Proxy({}, { get: (_value, key) => (...args) => ({ name: key, args }) });
    const { RezkaPaddonReadOnly } = load(`rezka/RezkaPaddonReadOnly.${platform}.tsx`, {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
        ActivityIndicator: 'ActivityIndicator', PlatformColor: value => value },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 11 }) },
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
      '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
      './useRezkaPaddonList': { useRezkaPaddonList: (value, id, name) => { assert.equal(value, snapshot); assert.equal(id, 'a'); assert.equal(name, 'Rezka');
        return { state, content, controller: { refresh: () => { calls.push('refresh'); return Promise.resolve(); } }, isCurrent: () => current }; } } });
    const render = () => RezkaPaddonReadOnly({ snapshot, apparatusId: 'a', apparatusName: 'Rezka', navigation });
    const page = render(), texts = nodes(page, n => n.type === 'Text').map(n => n.props.children);
    const expected = ['Location title', 'Location subtitle', 'Paddons: 2', 'WIP: 5', 'P1', '2 WIP', 'Peremotka', 'P2', '3 WIP'];
    if (platform === 'android') expected.splice(4, 0, 'Paddon Rezka');
    assert.deepEqual(texts, expected); assert.equal(nodes(page, n => ['Pressable', 'Button'].includes(n.type)).length, 0);
    if (platform === 'ios') {
      const header = nodes(page, n => n.type === 'Stack.Screen')[0].props.options;
      assert.equal(header.title, content.title); assert.equal(header.headerLeft().props.onPress, navigation.onPress);
      assert.deepEqual(nodes(header.headerTitle(), n => n.type === 'Text').map(n => n.props.children), [content.title, content.subtitle]);
      const list = nodes(page, n => n.type === 'List')[0]; list.props.modifiers.find(m => m.name === 'refreshable').args[0]();
    } else {
      const header = nodes(page, n => n.type === 'RoleHeader')[0]; assert.equal(header.props.subtitle, content.subtitle);
      assert.equal(header.props.navigation, navigation);
      const scroll = nodes(page, n => n.type === 'ScrollView')[0]; assert.equal(scroll.props.contentContainerStyle.paddingBottom, 131);
      assert.equal(scroll.props.refreshControl.props.refreshing, false); scroll.props.refreshControl.props.onRefresh();
    }
    assert.deepEqual(calls, ['refresh']);
    state.phase = 'loading'; assert.equal(nodes(render(), n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
    state.phase = 'error'; const error = render(); assert.deepEqual(nodes(error, n => n.type === 'Text').map(n => n.props.children).slice(0, 1), ['Failed']);
    const button = nodes(error, n => n.type === 'Button')[0]; (button.props.onPress ?? button.props.onClick)(); assert.deepEqual(calls, ['refresh', 'refresh']);
    state.phase = 'ready'; content.rows = [];
    assert.ok(nodes(render(), n => n.type === 'Text').some(n => n.props.children === 'Empty title'));
    state.scope.needsApparatus = true;
    assert.deepEqual(nodes(render(), n => n.type === 'Text').map(n => n.props.children), ['Paddon A', 'Paddon B']);
    assert.equal(nodes(render(), n => ['Pressable', 'Button'].includes(n.type)).length, 0);
    state.phase = 'unavailable'; assert.equal(render(), null); state.phase = 'invalid'; assert.equal(render(), null);
    state.phase = 'ready'; current = false; assert.equal(render(), null);
  });
}
