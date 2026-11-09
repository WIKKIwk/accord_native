// Content-only tests do not verify a device, shell, account lifecycle or navigation routes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const localization = { localizedGetter: (key, locale) => catalog.getters[key][locale] };
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src/werka', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const model = compile('werkaHomePresentation.ts', { '../shared/localization': localization });
const record = (id, type, event = '') => ({ id, record_type: type, event_type: event, item_name: `Item ${id}`,
  supplier_name: `Supplier ${id}`, sent_qty: 2.5, uom: 'kg', created_label: '2026-05-01' });
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function setup(platform, overrides = {}) {
  const calls = [], mocks = { 'react/jsx-runtime': jsx, './werkaHomePresentation': model, '../shared/localization': localization,
    '@expo/ui/swift-ui': Object.fromEntries(['Button', 'HStack', 'Image', 'ProgressView', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name])),
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ onSurfaceVariant: 'gray' }) },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
    '../components/WorkerExpansion': { WorkerExpansion: 'WorkerExpansion' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Text', 'View'].map(name => [name, name])) };
  const { WerkaHomeContent } = compile(`WerkaHomeContent.${platform}.tsx`, mocks);
  const props = { locale: 'uz', loading: false, loaded: true, error: null,
    summary: { pendingCount: 2, confirmedCount: 3, returnedCount: 4 }, pending: [record('one', ''), record('two', 'delivery_note')],
    expanded: true, onRefresh: async () => { calls.push(['refresh']); }, onToggle: () => calls.push(['toggle']),
    onOpenStatus: kind => calls.push(['status', kind]), onOpenRecord: (item, target) => calls.push(['record', item.id, target]), ...overrides };
  return { tree: WerkaHomeContent(props), calls };
}
test('home formatting and record targets follow V2', () => {
  assert.deepEqual(model.werkaHomeStatusRows({ pendingCount: 1, confirmedCount: 2, returnedCount: 3 }, 'uz').map(row => row.title),
    ['Jarayonda', 'Tasdiqlangan', 'Qaytarilgan']);
  assert.equal(model.werkaHomeQuantity(record('one', '')), '3 kg');
  assert.equal(model.werkaHomeQuantity({ ...record('one', ''), sent_qty: -0 }), '-0 kg');
  assert.equal(model.werkaHomeRecordTarget(record('one', '', 'customer_delivery_accepted')), 'customerDeliveryDetail');
});
for (const platform of ['ios', 'android']) {
  const rowType = platform === 'ios' ? 'Button' : 'PreparationRow';
  test(`${platform} home content retains status order and pending actions`, () => {
    const { tree, calls } = setup(platform), rows = nodes(tree, rowType);
    assert.equal(rows.length, platform === 'ios' ? 6 : 5);
    if (platform === 'ios') for (const row of rows) row.props.onPress();
    else {
      for (const row of rows.slice(0, 3)) row.props.onPress();
      nodes(tree, 'WorkerExpansion')[0].props.onPress();
      for (const row of rows.slice(3)) row.props.onPress();
    }
    assert.deepEqual(calls, [['status', 'pending'], ['status', 'confirmed'], ['status', 'returned'], ['toggle'],
      ['record', 'one', 'detail'], ['record', 'two', 'customerDeliveryDetail']]);
    assert.equal(nodes(tree, platform === 'ios' ? 'PreparationList' : 'OrdersList').length, 1);
  });
  test(`${platform} home preserves loading, retry, empty and collapsed states`, () => {
    const loading = setup(platform, { loading: true, loaded: false }).tree;
    assert.equal(nodes(loading, platform === 'ios' ? 'ProgressView' : 'ActivityIndicator').length, 1);
    assert.equal(nodes(loading, rowType).length, 0);
    const retry = setup(platform, { loaded: false, error: new Error('offline') });
    assert.equal(nodes(retry.tree, rowType).length, 1); nodes(retry.tree, rowType)[0].props.onPress();
    assert.deepEqual(retry.calls, [['refresh']]);
    assert.equal(nodes(setup(platform, { pending: [] }).tree, rowType).length, 3);
    const collapsed = setup(platform, { expanded: false }).tree;
    assert.equal(nodes(collapsed, rowType).length, platform === 'ios' ? 4 : 3);
    if (platform === 'android') assert.equal(nodes(collapsed, 'WorkerExpansion')[0].props.expanded, false);
  });
}
