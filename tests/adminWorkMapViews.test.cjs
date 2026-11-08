const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const route = '/admin-production-map-orders';
for (const platform of ['ios', 'android']) test(`${platform} Work Map gates direct entry and binds real list handlers`, async () => {
  const calls = [], row = { kind: 'order', id: 'zakaz-1', code: '1', title: 'Order', customer: 'Client', imageId: 'i', displayState: 'paused', kg: null };
  let current = true, permitted = true;
  const shell = { session: {}, isCurrent: () => current, destination: value => permitted && value === route ? `/${platform}-admin/work-map` : null };
  const view = { shell, locale: 'uz', state: { query: '', rows: [row], loading: false, loaded: true, error: null, hasMore: true },
    controller: { reload: async () => calls.push('reload'), next: async () => calls.push('next') }, query: '',
    controls: { module: 'sequence' }, loading: false, error: null, emptyText: '', refresh: async () => calls.push('reload'),
    search: value => calls.push(['search', value]), goBack: () => calls.push('back'), onProfile: () => calls.push('profile'), open: item => calls.push(['open', item.id]) };
  const mocks = { react: { useEffect() {}, isValidElement: value => !!value && typeof value === 'object' && 'type' in value }, 'react-native': { Platform: { OS: platform }, PlatformColor: value => value, View: 'View', ActivityIndicator: 'ActivityIndicator', BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'expo-router': { Redirect: 'Redirect', Stack: { Screen: 'Stack.Screen' } }, '@expo/ui': { ListItem: 'ListItem' }, '@expo/ui/swift-ui': { Button: 'Button' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: '#fff' }) },
    '../shared/appRoutes': { appRoutes: { adminProductionMapOrders: route } }, '../shared/localization': { adminText: key => key, localizedGetter: key => key, productionText: key => key },
    '../components/BaseHost': { BaseHost: 'BaseHost' }, '../shared/orders/OrderListItem': { OrderListItem: 'OrderListItem' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' }, '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    './AdminWorkMapMove': { AdminWorkMapMove: 'AdminWorkMapMove' }, './AdminWorkMapPendingRow': { AdminWorkMapPendingRow: 'AdminWorkMapPendingRow' }, './AdminWorkMapClosedRow': { AdminWorkMapClosedRow: 'AdminWorkMapClosedRow' }, './AdminWorkMapAudit': { AdminWorkMapAudit: 'AdminWorkMapAudit' }, './AdminWorkMapControls': { AdminWorkMapModules: 'AdminWorkMapModules', AdminWorkMapApparatusFilter: 'AdminWorkMapApparatusFilter' },
    './AdminBottomBar.android': { AdminBottomBar: 'AdminBottomBar' }, './AdminShellContext': { useAdminShell: () => shell },
    './useAdminWorkMapView': { useAdminWorkMapView: () => view }, './adminWorkMapText': { adminWorkMapText: () => ({ partial: 'partial', more: 'more' }) },
    './adminWorkMapPresentation': { adminWorkMapPresentation: value => ({ headline: value.title, supporting: value.customer, tone: 'paused' }) } };
  const component = load(`admin/AdminWorkMapRoute.${platform}.tsx`, mocks).AdminWorkMapRoute;
  current = false; assert.equal(component().type, 'View'); current = true; permitted = false; assert.equal(component().type, 'Redirect'); permitted = true;
  const bound = component(), tree = bound.type(); let list;
  if (platform === 'ios') {
    assert.equal(tree.type, 'Fragment');
    const body = tree.props.children.find(value => value?.type === 'View'), children = body.props.children;
    const header = children.find(value => value?.type === 'OrdersHeader'); header.props.onSearchChange('abc'); header.props.onBack(); header.props.onProfile();
    list = children.find(value => value?.type === 'BaseHost' && value.props.children?.type === 'OrdersList').props.children;
  } else {
    assert.equal(tree.type, 'View'); const children = tree.props.children;
    const header = children.find(value => value?.type === 'OrdersHeader'); header.props.onSearchChange('abc'); header.props.onBack(); header.props.onProfile();
    list = children.find(value => value?.type === 'OrdersList');
  }
  assert.equal(list.type, 'OrdersList'); await list.props.onRefresh();
  const listChildren = list.props.children.flat(Infinity).filter(Boolean);
  assert.equal(listChildren.some(value => value.type === 'ListItem' && value.props.children === 'partial'), false);
  const renderedRow = listChildren.find(value => value.type === 'OrderListItem');
  assert.equal(renderedRow.props.imageActive, false); renderedRow.props.onPress();
  const more = listChildren.at(-1); more.props.onPress(); await Promise.resolve();
  assert.deepEqual(calls, [['search', 'abc'], 'back', 'profile', 'reload', ['open', 'zakaz-1'], 'next']);
  view.controls.module = 'orders'; const pending = { ...row, kind: 'pending', id: 'pending-1' }; view.state.rows = [pending];
  const pendingTree = bound.type(), pendingBody = platform === 'ios' ? pendingTree.props.children.find(value => value?.type === 'View') : pendingTree;
  const pendingList = platform === 'ios' ? pendingBody.props.children.find(value => value?.type === 'BaseHost' && value.props.children?.type === 'OrdersList').props.children
    : pendingBody.props.children.find(value => value?.type === 'OrdersList');
  const pendingRow = pendingList.props.children.flat(Infinity).filter(Boolean).find(value => value.type === 'AdminWorkMapPendingRow');
  assert.ok(pendingRow); pendingRow.props.onPress(); assert.deepEqual(calls.at(-1), ['open', 'pending-1']);
  assert.equal(pendingRow.props.infoLabel, 'worker.order.info');
  if (platform === 'android') { assert.equal(pendingList.props.passthrough(pendingRow), true); assert.equal(pendingList.props.passthrough({ type: 'Other' }), false); }
  view.controls.module = 'audit'; view.state.rows = []; view.audit = { title: 'Audit' }; view.error = 'failed';
  const auditTree = bound.type();
  const auditBody = platform === 'ios' ? auditTree.props.children.find(value => value?.type === 'View') : auditTree;
  const auditList = platform === 'ios' ? auditBody.props.children.find(value => value?.type === 'BaseHost' && value.props.children?.type === 'OrdersList').props.children
    : auditBody.props.children.find(value => value?.type === 'OrdersList');
  const auditChildren = auditList.props.children.flat(Infinity).filter(Boolean), auditContent = auditChildren.find(value => value.type === 'AdminWorkMapAudit');
  assert.equal(auditChildren.some(value => value.type === 'ListItem' && value.props.children === 'partial'), false);
  assert.equal(auditContent.props.model, view.audit); assert.equal(auditContent.props.onRefresh, view.refresh);
  assert.equal(auditChildren.some(value => value.type === 'OrderListItem' || value.type === 'ListItem' && value.props.supportingText === 'failed'), false);
  view.controls.module = 'closed'; view.closed = [{ id: 'closed', headline: 'Closed summary' }]; view.error = null;
  const closedTree = bound.type(), closedBody = platform === 'ios' ? closedTree.props.children.find(value => value?.type === 'View') : closedTree;
  const closedList = platform === 'ios' ? closedBody.props.children.find(value => value?.type === 'BaseHost' && value.props.children?.type === 'OrdersList').props.children
    : closedBody.props.children.find(value => value?.type === 'OrdersList');
  const closedChildren = closedList.props.children.flat(Infinity).filter(Boolean);
  assert.equal(closedChildren.some(value => value.type === 'ListItem' && value.props.children === 'partial'), false);
  const closedRow = closedChildren.find(value => value.type === 'AdminWorkMapClosedRow');
  assert.equal(closedRow.props.row, view.closed[0]); assert.equal(closedRow.props.onPress, undefined);
  view.controls.module = 'move'; view.move = { panes: [] };
  const moveTree = bound.type(), moveBody = platform === 'ios' ? moveTree.props.children.find(value => value?.type === 'View') : moveTree;
  const moveContent = moveBody.props.children.find(value => value?.type === 'AdminWorkMapMove'); assert.deepEqual(moveContent.props, view.move);



});

