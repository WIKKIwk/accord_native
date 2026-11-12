const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const catalog = require('../src/shared/localization/catalog.json');
const localization = load('shared/localization/index.ts', { './catalog.json': catalog });
const orderText = load('workerOrderText.ts', { './shared/localization/catalog.json': catalog, './shared/localization': localization });
const detail = { map: { base_length: 25601, order_kg: 100, roll_count: 6, width_mm: 375, standard_print_side: false },
  stages: ['Start', 'shashogcha', '8 ta rangli bosma aparat', 'Laminatsiya 1', 'Rezka', 'shashogcha'].map((title, index) => ({
    id: `stage-${index}`, apparatusId: [2, 3, 4].includes(index) ? `machine-${index}` : '', title,
    state: index === 2 ? 'in_progress' : 'pending',
  })) };

function harness(initial = detail) {
  const slots = [], opened = [];
  let cursor = 0, locale = 'uz';
  const props = { session: { imageCacheScope: 'worker', profile: { ref: 'worker' } }, orderId: 'order', code: '0337',
    title: 'Tea', imageId: 'image', detail: initial };
  const close = () => {};
  const { useWorkerOrderOverview } = load('components/useWorkerOrderOverview.ts', {
    react: { createElement: React.createElement,
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
        return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    '../nativeSheet': { useNativeSheet: () => ({ open: (element, options) => opened.push({ element, options }), close }) },
    '../shared/localization': localization,
    '../workerOrderText': orderText,
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() {} } },
    './WorkerWipHistory': { WorkerWipHistory: 'History' },
  });
  return { props, opened, close, setLocale: value => { locale = value; },
    render: () => { cursor = 0; return useWorkerOrderOverview(props); } };
}

test('planned meters retain 500m rounding and print-side/shaft details retain V2 values', () => {
  const h = harness(), model = h.render();
  assert.deepEqual(model.metrics.map(row => [row.id, row.value, row.unit]), [['length', '26000', 'm'], ['weight', '100', 'kg']]);
  assert.deepEqual(model.facts.map(row => row.value), ['6 ta 375 mm eniga ega bo‘lgan val ishlatiladi', 'Nostandart']);
  for (const [value, expected] of [[0.1, '500'], [500, '500'], [500.1, '1000']]) {
    h.props.detail = { ...detail, map: { base_length: value } };
    assert.equal(h.render().metrics[0].value, expected);
  }
});

test('invalid or unavailable numeric metadata stays hidden; missing width keeps the existing dash', () => {
  const h = harness();
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity, '100']) {
    h.props.detail = { ...detail, map: { base_length: invalid, order_kg: invalid, roll_count: invalid } };
    const model = h.render(); assert.deepEqual(model.metrics, []); assert.equal(model.facts.length, 1);
  }
  h.props.detail = { ...detail, map: { roll_count: 2 } };
  assert.equal(h.render().facts[0].value, '2 ta — mm eniga ega bo‘lgan val ishlatiladi');
  const pending = harness(null), model = pending.render(); model.toggle();
  assert.equal(pending.render().expanded, false); assert.equal(model.enabled, false);
});

test('stage history retains the current order, identity, apparatus labels and native-sheet dismissal', () => {
  const h = harness(), model = h.render(); model.openStage(''); assert.equal(h.opened.length, 0);
  model.openStage('machine-2');
  assert.equal(h.opened.length, 1);
  const { element, options } = h.opened[0];
  assert.equal(element.props.session, h.props.session);
  assert.deepEqual(element.props.order, { id: 'order', code: '0337', title: 'Tea', imageId: 'image', apparatusId: 'machine-2' });
  assert.deepEqual(element.props.apparatusNames, { 'machine-2': '8 ta rangli bosma aparat', 'machine-3': 'Laminatsiya 1', 'machine-4': 'Rezka' });
  assert.equal(element.props.stageHistory, true); assert.equal(element.props.onClose, h.close);
  assert.deepEqual(options, { dismissible: true });
  h.props.orderId = 'next'; h.render().openStage('machine-4');
  assert.equal(h.opened[1].element.props.order.id, 'next');
});

const native = new Proxy({}, { get: (_target, key) => String(key) });
const androidNative = new Proxy({ useMaterialColors: () => ({ onSurfaceVariant: 'label', surfaceContainerHighest: 'surface' }) },
  { get: (target, key) => target[key] ?? String(key) });
const layout = load('components/workerOrderLayout.ts');
const noticeHyphenation = load('workerNoticeHyphenation.ts');
const modifiers = new Proxy({}, { get: (_target, key) => key === 'shapes'
  ? { rectangle: () => ({ type: 'rectangle' }), roundedRectangle: value => ({ type: 'roundedRectangle', ...value }) } : (...args) => ({ name: String(key), args }) });
