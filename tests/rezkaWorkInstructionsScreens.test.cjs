const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (typeof node.type === 'function' && node.type.name === 'InstructionsSection') return nodes(node.type(node.props), predicate);
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
for (const platform of ['ios', 'android']) {
  test(`${platform}: instructions preserve read-only content order, numbered steps and both empty/loading states`, () => {
    const state = { phase: 'ready' }, section = (title, count) => ({ title, items: Array.from({ length: count }, (_, index) => `${index + 1}. ${title} step`) });
    const content = { title: 'App yo‘riqnomasi', subtitle: 'Subtitle', intro: 'Intro', emptyTitle: 'Empty title', emptyBody: 'Empty body',
      common: [section('Open order', 5), section('States', 4)], guides: [{ id: 'mine', name: 'Mine', kind: 'Cutting',
        sections: [section('Before', 3), section('Pause', 3), section('Complete', 3), section('Partial', 3)] }] };
    let current = true; const snapshot = { session: {} }, navigation = { icon: 'menu', label: 'Menu', onPress() {} };
    const components = new Proxy({ useMaterialColors: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
    const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
    const { RezkaWorkInstructionsScreen } = load(`rezka/RezkaWorkInstructions.${platform}.tsx`, {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', PlatformColor: value => value },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 11 }) },
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
      '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
      './useRezkaWorkInstructions': { useRezkaWorkInstructions: value => { assert.equal(value, snapshot); return { state, content, isCurrent: () => current }; } } });
    const render = () => {
      const entry = RezkaWorkInstructionsScreen({ snapshot, navigation });
      assert.equal(entry.type.name, 'WorkInstructionsView');
      assert.equal(entry.props.navigation, navigation);
      return entry.type(entry.props);
    };
    const flattenSection = value => [value.title, ...value.items];
    const expected = [content.intro, ...content.common.flatMap(flattenSection), 'Mine', 'Cutting', ...content.guides[0].sections.flatMap(flattenSection)];
    const page = render(); assert.deepEqual(nodes(page, node => node.type === 'Text').map(node => node.props.children), expected);
    assert.equal(nodes(page, node => ['Button', 'TextButton', 'RefreshControl'].includes(node.type)).length, 0);
    if (platform === 'ios') {
      const header = nodes(page, node => node.type === 'Stack.Screen')[0].props.options;
      assert.equal(header.title, content.title); assert.equal(header.headerLeft().props.onPress, navigation.onPress);
      assert.deepEqual(nodes(header.headerTitle(), node => node.type === 'Text').map(node => node.props.children), [content.title, content.subtitle]);
    } else {
      const header = nodes(page, node => node.type === 'RoleHeader')[0]; assert.equal(header.props.subtitle, content.subtitle); assert.equal(header.props.navigation, navigation);
      assert.equal(nodes(page, node => node.type === 'ScrollView')[0].props.contentContainerStyle.paddingBottom, 131);
    }
    state.phase = 'loading'; assert.equal(nodes(render(), node => node.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
    state.phase = 'ready'; content.guides = [];
    assert.deepEqual(nodes(render(), node => node.type === 'Text').map(node => node.props.children), ['Empty title', 'Empty body']);
    current = false; assert.equal(render(), null); current = true; state.phase = 'invalid'; assert.equal(render(), null);
  });
}
test('iOS instructions route retains its shell witness and uses native back or the existing drawer action', () => {
  const snapshot = { session: {} }, openDrawer = () => {}; let back = false;
  const Component = load('app/ios-rezka/(home)/instructions.tsx', { 'react/jsx-runtime': jsx,
    'expo-router': { router: { canGoBack: () => back } }, '../../../shared/localization': { localizedGetter: () => 'Sections' },
    '../../../rezka/RezkaWorkInstructions': { RezkaWorkInstructionsScreen: 'Instructions' },
    '../../../rezka/RezkaShellContext': { useRezkaShellContext: () => ({ snapshot, openDrawer }) },
    '../../../rezka/useRezkaShell': { useRezkaLocale: () => 'uz' } }).default;
  const page = Component(); assert.equal(page.props.snapshot, snapshot); assert.equal(page.props.navigation.onPress, openDrawer);
  back = true; assert.equal(Component().props.navigation, null);
});
