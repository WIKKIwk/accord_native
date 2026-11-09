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
const appearance = load('workerOrderAppearance.ts');
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) for (const mode of ['light', 'dark']) test(`${platform} ${mode} Sequence row shows rank, local cover and passive detail callback`, () => {
  const Background = Object.assign('Background', { Content: 'Background.Content' });
  const colors = { surfaceContainerLowest: '#ffffff', onSurface: 'on', onSurfaceVariant: 'muted', secondaryContainer: 'cover',
    onSecondaryContainer: 'cover-text', primaryContainer: 'badge', onPrimaryContainer: 'badge-text' };
  const Component = load(`admin/AdminWorkMapSequenceRow.${platform}.tsx`, {
    '@expo/ui': { ListItem: 'ListItem', Text: 'NativeText' }, '@expo/ui/swift-ui': { Background, Rectangle: 'Rectangle' },
    '@expo/ui/swift-ui/modifiers': { accessibilityHidden: value => ({ hidden: value }), foregroundStyle: value => ({ foreground: value }),
      font: value => ({ font: value }), lineLimit: value => ({ lines: value }), truncationMode: value => ({ truncation: value }) },
    'react-native': { StyleSheet: { create: x => x }, Text: 'RNText', View: 'View' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ mode, colors }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' },
    '../workerOrderAppearance': appearance,
  }).AdminWorkMapSequenceRow;
  let calls = 0; const tree = nodes(Component({ headline: '17 • Film', supportingText: 'Ana', position: 13, tone: 'paused', first: true, last: false, onPress: () => calls++ }));
  const row = tree.find(value => value.type === (platform === 'ios' ? 'ListItem' : 'Card')); assert.ok(row); row.props.onPress(); assert.equal(calls, 1);
  const content = platform === 'ios' ? nodes(row.props.leading) : tree;
  const cover = content.find(value => value.type === 'SymbolView'); assert.deepEqual(cover.props.name, platform === 'ios' ? { ios: 'function' } : { android: 'calculate' });
  assert.equal(content.find(value => value.type === 'RNText' && value.props.children === 13).props.children, 13);
  assert.equal(tree.some(value => value.type === 'Image' || value.type === 'Thumbnail'), false);
  if (platform === 'android') { assert.equal(row.props.first, true); assert.equal(row.props.last, false);
    assert.ok(tree.some(value => value.type === 'RNText' && value.props.children === '17 • Film'));
    assert.ok(tree.some(value => value.type === 'RNText' && value.props.children === 'Ana'));
    assert.equal(row.props.backgroundColor, appearance.orderCardAppearance('paused', colors.surfaceContainerLowest, mode === 'dark').color); }
  else { const background = tree.find(value => value.type === 'Rectangle');
    assert.equal(row.props.children.props.children, '17 • Film'); assert.equal(row.props.supportingText.props.children, 'Ana');
    assert.equal(background.props.modifiers[0].foreground, appearance.orderCardAppearance('paused', colors.surfaceContainerLowest, mode === 'dark').color); }
  const gradientTree = nodes(Component({ headline: '17 • Film', supportingText: '', position: 13, tone: 'print_preflight', onPress: () => {} }));
  if (platform === 'ios') assert.equal(gradientTree.find(value => value.type === 'Rectangle').props.modifiers[0].foreground.type, 'linearGradient');
  else assert.equal(gradientTree.find(value => value.type === 'Card').props.backgroundImage, appearance.orderCardAppearance('print_preflight', colors.surfaceContainerLowest, mode === 'dark').gradient);
});
