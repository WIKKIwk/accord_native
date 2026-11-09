const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadCustomerStates } = require('./support/customerNativeStates.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const resolvedStatusTargets = new WeakMap();
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (typeof node.type === 'function' && node.type.name === 'CustomerStatusPressable') {
    if (!resolvedStatusTargets.has(node)) resolvedStatusTargets.set(node, node.type(node.props));
    return nodes(resolvedStatusTargets.get(node), predicate);
  }
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const logic = load('customerLogic.ts'), presentation = load('customerPresentation.ts', { './customerLogic': logic });
const record = { id: 'dn', item_name: 'Product', item_code: 'P1', sent_qty: 3, uom: 'kg', note: 'note', created_label: 'date', status: 'pending' };
function fixture(platform, state, locale = 'uz', reducedMotion = false) {
  const animations = [], cleanups = []; let motionListener, removed = 0;
  function AnimatedValue(value) { this.initial = value; this.setValue = value => { this.current = value; }; }
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Host: 'Host', Button: 'Button' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: v => ['listStyle', v], refreshable: f => ['refreshable', f], listRowBackground: v => ['background', v],
      foregroundStyle: v => ['foregroundStyle', v], buttonStyle: v => ['buttonStyle', v], contentShape: v => ['contentShape', v],
      fixedSize: v => ['fixedSize', v], font: v => ['font', v], frame: v => ['frame', v], lineLimit: () => ['lineLimit'], padding: v => ['padding', v],
      shapes: { rectangle: () => ['rectangle'] } },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', surfaceContainer: 'highlight', onSurface: 'fg', onSurfaceVariant: 'muted', outlineVariant: 'outline' }) },
    react: { useEffect: fn => cleanups.push(fn()), useRef: value => ({ current: value }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
    'react-native': { AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(reducedMotion),
      addEventListener: (_, listener) => { motionListener = listener; return { remove() { removed++; } }; } },
      ActivityIndicator: 'ActivityIndicator', Animated: { Value: AnimatedValue, View: 'AnimatedView',
      timing: (value, config) => ({ start: () => animations.push({ value, config }) }) }, Easing: { bezier: (...values) => values },
      FlatList: 'FlatList', Pressable: 'Pressable', RefreshControl: 'RefreshControl', Text: 'Text', View: 'View', PlatformColor: v => v },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, './CustomerContext': { useCustomerText: () => ({ locale, text: key => key }) },
    './CustomerStates': loadCustomerStates(platform), './CustomerStatusPanel': { CustomerStatusPanel: 'CustomerStatusPanel' }, './customerPresentation': presentation,
    './useCustomerScreens': { useCustomerHome: () => state, useCustomerStatus: () => state } };
  return { ...load(`CustomerHome.${platform}.tsx`, mocks), animations, setReducedMotion: value => motionListener(value),
    cleanup: () => cleanups.forEach(fn => fn?.()), removals: () => removed };
}
const state = { loading: false, loaded: true, error: null, summary: { pendingCount: 2, confirmedCount: 1, rejectedCount: 0 }, records: [record], refresh: async () => {} };
test('iOS home supplies the real summary and status callback to its native panel and opens shipments', () => {
  const calls = [], screen = fixture('ios', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  const panel = nodes(screen, item => item.type === 'CustomerStatusPanel')[0]; assert.equal(panel.props.summary, state.summary);
  for (const kind of ['pending', 'confirmed', 'rejected']) panel.props.onOpenStatus(kind);
  const shipment = nodes(screen, item => item.type === 'Button')[0]; shipment.props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
  assert.ok(nodes(shipment, item => item.type === 'Text' && item.props.children === 'P1').length);
});
test('Android home supplies the real summary/status callback and opens shipment details', () => {
  const calls = [], screen = fixture('android', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  assert.equal(screen.type, 'FlatList');
  const panel = nodes(screen.props.ListHeaderComponent, item => item.type === 'CustomerStatusPanel')[0]; assert.equal(panel.props.summary, state.summary);
  for (const kind of ['pending', 'confirmed', 'rejected']) panel.props.onOpenStatus(kind);
  const shipment = screen.props.renderItem({ item: record, index: 0 }); nodes(shipment, item => item.type === 'Pressable')[0].props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
});

test('Android recent shipments heading uses V2 titleLarge emphasis', () => {
  const screen = fixture('android', state).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
  const title = nodes(screen.props.ListHeaderComponent, item => item.type === 'Text' && item.props.children === 'recentShipmentsTitle')[0];
  assert.equal(title.props.style.fontSize, 20); assert.equal(title.props.style.fontWeight, '700');
});

test('Android Home groups the heading, empty state and shipment rows like the source panels', () => {
  const empty = fixture('android', { ...state, records: [] }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
  const emptyHeader = nodes(empty.props.ListHeaderComponent, item => item.props.testID === 'customer-shipments-heading')[0];
  assert.equal(emptyHeader.props.style.backgroundColor, 'bg'); assert.equal(emptyHeader.props.style.paddingTop, 16);
  assert.equal(emptyHeader.props.style.marginTop, 18);
  assert.equal(emptyHeader.props.style.borderTopLeftRadius, 28); assert.equal(emptyHeader.props.style.borderTopRightRadius, 28);
  const title = nodes(emptyHeader, item => item.type === 'Text')[0];
  assert.equal(title.props.style.marginHorizontal, 16); assert.equal(title.props.style.marginBottom, 14);
  const emptyPanel = empty.props.ListEmptyComponent; assert.equal(emptyPanel.props.style.backgroundColor, 'bg');
  assert.equal(emptyPanel.props.style.borderBottomLeftRadius, 28); assert.equal(emptyPanel.props.style.borderBottomRightRadius, 28);
  const emptyLabel = nodes(emptyPanel, item => item.type === 'Text')[0]; assert.equal(emptyLabel.props.children, 'noShipments');
  assert.equal(emptyLabel.props.style.marginHorizontal, 20); assert.equal(emptyLabel.props.style.marginTop, 4); assert.equal(emptyPanel.props.style.paddingBottom, 18);
  assert.equal(nodes(emptyPanel, item => item.type === 'Pressable').length, 0);

  const records = [0, 1, 2].map(index => ({ ...record, id: `dn-${index}` })), calls = [];
  const screen = fixture('android', { ...state, records }, 'ur-PK').CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail: id => calls.push(id) });
  records.forEach((item, index) => {
    const row = screen.props.renderItem({ item, index });
    const outer = nodes(row, n => n.props.testID === 'customer-shipment-card')[0];
    const inner = nodes(row, n => n.props.testID === 'customer-shipment-fill')[0];
    const target = nodes(row, n => n.type === 'Pressable')[0];
    assert.equal(outer.props.style.backgroundColor, 'bg'); assert.equal(outer.props.style.direction, 'rtl');
    assert.equal(outer.props.style.borderBottomLeftRadius, index === 2 ? 28 : 0);
    assert.equal(outer.props.style.borderBottomRightRadius, index === 2 ? 28 : 0);
    assert.equal(inner.props.style.backgroundColor, 'highlight');
    assert.equal(inner.props.style.borderTopLeftRadius, index === 0 ? 24 : 0);
    assert.equal(inner.props.style.borderTopRightRadius, index === 0 ? 24 : 0);
    assert.equal(inner.props.style.borderBottomLeftRadius, index === 2 ? 24 : 0);
    assert.equal(inner.props.style.borderBottomRightRadius, index === 2 ? 24 : 0);
    assert.equal(target.props.accessibilityRole, 'button'); target.props.onPress();
    const dividers = nodes(row, n => n.props.testID === 'customer-shipment-divider');
    assert.equal(dividers.length, index === 2 ? 0 : 1);
    if (dividers.length) assert.deepEqual(dividers[0].props.style, { height: 1, marginHorizontal: 16, backgroundColor: 'outline', opacity: 0.55 });
  });
  assert.deepEqual(calls, records.map(item => item.id));
  const single = fixture('android', state).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} }).props.renderItem({ item: record, index: 0 });
  const fill = nodes(single, n => n.props.testID === 'customer-shipment-fill')[0].props.style;
  assert.equal(fill.borderTopLeftRadius, 24); assert.equal(fill.borderBottomLeftRadius, 24);
});
test('both platforms show loading before the initial bootstrap and retry after an initial failure', () => {
  for (const platform of ['ios', 'android']) {
    const views = fixture(platform, { ...state, loaded: false, loading: false, error: null });
    const loading = views.CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    assert.equal(loading.type.name, 'CustomerLoadingState');
    const failed = fixture(platform, { ...state, loaded: false, loading: false, error: Error('x') })
      .CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.equal(failed.type.name, 'CustomerRetryState'); assert.equal(failed.props.retry, state.refresh);
  }
});

