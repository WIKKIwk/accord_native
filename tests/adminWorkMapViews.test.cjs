/* global __dirname */
const { adminShellThemeFixture } = require('./support/adminShellTheme.cjs');
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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] :
    id === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const route = '/admin-production-map-orders';
for (const platform of ['ios', 'android']) test(`${platform} Work Map gates direct entry and binds real list handlers`, async () => {
  const calls = [], row = { kind: 'order', id: 'zakaz-1', code: '1', title: 'Order', customer: 'Client', imageId: 'i', displayState: 'paused', kg: null, position: 13 };
  let current = true, permitted = true;
  const shell = { session: { profile: { role: 'admin', ref: 'ADMIN-A' } }, isCurrent: () => current, destination: value => permitted && value === route ? `/${platform}-admin/work-map` : null };
  const view = { shell, locale: 'uz', state: { query: '', rows: [row], loading: false, loaded: true, error: null, hasMore: true },
    controller: { reload: async () => calls.push('reload'), next: async () => calls.push('next') }, query: '',
    controls: { module: 'sequence', onModule: id => calls.push(['tab', id]) }, next: module => calls.push(['next', module]), loading: false, error: null, emptyText: '', refresh: async () => calls.push('reload'),
    filterProfileRef: 'ADMIN-A', sequenceCurrent: () => current && view.controls.module === 'sequence',
    search: value => calls.push(['search', value]), goBack: () => calls.push('back'), onProfile: () => calls.push('profile'), open: item => calls.push(['open', item.id]) };
  const mocks = { react: { useEffect() {}, isValidElement: value => !!value && typeof value === 'object' && 'type' in value }, 'react-native': { Platform: { OS: platform }, PlatformColor: value => value, View: 'View', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }), SafeAreaView: 'SafeAreaView' },
    'expo-router': { Redirect: 'Redirect', Stack: { Screen: 'Stack.Screen' }, useIsFocused: () => true, useNavigation: () => ({ isFocused: () => true }) }, '@expo/ui': { ListItem: 'ListItem' }, '@expo/ui/swift-ui': { Button: 'Button' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: '#fff' }) },
    '../shared/appRoutes': { appRoutes: { adminProductionMapOrders: route } }, '../shared/localization': { adminText: key => key, localizedGetter: key => key, productionText: key => key },
    '../components/BaseHost': { BaseHost: 'BaseHost' }, '../shared/orders/OrderListItem': { OrderListItem: 'OrderListItem' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' }, '../shared/orders/ordersWorkspaceTypes': { ORDERS_TAB_BAR_HEIGHT: 48 },
    './adminWorkMapControlsTypes': load('admin/adminWorkMapControlsTypes.ts'), './AdminClosedHistoryAccessories': { AdminClosedRank: 'Rank' }, '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    './AdminWorkMapMove': { AdminWorkMapMove: 'AdminWorkMapMove' }, './AdminWorkMapPendingRow': { AdminWorkMapPendingRow: 'AdminWorkMapPendingRow' }, './AdminWorkMapSequenceRow': { AdminWorkMapSequenceRow: 'AdminWorkMapSequenceRow' }, './AdminWorkMapClosedRow': { AdminWorkMapClosedRow: 'AdminWorkMapClosedRow' }, './AdminWorkMapAudit': { AdminWorkMapAudit: 'AdminWorkMapAudit' }, './AdminWorkMapControls': { AdminWorkMapModules: 'AdminWorkMapModules', AdminWorkMapApparatusFilter: 'AdminWorkMapApparatusFilter', AdminWorkMapSequenceFilter: 'AdminWorkMapSequenceFilter' },
    './AdminShellNoticeProvider': { useAdminShellNotice: () => ({ topNotice: null, onErrorNotice: () => {} }) },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: {} }) },
    './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' },
    './AdminShellProfileAction': { AdminShellProfileAction: 'AdminShellProfileAction' },
    './AdminBottomBar.android': { AdminBottomBar: 'AdminBottomBar' }, './AdminShellContext': { useAdminShell: () => shell },
    './useAdminWorkMapView': { useAdminWorkMapView: () => view }, './adminWorkMapText': { adminWorkMapText: () => ({ partial: 'partial', more: 'more' }) },
    './adminWorkMapPresentation': { adminWorkMapPresentation: value => ({ headline: `${value.position == null ? '' : `${value.position}. `}${value.title}`, supporting: value.customer, tone: 'paused' }) } };
  const component = load(`admin/AdminWorkMapRoute.${platform}.tsx`, mocks).AdminWorkMapRoute;
  current = false; assert.equal(component().type, 'View'); current = true; permitted = false; assert.equal(component().type, 'Redirect'); permitted = true;
  const bound = component(), render = () => bound.type(bound.props);
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(child, type);
      if (result) return result;
    }
  };
  const page = tree => platform === 'android' ? find(tree, 'OrdersWorkspace').props.children(view.controls.module, 'PagerGesture') : tree;
  const getList = tree => find(page(tree), 'OrdersList');
  const rows = list => platform === 'android' ? list.props.rows.map(list.props.renderRow) : list.props.children.flat(Infinity).filter(Boolean);
  const tree = render(), frame = find(tree, 'AdminShellBodyFrame'), list = getList(frame);
  const header = find(tree, 'OrdersHeader');
  assert.equal(header.props.profileAction.type, 'AdminShellProfileAction');
  assert.equal(find(frame, 'OrdersHeader'), undefined);
  if (platform === 'android') {
    const workspace = find(frame, 'OrdersWorkspace');
    assert.deepEqual(workspace.props.tabs.map(tab => tab.id), ['sequence', 'orders', 'move', 'closed', 'audit']);
    assert.equal(workspace.props.selected, 'sequence'); assert.equal(workspace.props.swipeEnabled, true);
    assert.equal(workspace.props.children('closed'), null);
    workspace.props.onSelect('orders'); workspace.props.onSelect('invalid');
    assert.deepEqual(calls.splice(0), [['tab', 'orders']]);
    assert.equal(find(tree, 'AdminBottomBar').props.active, 'home');
    assert.equal(find(frame, 'AdminBottomBar'), undefined);
    assert.equal(list.props.pagerGesture, 'PagerGesture');
    assert.equal(list.props.topInset, 48);
    const filter = find(list, 'AdminWorkMapSequenceFilter');
    assert.equal(filter.props.profileRef, 'ADMIN-A'); assert.equal(filter.props.isCurrent(), true);
  }
  header.props.onSearchChange('abc'); header.props.onBack(); header.props.onProfile();
  assert.equal(list.type, 'OrdersList'); await list.props.onRefresh();
  const listChildren = rows(list);
  const renderedRow = listChildren.find(value => value.type === (platform === 'android' ? 'OrderListItem' : 'AdminWorkMapSequenceRow'));
  assert.equal(renderedRow.props.headline, 'Order'); renderedRow.props.onPress();
  if (platform === 'android') {
    assert.equal(renderedRow.props.cardTone, 'paused');
    assert.equal(find(renderedRow.props.leadingAdornment, 'Rank').props.position, '13');
    assert.equal(renderedRow.props.imageId, 'i'); assert.equal(renderedRow.props.imageActive, true);
    assert.equal(list.props.rowKey(row), 'order:zakaz-1');
    assert.equal(list.props.userScrollPagination.distance, 400);
    list.props.userScrollPagination.loadMore();
  } else {
    assert.equal(renderedRow.props.position, 13); assert.equal(renderedRow.props.tone, 'paused');
    assert.equal(renderedRow.props.imageId, undefined);
    listChildren.at(-1).props.onPress();
  }
  assert.deepEqual(calls, [['search', 'abc'], 'back', 'profile', 'reload', ['open', 'zakaz-1'], platform === 'android' ? ['next', 'sequence'] : 'next']);
  view.controls.module = 'orders'; view.state.rows = [row];
  const orderRow = rows(getList(render())).find(value => value.type === 'OrderListItem');
  assert.equal(orderRow.props.imageActive, platform === 'android');
  assert.equal(orderRow.props.leadingAdornment, undefined);
  const pending = { ...row, kind: 'pending', id: 'pending-1' }; view.state.rows = [pending];
  const pendingRow = rows(getList(render())).find(value => value.type === 'AdminWorkMapPendingRow');
  assert.ok(pendingRow); pendingRow.props.onPress(); assert.deepEqual(calls.at(-1), ['open', 'pending-1']);
  assert.equal(pendingRow.props.infoLabel, 'worker.order.info');
  view.controls.module = 'audit'; view.state.rows = []; view.audit = { title: 'Audit' }; view.error = 'failed';
  const auditContent = find(page(render()), 'AdminWorkMapAudit');
  assert.equal(auditContent.props.model, view.audit); assert.equal(auditContent.props.onRefresh, view.refresh);
  assert.equal(auditContent.props.userScrollPagination, undefined);
  view.controls.module = 'closed'; view.closed = [{ id: 'closed', headline: 'Closed summary' }]; view.error = null;
  const closedRow = rows(getList(render())).find(value => value.type === 'AdminWorkMapClosedRow');
  assert.equal(closedRow.props.row, view.closed[0]); assert.equal(closedRow.props.onPress, undefined);
  view.controls.module = 'move'; view.move = { panes: [] };
  const moveContent = find(page(render()), 'AdminWorkMapMove');
  assert.equal(moveContent.props.panes, view.move.panes);
  if (platform === 'android') assert.equal(moveContent.props.pagerGesture, 'PagerGesture');
});