test('opening a detail requires the current shell, enabled destination and a list authority ticket', () => {
  let current = true, allowed = true, ticket = { generation: 1, id: 'o' }; const opened = [];
  const shell = { session: {}, isCurrent: () => current, destination: () => allowed ? '/ios-admin/work-map' : null };
  const row = { id: 'o', kind: 'order' }, ctrl = { detailTicket: () => ticket, setQuery() {} };
  const mocks = { react: { useCallback: fn => fn, useState: value => [value, () => {}], useSyncExternalStore: (_s, g) => g() },
    'expo-router': { router: { canGoBack: () => false, replace() {}, push() {} } }, 'react-native': { Platform: { OS: 'ios' } },
    '../nativeSheet': { useNativeSheet: () => ({ open: (value, options) => opened.push({ value, options }), close() {} }) },
    '../shared/appRoutes': { appRoutes: { adminProductionMapOrders: route, profile: '/profile' } },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/localization': { productionText: key => key, adminText: key => key, localizedGetter: key => key }, './AdminWorkMapDetail': { AdminWorkMapDetail: 'Detail' }, './AdminWorkMapMovePicker': { AdminWorkMapMovePicker: 'Picker' },
    './AdminShellContext': { useAdminShell: () => shell }, './adminWorkMapText': { adminWorkMapText: () => ({ partial: 'partial', more: 'more' }) }, './adminWorkMapPresentation': {}, './adminWorkMapClosedModel': { adminWorkMapClosedRows: () => [] }, './adminWorkMapAuditPresentation': { adminWorkMapAuditPresentation: () => ({}) }, './useAdminWorkMap': { useAdminWorkMap: () => ({ state: {}, controller: ctrl, workspace: { reload() {}, setQuery() {}, selectModule() {}, selectApparatus() {}, move: {} },
      workspaceState: { module: 'sequence', catalog: [], selected: null, catalogLoaded: false, catalogLoading: false, move: { top: null, bottom: null } } }) } };
  const view = load('admin/useAdminWorkMapView.tsx', mocks).useAdminWorkMapView();
  current = false; view.open(row); current = true; allowed = false; view.open(row); allowed = true; ticket = null; view.open(row); assert.equal(opened.length, 0);
  ticket = { generation: 1, id: 'o' }; view.open(row); assert.equal(opened.length, 1); assert.equal(opened[0].value.props.row, row); assert.equal(opened[0].options.dismissible, false);
  const pending = { id: 'p', kind: 'pending' }; view.open(pending); assert.equal(opened[1].options.dismissible, true);
});