test('Home and status treat every non-null initial failure as a retry, including falsy values', () => {
  for (const platform of ['ios', 'android']) for (const error of [false, 0, '']) {
    const views = fixture(platform, { ...state, loaded: false, loading: false, error });
    for (const screen of [views.CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} }),
      views.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} })]) {
      assert.equal(screen.type.name, 'CustomerRetryState'); assert.equal(screen.props.retry, state.refresh);
    }
  }
});
test('status rows open the selected delivery and empty states use the V2 label', () => {
  const calls = [], ios = fixture('ios', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  nodes(ios, item => item.type === 'Button')[0].props.onPress();
  const android = fixture('android', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  const row = android.props.renderItem({ item: record, index: 0 });
  nodes(row, item => item.type === 'Pressable')[0].props.onPress(); assert.deepEqual(calls, ['dn', 'dn']);
  for (const platform of ['ios', 'android']) {
    const empty = fixture(platform, { ...state, records: [] }).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.ok(nodes(empty.type(empty.props), item => item.type === 'Text').some(item => item.props.children === 'noRecordsYet'));
  }
});

test('Android status rows form a rounded panel with full-width dividers and real actions', async () => {
  const records = [0, 1, 2].map(index => ({ ...record, id: `dn-${index}` })), calls = [];
  let refreshes = 0;
  const status = { ...state, records, refresh: async () => { refreshes++; } };
  const screen = fixture('android', status, 'ur-PK').CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  assert.equal(screen.type, 'FlatList'); assert.equal(screen.props.contentContainerStyle.paddingTop, undefined);
  screen.props.refreshControl.props.onRefresh(); await Promise.resolve(); assert.equal(refreshes, 1);
  records.forEach((item, index) => {
    const row = screen.props.renderItem({ item, index });
    const card = nodes(row, n => n.props.testID === 'customer-status-card')[0];
    const target = nodes(row, n => n.type === 'Pressable')[0];
    assert.equal(card.props.style.backgroundColor, 'bg'); assert.equal(card.props.style.direction, 'rtl');
    assert.equal(card.props.style.marginStart, 14); assert.equal(card.props.style.marginEnd, 16);
    assert.equal(card.props.style.borderTopLeftRadius, index === 0 ? 28 : 0);
    assert.equal(card.props.style.borderTopRightRadius, index === 0 ? 28 : 0);
    assert.equal(card.props.style.borderBottomLeftRadius, index === 2 ? 28 : 0);
    assert.equal(card.props.style.borderBottomRightRadius, index === 2 ? 28 : 0);
    assert.equal(target.props.accessibilityRole, 'button'); assert.equal(target.props.style.paddingHorizontal, 18);
    assert.equal(target.props.style.paddingVertical, 16); assert.equal(target.props.style.borderRadius, index === 1 ? 0 : 28);
    assert.deepEqual(target.props.android_ripple, { color: '#33212121' });
    target.props.onPress();
    const dividers = nodes(row, n => n.props.testID === 'customer-status-divider'); assert.equal(dividers.length, index === 2 ? 0 : 1);
    if (dividers.length) assert.deepEqual(dividers[0].props.style, { height: 1, backgroundColor: 'outline' });
    assert.equal(nodes(target.props.children, n => n.type === 'Pressable' || n.type === 'Button').length, 0);
  });
  assert.deepEqual(calls, records.map(item => item.id));
  const single = fixture('android', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} }).props.renderItem({ item: record, index: 0 });
  const card = nodes(single, n => n.props.testID === 'customer-status-card')[0].props.style;
  assert.equal(card.borderTopLeftRadius, 28); assert.equal(card.borderBottomLeftRadius, 28);
});