const mocks = { '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  './useBaseTheme': { useBaseTheme: () => ({ colors: { onSurface: 'label', surfaceContainerHighest: 'surface' } }) },
  './useWorkerOrderText': { useWorkerOrderText: () => ({ locale: 'uz' }) },
  '../workerNoticeHyphenation': noticeHyphenation,
  'react-native': { Platform: { Version: '26.1.1' }, PlatformColor: name => name, Text: 'Text', View: 'View' }, './BaseHost': { BaseHost: 'Host' }, './workerOrderLayout': layout };
const byId = (tree, id) => nodes(tree, item => item.props.modifiers?.some(modifier => modifier.name === 'accessibilityIdentifier' && modifier.args[0] === id))[0];

test('Android compact sheet fits its content and limits tall menus to the available screen', () => {
  const { WorkerOrderSheet } = load('components/WorkerOrderSheet.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'Host', ModalBottomSheet: 'ModalBottomSheet', RNHostView: 'RNHostView' },
    'react-native': { ScrollView: 'ScrollView', View: 'View', useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    './useWorkerColors': { useWorkerColors: () => ({ field: 'surface' }) },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'Provider' } },
  });
  let closed = 0;
  const tree = WorkerOrderSheet({ children: 'actions', onClose: () => closed++, dismissible: true, compact: true, fitContent: true, heightFraction: 0.86 });
  const sheet = nodes(tree, item => item.type === 'ModalBottomSheet')[0];
  const container = nodes(tree, item => item.type === 'View')[0];
  const scroll = nodes(tree, item => item.type === 'ScrollView')[0];
  assert.deepEqual(container.props.style, { width: 400, maxHeight: Math.round((800 - 24) * 0.86), paddingBottom: 16 });
  assert.deepEqual(scroll.props.style, { flexGrow: 0, flexShrink: 1 });
  assert.equal(sheet.props.sheetGesturesEnabled, true);
  sheet.props.onDismissRequest(); assert.equal(closed, 1);
  const fixed = WorkerOrderSheet({ children: 'other sheet', onClose: () => {}, compact: true });
  assert.equal(nodes(fixed, item => item.type === 'View')[0].props.style.height, Math.round((800 - 24) * 0.65));
});

test('Android action button applies the standard height inside a full-width host', () => {
  const { WorkerSheetButton } = load('components/WorkerSheetButton.tsx', {
    '@expo/ui': { Button: 'Button', Host: 'Host', RNHostView: 'RNHostView', Row: 'Row', Text: 'ComposeText' },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { StyleSheet: { create: value => value }, useColorScheme: () => 'dark' },
    './useWorkerColors': { useWorkerColors: () => ({ icon: 'icon' }) },
  });
  let selected = 0;
  const tree = WorkerSheetButton({ label: 'Astatka', icon: { android: 'logout' }, height: 56, onPress: () => selected++ });
  assert.equal(tree.props.style.width, '100%');
  const button = nodes(tree, item => item.type === 'Button')[0];
  assert.deepEqual(button.props.style, { height: 56 });
  button.props.onPress(); assert.equal(selected, 1);
});

test('native iOS summary expands all metrics and six production stages, keeping apparatus rows actionable', () => {
  const h = harness();
  const { WorkerOrderOverview } = load('components/WorkerOrderOverview.ios.tsx', { ...mocks,
    './useWorkerOrderOverview': { useWorkerOrderOverview: () => h.render() } });
  let tree = WorkerOrderOverview(h.props);
  assert.equal(nodes(tree, item => item.type === 'ListItem').length, 0);
  assert.equal(byId(tree, 'worker-order-metric-length'), undefined);
  byId(tree, 'worker-order-summary').props.onPress(); tree = WorkerOrderOverview(h.props);
  assert.equal(text(byId(tree, 'worker-order-metric-length')).includes('26000'), true);
  assert.equal(text(tree).includes('6 ta 375 mm eniga ega bo‘lgan val ishlatiladi'), true);
  for (const stage of detail.stages) assert.equal(text(tree).includes(stage.title), true);
  const stages = nodes(tree, item => item.type === 'Button' && item.props.modifiers?.some(modifier => modifier.args[0]?.startsWith?.('worker-order-stage-')));
  assert.equal(stages.length, 3); stages.forEach(row => row.props.onPress());
  assert.deepEqual(h.opened.map(entry => entry.element.props.order.apparatusId), ['machine-2', 'machine-3', 'machine-4']);
  byId(tree, 'worker-order-summary').props.onPress(); tree = WorkerOrderOverview(h.props);
  assert.equal(byId(tree, 'worker-order-metric-length'), undefined);
});

