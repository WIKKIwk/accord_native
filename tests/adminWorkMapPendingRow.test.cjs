const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const numeric = load('admin/adminDartDouble.ts');
const present = load('admin/adminWorkMapPresentation.ts', { '../shared/localization': { productionText: () => 'Order' },
  '../workerOrderAppearance': { workerOrderTone: state => state || 'neutral' }, './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) },
  './adminDartDouble': numeric }).adminWorkMapPresentation;
test('pending list title always preserves raw code, separator and title without invented fallback', () => {
  const row = { kind: 'pending', code: '', title: '', customer: '', kg: -0, displayState: 'pending' };
  assert.equal(present(row, 'en').headline, ' • '); assert.equal(present(row, 'en').supporting, ' · -0.0 kg · Chala buyurtma');
  assert.equal(present({ ...row, code: ' 17 ', title: ' Film ' }, 'en').headline, ' 17  •  Film ');
  assert.equal(present({ ...row, kg: 1e-7 }, 'en').supporting, ' · 1e-7 kg · Chala buyurtma');
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) for (const mode of ['light', 'dark']) test(`${platform} ${mode} pending row keeps source tint, passive cover and info callback`, () => {
  const calls = [], native = { Image: 'Image', Text: 'NativeText' };
  const View = load(`admin/AdminWorkMapPendingRow.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem', Text: 'NativeText' },
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': { accessibilityHidden: () => ({}), listRowBackground: value => ({ background: value }) },
    'react-native': { View: 'View', Text: 'RNText', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    'expo-symbols': { SymbolView: 'SymbolView' }, '../components/useBaseTheme': { useBaseTheme: () => ({ mode, colors: { onSurface: 'on', onSurfaceVariant: 'muted', secondaryContainer: 'field', onSecondaryContainer: 'ink' } }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' },
  }).AdminWorkMapPendingRow;
  const tree = nodes(View({ headline: '17 • Film', supportingText: 'Ana · 1.0 kg · Chala buyurtma',
    infoLabel: 'Info', first: true, last: false, onPress: () => calls.push('open') }));
  const row = tree.find(node => node.type === (platform === 'ios' ? 'ListItem' : 'Card'));
  assert.ok(row); row.props.onPress(); const cover = (platform === 'ios' ? nodes(row.props.leading) : tree).find(node => node.type === 'SymbolView');
  assert.deepEqual(cover.props.name, platform === 'ios' ? { ios: 'function' } : { android: 'calculate' });
  assert.equal(tree.some(node => node.type === 'Thumbnail'), false);
  const expected = mode === 'dark' ? '#3D2859' : '#EDE0FF';
  assert.ok(platform === 'ios' ? row.props.modifiers.some(value => value.background === expected) : row.props.backgroundColor === expected);
  if (platform === 'android') { const info = tree.find(node => node.type === 'Pressable'); assert.equal(info.props.accessibilityLabel, 'Info');
    let stopped = false; info.props.onPress({ stopPropagation: () => { stopped = true; } }); assert.equal(stopped, true); }
  assert.deepEqual(calls, platform === 'ios' ? ['open'] : ['open', 'open']);
});
