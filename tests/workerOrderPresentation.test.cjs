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

test('overview metadata uses the active locale without changing the order values', () => {
  const h = harness();
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    h.setLocale(locale); const model = h.render();
    assert.equal(model.title, catalog.production['worker.summary.expected.result_title'][locale]);
    assert.equal(model.facts[1].value, catalog.production['order.print_side.nonstandard'][locale]);
    assert.equal(model.metrics[0].value, '26000');
  }
});

test('native order controls retain callbacks and busy state, with completion before pause on iOS', () => {
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
  assert.equal(text(group), 'Tugatish Rulonni yechish');
});

for (const platform of ['ios', 'android']) test(`${platform}: blocked paused orders show native information without creating an action`, () => {
  const { WorkerOrderBlockingNotice } = load(`components/WorkerOrderControls.${platform}.tsx`, { ...mocks,
    '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
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
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonStyle').args[0], styles[variant === 'filled' ? 0 : 1]);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'tint')?.args[0], expectedColor);
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'buttonBorderShape').args[0], 'capsule');
      assert.equal(button.props.modifiers.find(modifier => modifier.name === 'controlSize').args[0], 'large');
      assert.deepEqual(button.props.modifiers.find(modifier => modifier.name === 'frame').args[0], { maxWidth: Infinity, minHeight: 48 });
      assert.equal(nodes(button.props.children, item => item.props.modifiers?.some(modifier => modifier.name === 'frame'
        && ['height', 'minHeight', 'maxHeight'].some(key => key in modifier.args[0]))).length, 0, 'native control height must not be added again to the label');
    }
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