test('Android expected result uses compact V2 label/value rows and keeps stage navigation', () => {
  const h = harness();
  let palette = { surface: 'surface', text: 'onSurface', muted: 'onSurfaceVariant', icon: 'icon' };
  const { WorkerOrderOverview } = load('components/WorkerOrderOverview.android.tsx', {
    '@expo/ui': { Column: 'UniversalColumn', Host: 'UniversalHost', ListItem: 'ListItem', RNHostView: 'UniversalRNHostView', Text: 'UniversalText' },
    '@expo/ui/jetpack-compose': { Column: 'ComposeColumn', Row: 'ComposeRow', RNHostView: 'ComposeRNHostView', Text: 'ComposeText' },
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    './BaseHost': { BaseHost: 'BaseHost' },
    './useWorkerColors': { useWorkerColors: () => palette },
    './useWorkerOrderOverview': { useWorkerOrderOverview: () => h.render() },
  });
  let tree = WorkerOrderOverview(h.props);
  const header = nodes(tree, node => node.type === 'ListItem')[0];
  assert.equal(text(header), 'Kutilayotgan natija');
  assert.equal(header.props.supportingText, 'Buyurtma bo‘yicha taxminiy ma’lumotlar');
  assert.equal(nodes(tree, node => node.type === 'ComposeRow').length, 0);
  header.props.onPress(); tree = WorkerOrderOverview(h.props);
  const rows = nodes(tree, node => node.type === 'ComposeRow' && node.props.horizontalArrangement?.spacedBy === 10);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => nodes(row, node => node.type === 'ComposeText').map(text)), [
    ['Metraj', '26000 m'], ['Og‘irlik', '100 kg'], ['Val', '6 ta 375 mm eniga ega bo‘lgan val ishlatiladi'], ['Taraf', 'Nostandart'],
  ]);
  for (const row of rows) {
    const spacing = row.props.modifiers.find(modifier => modifier.name === 'padding').args;
    assert.ok(spacing[1] <= 8 && spacing[3] <= 8, 'each information row keeps a compact vertical inset');
    const [label, value] = nodes(row, node => node.type === 'ComposeText');
    assert.equal(label.props.color, 'onSurfaceVariant'); assert.equal(value.props.color, 'onSurface');
    assert.equal(value.props.maxLines, undefined, 'long values may wrap without truncation');
    assert.equal(value.props.modifiers.some(modifier => modifier.name === 'weight' && modifier.args[0] === 1), true);
  }
  assert.deepEqual(nodes(tree, node => node.type === 'SymbolView').slice(0, 4).map(node => node.props.name.android),
    ['straighten', 'scale', 'view_column', 'explore']);
  const stageRows = nodes(tree, node => node.type === 'ListItem').slice(1);
  assert.equal(stageRows.length, 6);
  stageRows.filter(row => row.props.onPress).forEach(row => row.props.onPress());
  assert.deepEqual(h.opened.map(entry => entry.element.props.order.apparatusId), ['machine-2', 'machine-3', 'machine-4']);
  palette = { surface: 'lightSurface', text: 'lightText', muted: 'lightSecondary', icon: 'lightIcon' };
  tree = WorkerOrderOverview(h.props);
  const lightLabels = nodes(tree, node => node.type === 'ComposeText');
  assert.equal(lightLabels[0].props.color, 'lightSecondary'); assert.equal(lightLabels[1].props.color, 'lightText');
  nodes(tree, node => node.type === 'ListItem')[0].props.onPress(); tree = WorkerOrderOverview(h.props);
  assert.equal(nodes(tree, node => node.type === 'ComposeRow').length, 0);
});

test('Android expected result remains disabled until details are available and omits missing values', () => {
  const h = harness(null);
  const { WorkerOrderOverview } = load('components/WorkerOrderOverview.android.tsx', {
    '@expo/ui': { Column: 'UniversalColumn', Host: 'UniversalHost', ListItem: 'ListItem', RNHostView: 'UniversalRNHostView', Text: 'UniversalText' },
    '@expo/ui/jetpack-compose': { Column: 'ComposeColumn', Row: 'ComposeRow', RNHostView: 'ComposeRNHostView', Text: 'ComposeText' },
    '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    './BaseHost': { BaseHost: 'BaseHost' },
    './useWorkerColors': { useWorkerColors: () => ({ surface: 'surface', text: 'onSurface', muted: 'onSurfaceVariant', icon: 'icon' }) },
    './useWorkerOrderOverview': { useWorkerOrderOverview: () => h.render() },
  });
  let tree = WorkerOrderOverview(h.props);
  assert.equal(nodes(tree, node => node.type === 'ListItem')[0].props.onPress, undefined);
  h.props.detail = { ...detail, map: {} };
  tree = WorkerOrderOverview(h.props); nodes(tree, node => node.type === 'ListItem')[0].props.onPress(); tree = WorkerOrderOverview(h.props);
  const values = nodes(tree, node => node.type === 'ComposeText').map(text);
  assert.deepEqual(values, ['Taraf', 'Standart']);
});