test('Move headers open the source picker and bind a ticket to each choice', () => {
  const dart = load('admin/dartJsonString.ts'), model = load('admin/adminWorkMapMoveModel.ts', { './dartJsonString': dart });
  const a = { id: 'a', name: ' A ' }, b = { id: 'b', name: 'B' }, ticket = { side: 'top', generation: 8, selected: a,
    options: [model.adminWorkMapMoveUnassigned, a] }, opened = [], chosen = []; let current = true, closes = 0;
  const shell = { session: {}, isCurrent: () => current, destination: () => '/ios-admin/work-map' };
  const window = { rows: [], loading: false, loaded: true, error: null, hasMore: false };
  const move = { picker: side => side === 'top' ? ticket : null, choose: (issued, selection) => { chosen.push([issued, selection]); return true; },
    topWindow: { reload() {}, next() {} }, bottomWindow: { reload() {}, next() {} } };
  const workspace = { move, reload() {}, setQuery() {}, selectModule() {}, selectApparatus() {} };
  const mocks = { react: { useCallback: fn => fn, useState: value => [value, () => {}], useSyncExternalStore: (_s, g) => g() },
    'expo-router': { router: { canGoBack: () => false, replace() {}, push() {} } }, 'react-native': { Platform: { OS: 'ios' } },
    '../nativeSheet': { useNativeSheet: () => ({ open: (value, options) => opened.push({ value, options }), close: () => closes++ }) },
    '../shared/appRoutes': { appRoutes: { adminProductionMapOrders: route, profile: '/profile' } },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/localization': { productionText: key => key, adminText: key => key, localizedGetter: key => key },
    './AdminWorkMapDetail': { AdminWorkMapDetail: 'Detail' }, './AdminWorkMapMovePicker': { AdminWorkMapMovePicker: 'Picker' },
    './adminWorkMapMoveModel': model, './dartJsonString': dart, './AdminShellContext': { useAdminShell: () => shell },
    './adminWorkMapText': { adminWorkMapText: () => ({ partial: 'partial', more: 'more' }) }, './adminWorkMapPresentation': {},
    './adminWorkMapClosedModel': { adminWorkMapClosedRows: () => [] }, './adminWorkMapAuditPresentation': { adminWorkMapAuditPresentation: () => ({}) },
    './useAdminWorkMap': { useAdminWorkMap: () => ({ state: {}, controller: {}, workspace,
      workspaceState: { module: 'move', catalog: [a, b], selected: null, catalogLoaded: true, catalogLoading: false,
        move: { top: a, bottom: b, topWindow: window, bottomWindow: window } } }) } };
  const view = load('admin/useAdminWorkMapView.tsx', mocks).useAdminWorkMapView();
  current = false; view.move.panes[0].onPick(); assert.equal(opened.length, 0); current = true;
  view.move.panes[0].onPick(); assert.equal(opened.length, 1); assert.deepEqual(opened[0].options, { compact: true, dismissible: true });
  assert.equal(opened[0].value.props.title, 'worker.queue.select_apparatus');
  assert.deepEqual(opened[0].value.props.rows.map(row => [row.name, row.selected]), [['worker.queue.filter.unselected', false], ['A', true]]);
  opened[0].value.props.onChoose(model.adminWorkMapMoveUnassigned); assert.deepEqual(chosen, [[ticket, model.adminWorkMapMoveUnassigned]]); assert.equal(closes, 1);
  view.move.panes[1].onPick(); assert.equal(opened.length, 1);
});
