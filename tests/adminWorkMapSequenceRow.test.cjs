/* global __dirname */
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
for (const mode of ['light', 'dark']) {
  const colors = { surfaceContainerLowest: '#ffffff', onSurface: 'on', onSurfaceVariant: 'muted', secondaryContainer: 'cover',
    onSecondaryContainer: 'cover-text', primaryContainer: 'badge', onPrimaryContainer: 'badge-text' };
  test(`iOS ${mode} Sequence row retains its own local cover, rank and detail callback`, () => {
    const Background = Object.assign('Background', { Content: 'Background.Content' });
    const Component = load('admin/AdminWorkMapSequenceRow.ios.tsx', {
      '@expo/ui': { ListItem: 'ListItem', Text: 'NativeText' }, '@expo/ui/swift-ui': { Background, Rectangle: 'Rectangle', ZStack: 'ZStack' },
      '@expo/ui/swift-ui/modifiers': { accessibilityHidden: value => ({ hidden: value }), foregroundStyle: value => ({ foreground: value }),
        font: value => ({ font: value }), lineLimit: value => ({ lines: value }), truncationMode: value => ({ truncation: value }) },
      'react-native': { StyleSheet: { create: x => x }, Text: 'RNText', View: 'View' }, 'expo-symbols': { SymbolView: 'SymbolView' },
      '../components/useBaseTheme': { useBaseTheme: () => ({ mode, colors }) }, '../workerOrderAppearance': appearance,
    }).AdminWorkMapSequenceRow;
    let calls = 0;
    const tree = nodes(Component({ headline: '17 • Film', supportingText: 'Ana', position: 13, tone: 'paused', onPress: () => calls++ }));
    const row = tree.find(value => value.type === 'ListItem'); row.props.onPress(); assert.equal(calls, 1);
    const leading = nodes(row.props.leading);
    assert.deepEqual(leading.find(value => value.type === 'SymbolView').props.name, { ios: 'function' });
    assert.ok(leading.some(value => value.type === 'RNText' && value.props.children === 13));
    assert.equal(row.props.children.props.children, '17 • Film'); assert.equal(row.props.supportingText.props.children, 'Ana');
    const rects = tree.filter(value => value.type === 'Rectangle');
    assert.equal(rects[0].props.modifiers[0].foreground, colors.surfaceContainerLowest);
    assert.equal(rects[1].props.modifiers[0].foreground, appearance.orderCardAppearance('paused', undefined, mode === 'dark').overlay);
    const preflight = nodes(Component({ headline: '17 • Film', supportingText: '', position: 13, tone: 'print_preflight', onPress() {} }));
    assert.equal(preflight.find(value => value.type === 'Rectangle').props.modifiers[0].foreground.type, 'linearGradient');
  });

  test(`Android ${mode} Sequence adornment shares the Worker card, image, color and detail callback`, () => {
    const Component = load('shared/orders/OrderListItem.android.tsx', {
      react: { useContext: () => colors }, 'react-native': { StyleSheet: { create: x => x }, Text: 'RNText', View: 'View', useColorScheme: () => mode },
      '../../workerOrderAppearance': appearance, '../../components/workerOrderPalette': {},
      '../../components/WorkerOrderThumbnail': { WorkerOrderThumbnail: 'WorkerThumbnail' },
      '../../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' },
    }).OrderListItem;
    const rank = { type: 'Rank', props: { position: 13 } }, session = {}, calls = [];
    const props = { session, orderId: 'order', imageId: 'image', imageActive: true, headline: '17 • Film', supportingText: 'Ana',
      leadingAdornment: rank, cardTone: 'paused', first: true, last: false, onPress: () => calls.push('open') };
    const row = Component(props), tree = nodes(row);
    assert.equal(row.type, 'Card'); assert.equal(row.props.first, true); assert.equal(row.props.last, false); row.props.onPress();
    const image = tree.find(node => node.type === 'WorkerThumbnail');
    assert.equal(image.props.session, session); assert.equal(image.props.imageId, 'image'); assert.equal(image.props.active, true);
    assert.equal(tree.find(node => node.type === 'Rank'), rank);
    assert.deepEqual(tree.filter(node => node.type === 'RNText').map(node => node.props.children), ['17 • Film', 'Ana']);
    assert.deepEqual(calls, ['open']);
    assert.equal(row.props.backgroundColor, appearance.orderCardAppearance('paused', colors.surfaceContainerLowest, mode === 'dark').color);
    assert.equal(Component({ ...props, cardTone: 'print_preflight', leadingAdornment: undefined }).props.backgroundImage,
      appearance.orderCardAppearance('print_preflight', colors.surfaceContainerLowest, mode === 'dark').gradient);
  });
}