test('overview metadata uses the active locale without changing the order values', () => {
  const h = harness();
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    h.setLocale(locale); const model = h.render();
    assert.equal(model.title, catalog.production['worker.summary.expected.result_title'][locale]);
    assert.equal(model.facts[1].value, catalog.production['order.print_side.nonstandard'][locale]);
    assert.equal(model.metrics[0].value, '26000');
  }
});

test('native order controls retain callbacks and busy state, with pause above completion on iOS', () => {
  const calls = [];
  const { WorkerOrderButton, WorkerOrderActionGroup } = load('components/WorkerOrderControls.ios.tsx', mocks);
  for (const busy of [false, true]) {
    const tree = WorkerOrderButton({ label: 'Tugatish', variant: 'filled', height: 58, disabled: busy, onPress: () => calls.push('complete') });
    const button = nodes(tree, item => item.type === 'Button')[0];
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'disabled').args[0], busy);
    const label = button.props.children;
    assert.equal(label.props.modifiers.some(modifier => modifier.name === 'frame' && modifier.args[0].maxWidth === Infinity), true);
    if (!busy) button.props.onPress();
  }
  assert.deepEqual(calls, ['complete']);
  const group = WorkerOrderActionGroup({ children: [React.createElement('Button', { key: 'pause' }, 'Rulonni yechish'),
    React.createElement('Button', { key: 'complete' }, 'Tugatish')] });
  assert.equal(text(group), 'Rulonni yechish Tugatish');
});

for (const platform of ['ios', 'android']) test(`${platform}: blocked paused orders show native information without creating an action`, () => {
  const { WorkerOrderBlockingNotice } = load(`components/WorkerOrderControls.${platform}.tsx`, { ...mocks,
    '@expo/ui/jetpack-compose': androidNative, '@expo/ui/jetpack-compose/modifiers': modifiers,
    './WorkerSheetButton': { WorkerSheetButton: 'Button' } });
  const message = '8 ta rangli bosma apparat — shashoqcha';
  const tree = WorkerOrderBlockingNotice({ message });
  assert.equal(text(tree), platform === 'ios' ? `“${noticeHyphenation.hyphenateWorkerNotice(message, 'uz')}”` : message);
  assert.equal(nodes(tree, node => node.type === 'Button').length, 0);
  const label = nodes(tree, node => node.type === 'Text')[0];
  if (platform === 'android') assert.equal(label.props.color, 'label');
  else {
    assert.equal(label.props.style.color, 'label');
    assert.equal(label.props.style.fontStyle, 'italic');
    assert.equal(label.props.style.textAlign, 'justify');
    assert.equal(label.props.style.width, '100%');
    assert.equal(label.props.style.backgroundColor, undefined);
    assert.equal(label.props.accessibilityLabel, message);
  }
});

test('iOS notice uses discretionary word breaks only in Uzbek while VoiceOver reads the original', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    const { WorkerOrderBlockingNotice } = load('components/WorkerOrderControls.ios.tsx', {
      ...mocks, './useWorkerOrderText': { useWorkerOrderText: () => ({ locale }) },
    });
    const message = 'Ushbu buyurtmani boshlash uchun kuting.';
    const label = WorkerOrderBlockingNotice({ message });
    assert.equal(label.props.accessibilityLabel, message);
    assert.equal(text(label).includes(noticeHyphenation.SOFT_HYPHEN), locale === 'uz');
    assert.equal(text(label).replaceAll(noticeHyphenation.SOFT_HYPHEN, ''), `“${message}”`);
  }
});