// Source-derived: customer_home_screen_widgets_part_02.dart _CustomerPreviewRow.
test('home previews keep V2 one-line name and code limits without changing content', () => {
  const longRecord = { ...record, item_name: 'Mahsulot نام '.repeat(40), item_code: 'PRODUCT-'.repeat(40) };
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, { ...state, records: [longRecord] }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'Button')[0]
      : screen.props.renderItem({ item: longRecord, index: 0 });
    const texts = nodes(row, item => item.type === 'Text');
    if (platform === 'ios') texts.push(...nodes(row.props.supportingText, item => item.type === 'Text'));
    for (const value of [longRecord.item_name, longRecord.item_code]) {
      const text = texts.find(item => item.props.children === value);
      assert.ok(text, `${platform} retains the complete input for native truncation`);
      assert.equal(text.props.numberOfLines, 1, `${platform} preview limit`);
      if (platform === 'android') assert.equal(text.props.ellipsizeMode, 'tail');
      else if (value === longRecord.item_code) assert.ok(text.props.modifiers.some(m => m[0] === 'foregroundStyle' && m[1].type === 'color' && m[1].color === 'secondaryLabel'));
    }
  }
});

// Source-derived: customer_status_detail_screen.dart _CustomerStatusRecordRow.
test('status detail keeps its name and note unrestricted instead of inheriting preview limits', () => {
  const longRecord = { ...record, item_name: 'Mahsulot '.repeat(40), note: 'First line\n'.repeat(10) };
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, { ...state, records: [longRecord] }).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'Button')[0]
      : screen.props.renderItem({ item: longRecord, index: 0 });
    const texts = nodes(row, item => item.type === 'Text');
    if (platform === 'ios') texts.push(...nodes(row.props.supportingText, item => item.type === 'Text'));
    for (const value of [longRecord.item_name, longRecord.note]) {
      const text = texts.find(item => item.props.children === value);
      assert.ok(text, `${platform} keeps the full status content`);
      assert.equal(text.props.numberOfLines, undefined);
    }
  }
});

