// Content-only tests do not verify a device, shell, session lifecycle or navigation routes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const localization = { localizedGetter: (key, locale) => catalog.getters[key][locale], localizedMethod: (key, locale, values) => {
  if (key === 'recordCountLabel') return `${values.count} ${locale === 'uz' ? 'ta hujjat' : 'records'}`;
  if (key === 'sentQtyStatus') return `${values.qty.toFixed(0)} ${values.uom} ${values.statusWord}`;
  if (key === 'acceptedQtyLabel') return `Qabul qilindi: ${values.qty.toFixed(0)} ${values.uom}`;
  throw Error(key);
} };
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src/werka', file), loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const home = compile('werkaHomePresentation.ts', { '../shared/localization': localization });
const model = compile('werkaStatusPresentation.ts', { '../shared/localization': localization, './werkaHomePresentation': home });
const entry = { supplierRef: 's1', supplierName: 'Supplier', receiptCount: 2, totalSentQty: 5, totalAcceptedQty: 4, totalReturnedQty: 1, uom: 'kg' };
const record = (id, type = '', event = '') => ({ id, record_type: type, event_type: event, item_name: '', item_code: 'SKU', note: '',
  accepted_qty: 2, sent_qty: 3, uom: 'kg', created_label: '2026-05-01' });
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function setup(platform, overrides = {}) {
  const calls = [], mocks = { 'react/jsx-runtime': jsx, './werkaStatusPresentation': model, '../shared/localization': localization,
    '@expo/ui/swift-ui': Object.fromEntries(['Button', 'HStack', 'ProgressView', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name])),
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ onSurfaceVariant: 'gray' }) },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, 'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Text', 'View'].map(name => [name, name])) };
  const { WerkaStatusContent } = compile(`WerkaStatusContent.${platform}.tsx`, mocks);
  const props = { mode: 'breakdown', locale: 'uz', kind: 'pending', loading: false, error: null, items: [entry],
    onRefresh: async () => { calls.push(['refresh']); }, onOpen: (...args) => calls.push(['open', ...args]), ...overrides };
  return { tree: WerkaStatusContent(props), calls };
}
test('status presentation retains V2 metric, subtitle and routing rules', () => {
  assert.deepEqual(model.werkaBreakdownPresentation(entry, 'confirmed', 'uz'), { title: 'Supplier', subtitle: '2 ta hujjat', trailing: '4 kg tasdiqlangan' });
  assert.equal(model.werkaBreakdownPresentation({ ...entry, totalSentQty: -0 }, 'pending', 'uz').trailing, '-0 kg jarayonda');
  assert.equal(model.werkaDetailPresentation(record('r'), 'uz').title, 'SKU');
  assert.equal(model.werkaDetailPresentation({ ...record('r'), note: ' reason ' }, 'uz').subtitle, ' reason ');
  assert.equal(model.werkaStatusRecordTarget(record('r'), 'pending'), 'detail');
  assert.equal(model.werkaStatusRecordTarget(record('r'), 'confirmed'), 'notificationDetail');
  assert.equal(model.werkaStatusRecordTarget(record('r', 'delivery_note'), 'returned'), 'customerDeliveryDetail');
});
for (const platform of ['ios', 'android']) {
  const rowType = platform === 'ios' ? 'Button' : 'PreparationRow';
  test(`${platform} status body renders rows and forwards selected records`, () => {
    const breakdown = setup(platform), rows = nodes(breakdown.tree, rowType);
    assert.equal(rows.length, 1); rows[0].props.onPress(); assert.deepEqual(breakdown.calls, [['open', entry]]);
    const item = record('one'), detail = setup(platform, { mode: 'detail', kind: 'confirmed', items: [item] });
    nodes(detail.tree, rowType)[0].props.onPress(); assert.deepEqual(detail.calls, [['open', item, 'notificationDetail']]);
    assert.equal(nodes(detail.tree, platform === 'ios' ? 'PreparationList' : 'OrdersList').length, 1);
  });
  test(`${platform} status body distinguishes loading, error, empty and retained rows`, () => {
    const loading = setup(platform, { loading: true, items: [] }).tree;
    assert.equal(nodes(loading, platform === 'ios' ? 'ProgressView' : 'ActivityIndicator').length, 1);
    const failed = setup(platform, { error: new Error('offline'), items: [] });
    assert.equal(nodes(failed.tree, rowType).length, 1); nodes(failed.tree, rowType)[0].props.onPress();
    assert.deepEqual(failed.calls, [['refresh']]);
    assert.equal(nodes(setup(platform, { items: [] }).tree, rowType).length, 0);
    assert.equal(nodes(setup(platform, { error: new Error('offline'), items: [entry] }).tree, rowType).length, 1);
  });
}