test('order actions use system glass controls on iOS 26 and native bordered controls on older iOS', () => {
  for (const [version, styles] of [['26.1.1', ['glassProminent', 'glass']], ['18.7', ['borderedProminent', 'bordered']]]) {
    const { WorkerOrderButton } = load('components/WorkerOrderControls.ios.tsx', {
      ...mocks, 'react-native': { ...mocks['react-native'], Platform: { Version: version } },
    });
    for (const [variant, orderAction, expectedColor] of [
      ['filled', undefined, undefined], ['outlined', undefined, undefined],
      ['filled', 'complete', 'systemRed'], ['outlined', 'pause', 'systemOrange'],
      ['filled', 'resume', 'systemBlue'], ['filled', 'start', 'systemGreen'],
      ['outlined', 'report', 'systemBlue'],
    ]) {
      const tree = WorkerOrderButton({ label: 'Localized action', orderAction, variant, height: 58, onPress() {} });
      const button = nodes(tree, item => item.type === 'Button')[0];
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonStyle').args[0], styles[variant === 'filled' || orderAction ? 0 : 1]);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'tint')?.args[0], expectedColor);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonBorderShape').args[0], 'capsule');
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'controlSize').args[0], 'large');
      assert.deepEqual(button.props.modifiers.find(modifier => modifier.name === 'frame').args[0], { maxWidth: Infinity, minHeight: 48 });
      assert.equal(nodes(button.props.children, item => item.props.modifiers?.some(modifier => modifier.name === 'frame'
        && ['height', 'minHeight', 'maxHeight'].some(key => key in modifier.args[0]))).length, 0, 'native control height must not be added again to the label');
    }
    const neutral = WorkerOrderButton({ label: 'Qaytarilgan bo‘yoq', variant: 'outlined', neutralLabel: true, onPress() {} });
    const button = nodes(neutral, item => item.type === 'Button')[0];
    const label = nodes(neutral, item => item.type === 'Text')[0];
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonStyle').args[0], styles[1]);
    assert.equal(label.props.modifiers.find(modifier => modifier.name === 'foregroundStyle').args[0], 'label');
  }
});

test('iOS full-height sheets use the native large detent in compact and tall viewports', () => {
  for (const height of [568, 844]) {
    const { WorkerOrderSheet } = load('components/WorkerOrderSheet.ios.tsx', {
      ...mocks, react: { useCallback: fn => fn, useState: value => [value, () => {}], useRef: value => ({ current: value }) },
      'react-native': { PlatformColor: name => name, View: 'View', ScrollView: 'ScrollView', VirtualizedList: {}, useWindowDimensions: () => ({ width: 390, height }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
      './useBaseTheme': { useBaseTheme: () => ({ mode: 'dark', colors: {}, direction: 'leftToRight' }) },
      './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'CloseProvider' } },
    });
    const tree = WorkerOrderSheet({ children: 'scrollable history', onClose() {}, dismissible: true, heightFraction: 1 });
    const detents = nodes(tree, node => node.type === 'Group')[0].props.modifiers.find(modifier => modifier.name === 'presentationDetents');
    assert.deepEqual(detents.args[0], ['large']); assert.equal(detents.args[1].selection, 'large');
    assert.equal(nodes(tree, node => node.type === 'RNHostView')[0].props.matchContents, false);
    assert.equal(nodes(tree, node => node.type === 'BottomSheet')[0].props.fitToContents, false);
  }
});

test('iOS action sheet fits measured content with bounded scrolling and no half/full-screen snap points', () => {
  const { WorkerOrderSheet } = load('components/WorkerOrderSheet.ios.tsx', {
    ...mocks, react: { useCallback: fn => fn, useState: value => [value, () => {}], useRef: value => ({ current: value }) },
    'react-native': { PlatformColor: name => name, View: 'View', ScrollView: 'ScrollView', VirtualizedList: {},
      useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    './useBaseTheme': { useBaseTheme: () => ({ mode: 'dark', colors: {}, direction: 'leftToRight' }) },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'CloseProvider' } },
  });
  const tree = WorkerOrderSheet({ children: 'all actions', onClose() {}, dismissible: true, compact: true, fitContent: true, heightFraction: 0.86 });
  assert.equal(nodes(tree, item => item.type === 'BottomSheet')[0].props.fitToContents, true);
  assert.deepEqual(nodes(tree, item => item.type === 'RNHostView')[0].props.matchContents, { vertical: true });
  const group = nodes(tree, item => item.type === 'Group')[0];
  assert.equal(group.props.modifiers.some(modifier => modifier.name === 'presentationDetents'), false);
  const scroll = nodes(tree, item => item.type === 'ScrollView')[0];
  assert.deepEqual(scroll.props.style, { flexGrow: 0, maxHeight: Math.round((844 - 59 - 34) * 0.86) });
  assert.equal(scroll.props.style.height, undefined);
});

test('action sheet follows asynchronous menu height and keeps oversized content scrollable', () => {
  const runner = require('./support/workerPaddonHarness.cjs').hooks();
  const { WorkerOrderSheet } = load('components/WorkerOrderSheet.ios.tsx', {
    ...mocks, react: runner.react,
    'react-native': { PlatformColor: name => name, View: 'View', ScrollView: 'ScrollView', VirtualizedList: {},
      useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    './useBaseTheme': { useBaseTheme: () => ({ mode: 'dark', colors: {}, direction: 'leftToRight' }) },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'CloseProvider' } },
  });
  const render = () => { runner.begin(); return WorkerOrderSheet({ children: 'menu', onClose() {}, dismissible: true, compact: true, fitContent: true, measureContent: true, heightFraction: 0.86 }); };
  const heightOf = tree => {
    const mod = nodes(tree, node => node.type === 'Group')[0].props.modifiers.find(item => item.name === 'presentationDetents');
    assert.deepEqual(mod.args[1].selection, mod.args[0][0]);
    return mod.args[0][0].height;
  };
  let tree = render();
  assert.equal(nodes(tree, node => node.type === 'BottomSheet')[0].props.fitToContents, false);
  assert.equal(nodes(tree, node => node.type === 'RNHostView')[0].props.matchContents, false);
  assert.equal(heightOf(tree), 280);
  let scroll = nodes(tree, node => node.type === 'ScrollView')[0];
  assert.equal(scroll.props.contentInsetAdjustmentBehavior, 'never');
  assert.equal(scroll.props.automaticallyAdjustContentInsets, false);
  assert.deepEqual(scroll.props.contentContainerStyle, { paddingBottom: 8 });
  scroll.props.onContentSizeChange(350, 220.4);
  tree = render(); assert.equal(heightOf(tree), 237);
  scroll = nodes(tree, node => node.type === 'ScrollView')[0];
  scroll.props.onContentSizeChange(350, 520);
  tree = render(); assert.equal(heightOf(tree), 536);
  scroll = nodes(tree, node => node.type === 'ScrollView')[0];
  scroll.props.onContentSizeChange(350, 1200);
  tree = render(); assert.equal(heightOf(tree), Math.round((844 - 59 - 34) * 0.86));
  assert.deepEqual(nodes(tree, node => node.type === 'ScrollView')[0].props.style, { flex: 1 });
});