// Source-derived: Center(AppLoadingIndicator) and AppRetryState's topCenter/padding defaults.
test('initial native loading is centered and retry content starts at the padded top', () => {
  for (const platform of ['ios', 'android']) {
    const loading = fixture(platform, { ...state, loaded: false, loading: true }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    const loadingView = loading.type(loading.props);
    if (platform === 'ios') assert.equal(loadingView.props.alignment, 'center');
    else assert.equal(loadingView.props.style.alignItems, 'center');
    const failed = fixture(platform, { ...state, loaded: false, error: Error('offline') }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    const retryView = failed.type(failed.props);
    assert.equal(retryView.props.style.paddingHorizontal, 24);
    assert.equal(retryView.props.style.paddingVertical, 40);
    assert.equal(retryView.props.style.alignItems, 'center');
    assert.notEqual(retryView.props.style.justifyContent, 'center');
  }
});

test('loaded home and status content remains visible during refresh or a later failure', () => {
  for (const platform of ['ios', 'android']) {
    for (const loading of [false, true]) {
      const views = fixture(platform, { ...state, loading, error: Error('offline') });
      for (const screen of [views.CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} }),
        views.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} })]) {
        assert.equal(screen.type, platform === 'ios' ? 'Host' : 'FlatList');
        assert.equal(nodes(screen, item => typeof item.type === 'function').length, 0);
      }
    }
  }
});