test('opening a detail requires the current shell, enabled destination and a list authority ticket', () => {
  let current = true, allowed = true, ticket = { generation: 1, id: 'o' }; const opened = [];
  const shell = { session: { profile: { role: 'admin', ref: 'ADMIN-A' } }, isCurrent: () => current, destination: () => allowed ? '/ios-admin/work-map' : null };
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
  const shell = { session: { profile: { role: 'admin', ref: 'ADMIN-A' } }, isCurrent: () => current, destination: () => '/ios-admin/work-map' };
  const window = { rows: [{ id: 'o', kind: 'order', code: ' 17 ', title: '', customer: ' Ana ' }], loading: false, loaded: true, error: null, hasMore: false };
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
  assert.deepEqual(view.move.panes[0].rows[0], { id: 'o', position: '1', code: '17', title: 'worker.order.fallback', supporting: 'Ana' });
  current = false; view.move.panes[0].onPick(); assert.equal(opened.length, 0); current = true;
  view.move.panes[0].onPick(); assert.equal(opened.length, 1); assert.deepEqual(opened[0].options, { compact: true, dismissible: true });
  assert.equal(opened[0].value.props.title, 'worker.queue.select_apparatus');
  assert.deepEqual(opened[0].value.props.rows.map(row => [row.name, row.selected]), [['worker.queue.filter.unselected', false], ['A', true]]);
  opened[0].value.props.onChoose(model.adminWorkMapMoveUnassigned); assert.deepEqual(chosen, [[ticket, model.adminWorkMapMoveUnassigned]]); assert.equal(closes, 1);
  view.move.panes[1].onPick(); assert.equal(opened.length, 1);
});