test('action sheet close uses glass with an adaptive neutral icon and still closes', () => {
  for (const version of ['26.1.1', '18.7']) {
    let calls = 0;
    const { WorkerIconButton } = load('components/WorkerIconButton.ios.tsx', {
      ...mocks, 'react-native': { ...mocks['react-native'], Platform: { Version: version } },
      './useWorkerColors': { useWorkerColors: () => ({ icon: 'systemBlue' }) },
    });
    const tree = WorkerIconButton({ icon: 'close', label: 'Yopish', neutralIcon: true, onPress: () => { calls++; } });
    const button = nodes(tree, node => node.type === 'Button')[0];
    const icon = nodes(tree, node => node.type === 'Image')[0];
    assert.equal(button.props.modifiers.find(mod => mod.name === 'buttonStyle').args[0], version.startsWith('26') ? 'glass' : 'bordered');
    assert.equal(button.props.modifiers.find(mod => mod.name === 'buttonBorderShape').args[0], 'circle');
    assert.equal(button.props.modifiers.find(mod => mod.name === 'accessibilityLabel').args[0], 'Yopish');
    assert.equal(icon.props.systemName, 'xmark');
    assert.equal(icon.props.color, 'label');
    assert.deepEqual(button.props.modifiers.find(mod => mod.name === 'frame').args[0], { minWidth: 44, minHeight: 44 });
    button.props.onPress(); assert.equal(calls, 1);
  }
});