// Source-derived: _CustomerStatusRecordRow's top-aligned name/date header, then full-width quantity/note.
test('status timestamps share only the header, leaving quantity and notes below at full row width', () => {
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, item => ['ListItem', 'Button'].includes(item.type))[0]
      : screen.props.renderItem({ item: record, index: 0 });
    const header = nodes(row, item => item.type === 'HStack' || item.props.style?.flexDirection === 'row')[0];
    assert.ok(header, `${platform} has a separate header`);
    assert.deepEqual(nodes(header, item => item.type === 'Text').map(item => item.props.children), [record.item_name, record.created_label]);
    if (platform === 'ios') { assert.equal(header.props.alignment, 'top'); assert.equal(header.props.spacing, 12); }
    else { assert.equal(header.props.style.alignItems, 'flex-start'); assert.equal(header.props.style.gap, 12); }
    const body = platform === 'ios' ? row.props.children : nodes(row, item => item.type === 'Pressable')[0].props.children;
    assert.ok(body.props.children.some(item => item?.type === 'Text' && item.props.children === '3 kg'));
    assert.ok(body.props.children.some(item => item?.type === 'Text' && item.props.children === 'note'));
  }
});

test('Android status rows preserve source quantity emphasis and body spacing', () => {
  const screen = fixture('android', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
  const row = screen.props.renderItem({ item: record, index: 0 });
  const quantity = nodes(row, item => item.type === 'Text' && item.props.children === '3 kg')[0];
  assert.equal(quantity.props.style.fontSize, 28); assert.equal(quantity.props.style.fontWeight, '700');
  assert.equal(quantity.props.style.letterSpacing, -0.6); assert.equal(quantity.props.style.marginTop, 10);
  const note = nodes(row, item => item.type === 'Text' && item.props.children === 'note')[0];
  assert.equal(note.props.style.fontSize, 12); assert.equal(note.props.style.marginTop, 8);
});

test('Android status press feedback follows the source scale, duration and easing without changing the detail target', async () => {
  const calls = [], records = [record, { ...record, id: 'dn-2' }], f = fixture('android', { ...state, records });
  const screen = f.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  await Promise.resolve();
  const first = screen.props.renderItem({ item: records[0], index: 0 }), second = screen.props.renderItem({ item: records[1], index: 1 });
  const firstAnimation = nodes(first, item => item.type === 'AnimatedView')[0], secondAnimation = nodes(second, item => item.type === 'AnimatedView')[0];
  assert.ok(firstAnimation && secondAnimation);
  const firstValue = firstAnimation.props.style.transform[0].scale, secondValue = secondAnimation.props.style.transform[0].scale;
  assert.equal(firstValue.initial, 1); assert.notEqual(firstValue, secondValue);
  const press = nodes(first, item => item.type === 'Pressable')[0];
  press.props.onPressIn(); press.props.onPressOut(); press.props.onPress();
  assert.deepEqual(calls, ['dn']);
  assert.deepEqual(f.animations.map(({ value, config }) => [value, config.toValue, config.duration, config.easing, config.useNativeDriver]), [
    [firstValue, 0.985, 160, [0.2, 0, 0, 1], true], [firstValue, 1, 160, [0.2, 0, 0, 1], true],
  ]);
});

test('Android status press feedback respects a changed reduced-motion setting', async () => {
  const calls = [], f = fixture('android', state), screen = f.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  await Promise.resolve(); f.setReducedMotion(true);
  const row = screen.props.renderItem({ item: record, index: 0 }), value = nodes(row, item => item.type === 'AnimatedView')[0].props.style.transform[0].scale;
  const press = nodes(row, item => item.type === 'Pressable')[0]; press.props.onPressIn(); press.props.onPressOut(); press.props.onPress();
  assert.equal(value.current, 1); assert.deepEqual(f.animations, []); assert.deepEqual(calls, ['dn']); f.cleanup(); assert.equal(f.removals(), 1);
});

test('Android status press feedback honors a newer motion event over the pending initial query', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const f = fixture('android', state, 'uz', pending), screen = f.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
  f.setReducedMotion(true); resolve(false); await Promise.resolve();
  const row = screen.props.renderItem({ item: record, index: 0 }), press = nodes(row, item => item.type === 'Pressable')[0];
  press.props.onPressIn(); press.props.onPressOut(); assert.deepEqual(f.animations, []); f.cleanup();
});

