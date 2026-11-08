const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
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
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: v => ['listStyle', v], refreshable: f => ['refreshable', f] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', onSurface: 'fg', onSurfaceVariant: 'muted' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', RefreshControl: 'RefreshControl', Text: 'Text', View: 'View' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, './CustomerContext': { useCustomerText: () => ({ text: key => key }) },
    './customerPresentation': presentation, './useCustomerScreens': { useCustomerHome: () => state, useCustomerStatus: () => state } };
  return load(`CustomerHome.${platform}.tsx`, mocks);
}
const state = { loading: false, loaded: true, error: null, summary: { pendingCount: 2, confirmedCount: 1, rejectedCount: 0 }, records: [record], refresh: async () => {} };
test('iOS home exposes all status destinations and the shipment detail with native list rows', () => {
  const calls = [], screen = fixture('ios', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  const rows = nodes(screen, item => item.type === 'ListItem'); assert.equal(rows.length, 4);
  rows[0].props.onPress(); rows[1].props.onPress(); rows[2].props.onPress(); rows[3].props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
  assert.equal(rows[3].props.supportingText, 'P1');
});
test('Android home reuses queue cards, routes every status and opens shipment', () => {
  const calls = [], screen = fixture('android', state).CustomerHomeScreen({ onOpenStatus: kind => calls.push(kind), onOpenDetail: id => calls.push(id) });
  assert.equal(screen.type, 'FlatList');
  const cards = nodes(screen.props.ListHeaderComponent, item => item.type === 'WorkerQueueCard'); assert.equal(cards.length, 3);
  cards.forEach(card => card.props.onPress());
  const shipment = screen.props.renderItem({ item: record, index: 0 }); shipment.props.onPress();
  assert.deepEqual(calls, ['pending', 'confirmed', 'rejected', 'dn']);
});
test('both platforms show loading before the initial bootstrap and retry after an initial failure', () => {
  for (const platform of ['ios', 'android']) {
    const views = fixture(platform, { ...state, loaded: false, loading: false, error: null });
    const loading = views.CustomerHomeScreen({ onOpenStatus() {}, onOpenDetail() {} });
    assert.equal(loading.type.name, 'LoadingOrRetry'); assert.equal(loading.props.loading, true);
    const failed = fixture(platform, { ...state, loaded: false, loading: false, error: Error('x') })
      .CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.equal(failed.type.name, 'LoadingOrRetry'); assert.equal(failed.props.loading, false);
  }
});
test('status rows open the selected delivery and empty states use the V2 label', () => {
  const calls = [], ios = fixture('ios', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  nodes(ios, item => item.type === 'ListItem')[0].props.onPress();
  const android = fixture('android', state).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail: id => calls.push(id) });
  android.props.renderItem({ item: record, index: 0 }).props.onPress(); assert.deepEqual(calls, ['dn', 'dn']);
  for (const platform of ['ios', 'android']) {
    const empty = fixture(platform, { ...state, records: [] }).CustomerStatusDetailScreen({ kind: 'pending', onOpenDetail() {} });
    assert.ok(nodes(empty, item => item.type === 'Text').some(item => item.props.children === 'noRecordsYet'));
  }
});