test('report and paint dialogs use transparent secondary actions and filled system-blue confirmation', () => {
  for (const version of ['26.1.1', '18.7']) {
    const calls = [];
    const { WorkerFormDialog } = load('components/WorkerFormDialog.ios.tsx', {
      ...mocks, 'react-native': { ...mocks['react-native'], Platform: { Version: version }, KeyboardAvoidingView: 'Keyboard', Modal: 'Modal',
        Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
      './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerOrderText': { useWorkerOrderText: () => ({ t: value => value }) },
    });
    const props = { visible: true, title: 'Pauza miqdori', children: null, confirmLabel: 'Tasdiqlash',
      onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') };
    const buttons = nodes(WorkerFormDialog({ ...props, actionColors: 'blue' }), node => node.type === 'Button');
    assert.deepEqual(buttons.map(button => button.props.modifiers.find(mod => mod.name === 'tint').args[0]), ['systemBlue', 'systemBlue']);
    assert.deepEqual(buttons.map(button => button.props.modifiers.find(mod => mod.name === 'buttonStyle').args[0]),
      version.startsWith('26') ? ['glass', 'glassProminent'] : ['bordered', 'borderedProminent']);
    for (const button of buttons) {
      assert.equal(button.props.modifiers.find(mod => mod.name === 'frame').args[0].minHeight, 48);
      assert.equal(button.props.children.props.modifiers.find(mod => mod.name === 'frame').args[0].maxWidth, Infinity);
      button.props.onPress();
    }
    assert.deepEqual(calls, ['cancel', 'confirm']);
    const neutral = nodes(WorkerFormDialog({ ...props, actionColors: 'blue', neutralCancelLabel: true }), node => node.type === 'Button');
    assert.equal(neutral[0].props.modifiers.some(mod => mod.name === 'tint'), false);
    assert.equal(neutral[0].props.children.props.modifiers.find(mod => mod.name === 'foregroundStyle').args[0], 'label');
    assert.equal(neutral[1].props.modifiers.find(mod => mod.name === 'tint').args[0], 'systemBlue');
    const defaults = nodes(WorkerFormDialog(props), node => node.type === 'Button');
    assert.equal(defaults.every(button => !button.props.modifiers.some(mod => mod.name === 'tint')), true);
    const busy = nodes(WorkerFormDialog({ ...props, actionColors: 'blue', cancelDisabled: true, confirmDisabled: true }), node => node.type === 'Button');
    assert.equal(busy.every(button => button.props.modifiers.find(mod => mod.name === 'disabled').args[0]), true);
  }
});

test('native paint fields expose a wide visible input and preserve formatting, clearing and scope locks', () => {
  const refs = [], changes = [], writes = [], selections = [];
  let locked = false;
  const native = new Proxy({}, { get: (_target, key) => String(key) });
  const logic = load('boyoqchi/boyoqchiLogic.ts', { './returnedPaintModel': {}, './returnedPaintRules': {} });
  const { WorkerReturnedPaintField } = load('components/WorkerReturnedPaintField.ios.tsx', {
    '@expo/ui/swift-ui': { ...native, Text: 'Text', TextField: 'TextField', VStack: 'VStack', useNativeState: initial => ({
      get: () => initial, set: value => writes.push(value),
    }) },
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_target, name) => name === 'shapes' ? { rectangle: () => 'rectangle' } : (...args) => ({ name, args }) }),
    react: { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; } },
    'react-native': { PlatformColor: value => value }, './BaseHost': { BaseHost: 'Host' },
    '../boyoqchi/boyoqchiLogic': logic, '../boyoqchi/useBoyoqchiText': { useBoyoqchiText: () => value => value },
  });
  const tree = WorkerReturnedPaintField({ label: '1w Oq', initial: '12', decimal: true, isLocked: () => locked, onChange: value => changes.push(value) });
  assert.equal(tree.props.style.width, '100%');
  assert.deepEqual(tree.props.matchContents, { vertical: true });
  const field = nodes(tree, node => node.type === 'TextField')[0], modifiers = field.props.modifiers;
  assert.equal(modifiers.find(mod => mod.name === 'frame').args[0].minHeight, 48);
  assert.equal(modifiers.find(mod => mod.name === 'frame').args[0].maxWidth, Infinity);
  assert.equal(modifiers.find(mod => mod.name === 'background').args[0], 'tertiarySystemFill');
  assert.equal(modifiers.find(mod => mod.name === 'keyboardType').args[0], 'decimal-pad');
  refs[0].current = { setSelection: (start, end) => { selections.push([start, end]); return Promise.resolve(); } };
  field.props.onFocusChange(true); assert.deepEqual(selections, [[2, 2]]);
  field.props.onTextChange('12,5'); field.props.onTextChange('');
  assert.deepEqual(changes, ['12,5', '']); assert.deepEqual(writes, []);
  field.props.onTextChange('-1'); field.props.onTextChange('invalid');
  locked = true; field.props.onTextChange('5');
  assert.deepEqual(changes, ['12,5', '']); assert.deepEqual(writes, ['', '', '']);
});

test('iOS quantity form field uses the wide native editor without changing raw report values', () => {
  const changes = [];
  const { WorkerFormField } = load('components/WorkerFormField.ios.tsx', {
    './BaseHost': { BaseHost: 'Host' }, './DailyWorkCorrectionFields.ios': { WorkerNativeField: 'NativeField' },
  });
  const tree = WorkerFormField({ label: 'Metraj, metr', initialValue: '6002', keyboardType: 'decimal-pad', onChangeText: value => changes.push(value) });
  const field = nodes(tree, node => node.type === 'NativeField')[0];
  assert.equal(field.props.value, '6002'); assert.equal(field.props.decimal, true); assert.equal(field.props.maskDecimal, false);
  field.props.change('12,5'); field.props.change('');
  assert.deepEqual(changes, ['12,5', '']);
});