test('Android status resets a pressed scale when reduced motion is enabled mid-press', async () => {
  const f = fixture('android', state), screen = f.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
  await Promise.resolve(); const row = screen.props.renderItem({ item: record, index: 0 });
  const value = nodes(row, item => item.type === 'AnimatedView')[0].props.style.transform[0].scale, press = nodes(row, item => item.type === 'Pressable')[0];
  press.props.onPressIn(); assert.equal(f.animations.length, 1); f.setReducedMotion(true); press.props.onPressOut();
  assert.equal(f.animations.length, 1); assert.equal(value.current, 1); f.cleanup();
});

test('Android status skips motion if the accessibility query fails or resolves after cleanup', async () => {
  const failed = fixture('android', state, 'uz', Promise.reject(Error('unavailable')));
  const failedScreen = failed.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
  await new Promise(resolve => setImmediate(resolve));
  nodes(failedScreen.props.renderItem({ item: record, index: 0 }), item => item.type === 'Pressable')[0].props.onPressIn();
  assert.deepEqual(failed.animations, []); failed.cleanup();
  let resolve; const pending = new Promise(done => { resolve = done; });
  const unmounted = fixture('android', state, 'uz', pending), screen = unmounted.CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
  unmounted.cleanup(); unmounted.setReducedMotion(false); resolve(false); await Promise.resolve();
  nodes(screen.props.renderItem({ item: record, index: 0 }), item => item.type === 'Pressable')[0].props.onPressIn();
  assert.deepEqual(unmounted.animations, []); assert.equal(unmounted.removals(), 1);
});

test('iOS status rows retain one full-width native target, Dynamic Type and verbatim timestamp text', () => {
  const calls = [], raw = { ...record, item_name: 'Mahsulot نام '.repeat(30), note: 'Izoh\n'.repeat(15),
    created_label: '2026-11-08T23:59:59.123456+14:00' };
  const screen = fixture('ios', { ...state, records: [raw] }).CustomerStatusDetailScreen({ kind: 'confirmed', onOpenDetail: id => calls.push(id) });
  const buttons = nodes(screen, item => item.type === 'Button'); assert.equal(buttons.length, 1);
  const button = buttons[0]; button.props.onPress(); assert.deepEqual(calls, [raw.id]);
  assert.deepEqual(button.props.modifiers, [['buttonStyle', 'plain']]);
  assert.equal(button.props.trailing, undefined); assert.equal(button.props.supportingText, undefined);
  const body = button.props.children;
  assert.ok(body.props.modifiers.some(m => m[0] === 'frame' && m[1].maxWidth === Infinity));
  assert.ok(body.props.modifiers.some(m => m[0] === 'contentShape' && m[1][0] === 'rectangle'));
  const texts = nodes(body, item => item.type === 'Text');
  assert.deepEqual(texts.map(item => item.props.children), [raw.item_name, raw.created_label, '3 kg', raw.note]);
  assert.deepEqual(texts.map(item => item.props.modifiers.find(m => m[0] === 'font')[1]), [
    { textStyle: 'title3', weight: 'bold' }, { textStyle: 'caption' }, { textStyle: 'title', weight: 'bold' }, { textStyle: 'caption' },
  ]);
  for (const text of texts) {
    assert.equal(text.props.numberOfLines, undefined);
    assert.ok(text.props.modifiers.some(m => m[0] === 'lineLimit' && m.length === 1));
  }
  assert.ok(texts[1].props.modifiers.some(m => m[0] === 'fixedSize' && m[1].horizontal === true));
});

