const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadCustomerStates } = require('./support/customerNativeStates.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
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
function fixture(platform, state) {
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Host: 'Host', Button: 'Button' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: v => ['listStyle', v], refreshable: f => ['refreshable', f], listRowBackground: v => ['background', v],
      foregroundStyle: v => ['foregroundStyle', v], buttonStyle: v => ['buttonStyle', v], contentShape: v => ['contentShape', v],
      fixedSize: v => ['fixedSize', v], font: v => ['font', v], frame: v => ['frame', v], lineLimit: () => ['lineLimit'], padding: v => ['padding', v],
      shapes: { rectangle: () => ['rectangle'] } },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', surfaceContainer: 'highlight', onSurface: 'fg', onSurfaceVariant: 'muted' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', RefreshControl: 'RefreshControl', Text: 'Text', View: 'View', PlatformColor: v => v },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, './CustomerContext': { useCustomerText: () => ({ text: key => key }) },
    './CustomerStates': loadCustomerStates(platform), './customerPresentation': presentation,
    './useCustomerScreens': { useCustomerHome: () => state, useCustomerStatus: () => state } };
  return load(`CustomerHome.${platform}.tsx`, mocks);
}
const state = { loading: false, loaded: true, error: null, summary: { pendingCount: 2, confirmedCount: 1, rejectedCount: 0 }, records: [record], refresh: async () => {} };
test('iOS home exposes all status destinations and the shipment detail with native list rows', () => {
  const calls = [], screen = fixture('ios', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  const rows = nodes(screen, item => item.type === 'ListItem'); assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].props.modifiers, [['background', 'secondarySystemFill']]); assert.equal(rows[1].props.modifiers, undefined);
  rows[0].props.onPress(); rows[1].props.onPress(); rows[2].props.onPress(); rows[3].props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
  assert.equal(rows[3].props.supportingText.props.children, 'P1');
});
test('Android home reuses queue cards, routes every status and opens shipment', () => {
  const calls = [], screen = fixture('android', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  assert.equal(screen.type, 'FlatList');
  const cards = nodes(screen.props.ListHeaderComponent, item => item.type === 'WorkerQueueCard'); assert.equal(cards.length, 3);
  assert.equal(cards[0].props.backgroundColor, 'highlight'); assert.equal(cards[1].props.backgroundColor, 'bg');
  cards.forEach(card => card.props.onPress());
  const shipment = screen.props.renderItem({ item: record, index: 0 }); shipment.props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
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
test('status rows open the selected delivery and empty states use the V2 label', () => {
  const calls = [], ios = fixture('ios', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  nodes(ios, item => item.type === 'Button')[0].props.onPress();
  const android = fixture('android', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  android.props.renderItem({ item: record, index: 0 }).props.onPress(); assert.deepEqual(calls, ['dn', 'dn']);
  for (const platform of ['ios', 'android']) {
    const empty = fixture(platform, { ...state, records: [] }).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.ok(nodes(empty.type(empty.props), item => item.type === 'Text').some(item => item.props.children === 'noRecordsYet'));
  }
});

// Source-derived: customer_home_screen_widgets_part_02.dart _CustomerPreviewRow.
test('home previews keep V2 one-line name and code limits without changing content', () => {
  const longRecord = { ...record, item_name: 'Mahsulot نام '.repeat(40), item_code: 'PRODUCT-'.repeat(40) };
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, { ...state, records: [longRecord] }).CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'ListItem')[3]
      : screen.props.renderItem({ item: longRecord, index: 0 });
    const texts = nodes(row, item => item.type === 'Text');
    if (platform === 'ios') texts.push(...nodes(row.props.supportingText, item => item.type === 'Text'));
    for (const value of [longRecord.item_name, longRecord.item_code]) {
      const text = texts.find(item => item.props.children === value);
      assert.ok(text, `${platform} retains the complete input for native truncation`);
      assert.equal(text.props.numberOfLines, 1, `${platform} preview limit`);
      if (platform === 'android') assert.equal(text.props.ellipsizeMode, 'tail');
      else if (value === longRecord.item_code) assert.deepEqual(text.props.modifiers, [['foregroundStyle', { type: 'color', color: 'secondaryLabel' }]]);
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
    const body = row.props.children;
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