test('native order identity keeps image preview and close actions with the cached thumbnail', () => {
  const h = harness(), calls = [];
  const { WorkerOrderIdentity } = load('components/WorkerOrderIdentity.ios.tsx', { ...mocks,
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: key => key }) },
    './WorkerOrderThumbnail': { WorkerOrderThumbnail: 'Thumbnail' }, './useWorkerColors': { useWorkerColors: () => ({ surface: 'surface', icon: 'icon' }) } });
  const tree = WorkerOrderIdentity({ ...h.props, onOpenImage: () => calls.push('image'), onClose: () => calls.push('close') });
  byId(tree, 'worker-order-image').props.onPress(); byId(tree, 'worker-order-close').props.onPress();
  assert.equal(byId(tree, 'worker-order-close').props.role, 'close');
  assert.deepEqual(calls, ['image', 'close']);
  const thumbnail = nodes(tree, item => item.type === 'Thumbnail')[0];
  assert.equal(thumbnail.props.session, h.props.session); assert.equal(thumbnail.props.imageId, 'image');
  assert.equal(thumbnail.props.size, 48);
  assert.deepEqual(byId(tree, 'worker-order-close').props.modifiers.find(modifier => modifier.name === 'frame').args[0], { width: 44, height: 44 });
  assert.equal(text(tree).includes('0337'), true); assert.equal(text(tree).includes('Tea'), true);
  const withHistory = WorkerOrderIdentity({ ...h.props, onScannedWips: () => calls.push('scanned') });
  nodes(withHistory, item => item.props.systemImage === 'qrcode.viewfinder')[0].props.onPress();
  assert.equal(calls.at(-1), 'scanned');
});

test('disclosure rows use an intrinsic 44pt grid with aligned tabular counters and stable chevron space', () => {
  const { WorkerExpansion } = load('components/WorkerExpansion.ios.tsx', mocks);
  let presses = 0;
  for (const actionable of [false, true]) {
    const tree = WorkerExpansion({ title: 'Biriktirilgan homashyolar', count: '0/1', expanded: false, onPress: actionable ? () => presses++ : undefined });
    const row = nodes(tree, item => item.type === 'HStack')[0], counter = nodes(tree, item => item.type === 'Text' && text(item) === '0/1')[0];
    assert.equal(row.props.spacing, 8);
    assert.deepEqual(row.props.modifiers.find(modifier => modifier.name === 'frame').args[0], { maxWidth: Infinity, minHeight: 44, alignment: 'leading' });
    assert.ok(counter.props.modifiers.some(modifier => modifier.name === 'monospacedDigit'));
    assert.deepEqual(counter.props.modifiers.find(modifier => modifier.name === 'frame').args[0], { minWidth: 44, alignment: 'trailing' });
    const trailing = nodes(tree, item => item.type === (actionable ? 'Image' : 'Spacer'))[0];
    assert.deepEqual(trailing.props.modifiers.find(modifier => modifier.name === 'frame').args[0], { width: 16 });
    assert.equal(nodes(tree, item => item.type === 'Button').length, actionable ? 1 : 0);
    if (actionable) nodes(tree, item => item.type === 'Button')[0].props.onPress();
  }
  assert.equal(presses, 1);
});

test('preflight outcomes render immediately on the same control grid without width measurement or extra label height', () => {
  const controls = load('components/WorkerOrderControls.ios.tsx', mocks);
  const { WorkerPreflightButton } = load('components/WorkerPreflightButton.ios.tsx', { './WorkerOrderControls': controls });
  const calls = [];
  for (const [label, outlined] of [['Rang chiqarish', false], ['Rang chiqdi', false], ['Chiqmadi', true]]) {
    const element = WorkerPreflightButton({ label, outlined, disabled: true, onPress: () => calls.push(label) }), tree = element.type(element.props);
    assert.equal(tree.type, 'Host'); assert.equal(tree.props.matchContents.vertical, true);
    const button = nodes(tree, item => item.type === 'Button')[0];
    assert.ok(button); assert.equal(nodes(button, item => item.type === 'Text')[0].props.children, label); assert.equal(nodes(tree, item => item.props.onLayout).length, 0);
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'disabled').args[0], true);
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonStyle').args[0], outlined ? 'glass' : 'glassProminent');
    assert.equal(button.props.modifiers.find(modifier => modifier.name === 'frame').args[0].minHeight, 48);
    assert.equal(nodes(button.props.children, item => item.props.modifiers?.some(modifier => modifier.name === 'frame' && 'height' in modifier.args[0])).length, 0);
    button.props.onPress();
  }
  assert.deepEqual(calls, ['Rang chiqarish', 'Rang chiqdi', 'Chiqmadi']);
});