// Source-derived: _CustomerPreviewRow's expanded name/code column, 3 gap and intrinsic quantity after a 16 gap.
for (const platform of ['ios', 'android']) test(`${platform} shipment previews retain separate text/quantity layout and source emphasis`, () => {
  const screen = fixture(platform, state).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
  const row = platform === 'ios' ? nodes(screen, item => ['ListItem', 'Button'].includes(item.type)).at(-1)
    : screen.props.renderItem({ item: record, index: 0 });
  const target = platform === 'ios' ? row : nodes(row, item => item.type === 'Pressable')[0];
  const body = target.props.children;
  assert.equal(body.type, platform === 'ios' ? 'HStack' : 'View');
  const [details, quantity] = body.props.children;
  assert.deepEqual(nodes(details, item => item.type === 'Text').map(item => item.props.children), [record.item_name, record.item_code]);
  assert.equal(quantity.props.children, '3 kg');
  if (platform === 'ios') {
    assert.equal(body.props.spacing, 16); assert.equal(body.props.alignment, 'center');
    assert.equal(details.props.spacing, 3);
    assert.ok(quantity.props.modifiers.some(m => m[0] === 'font' && m[1].textStyle === 'subheadline' && m[1].weight === 'semibold'));
    assert.ok(quantity.props.modifiers.some(m => m[0] === 'fixedSize' && m[1].horizontal === true));
  } else {
    assert.equal(body.props.style.flexDirection, 'row'); assert.equal(body.props.style.gap, 16);
    assert.equal(body.props.style.alignItems, 'center'); assert.equal(details.props.style.gap, 3);
    assert.equal(quantity.props.style.fontSize, 14); assert.equal(quantity.props.style.fontWeight, '600');
    assert.equal(details.props.children[0].props.style.fontWeight, '500');
    assert.equal(target.props.style.paddingHorizontal, 18); assert.equal(target.props.style.paddingVertical, 16);
  }
});

test('shipment previews retain exact fields and one real target with native intrinsic quantity sizing', () => {
  const raw = { ...record, item_name: 'Mahsulot نام '.repeat(25), item_code: 'PRODUCT-'.repeat(25), sent_qty: 7.4,
    uom: 'kg / m²', note: 'not preview content', created_label: 'not a preview date' };
  for (const platform of ['ios', 'android']) {
    const calls = [], screen = fixture(platform, { ...state, records: [raw] }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail: id => calls.push(id) });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'Button')[0]
      : screen.props.renderItem({ item: raw, index: 0 });
    const target = platform === 'ios' ? row : nodes(row, item => item.type === 'Pressable')[0];
    target.props.onPress(); assert.deepEqual(calls, [raw.id]);
    const texts = nodes(row, item => item.type === 'Text');
    assert.deepEqual(texts.map(item => item.props.children), [raw.item_name, raw.item_code, '7 kg / m²']);
    const quantity = texts[2]; assert.equal(quantity.props.numberOfLines, undefined);
    assert.equal(nodes(target.props.children, item => ['Button', 'Pressable', 'ListItem'].includes(item.type)).length, 0);
    if (platform === 'ios') {
      assert.deepEqual(row.props.modifiers, [['buttonStyle', 'plain']]);
      assert.ok(row.props.children.props.modifiers.some(m => m[0] === 'contentShape' && m[1][0] === 'rectangle'));
      assert.ok(quantity.props.modifiers.some(m => m[0] === 'foregroundStyle' && m[1].color === 'secondaryLabel'));
    } else assert.equal(quantity.props.style.color, 'muted');
  }
});

test('iOS Home follows the selected Urdu locale direction, including ur-PK', () => {
  for (const [locale, direction] of [['uz', 'leftToRight'], ['en', 'leftToRight'], ['ru', 'leftToRight'], ['ur-PK', 'rightToLeft']]) {
    const screen = fixture('ios', state, locale).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    assert.equal(screen.props.layoutDirection, direction);
  }
});

test('iOS status detail follows the selected app locale rather than the device direction', () => {
  for (const [locale, direction] of [['uz', 'leftToRight'], ['en', 'leftToRight'], ['ru', 'leftToRight'], ['ur-PK', 'rightToLeft']]) {
    const screen = fixture('ios', state, locale).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.equal(screen.props.layoutDirection, direction);
  }
});
