const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { load, strings, l10n } = require('./adminUsersSupport.cjs');
const rows = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': load('qolip/qolipApiCommon', { '../shared/mobileApiException': {} }), './dartJsonString': strings });
const entries = load('admin/AdminWarehouseMainEntries');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const colors = { surface: '#FFFFFFFF', surfaceContainerLow: '#EEEEEEFF', surfaceContainerHigh: '#CCCCCCFF', surfaceContainerLowest: '#FAFAFAFF', surfaceContainer: '#EEEEEEFF', secondaryContainer: '#BBBBBBFF', onSecondaryContainer: '#111111FF', onSurface: '#111111FF', onSurfaceVariant: '#666666FF', primary: '#334455FF', outlineVariant: '#AAAAAAFF' };
function native(name, slots = []) { const component = props => ({ type: name, props }); slots.forEach(slot => { component[slot] = `${name}.${slot}`; }); return component; }
function render(node) {
  if (Array.isArray(node)) return node.map(render); if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children) } };
}
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate)); if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const byID = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.name) && value.args[0] === id))[0];
const text = tree => nodes(tree, node => node.type === 'Text').map(node => node.props.children).flat().join(' ');
const click = (node, platform) => node.props[platform === 'android' ? 'onClick' : 'onPress']();
function fixture(platform, { scope = 'admin', selected = true, locale = 'uz', screen = 'content', dialog = false, reserved = false, valid = true } = {}) {
  const calls = [], a = (key, values) => l10n.adminText(key, locale, values), t = key => l10n.localizedGetter(key, locale);
  const stock = { id: 'raw', barcode: 'BAR', item_code: 'R', item_name: 'Raw', warehouse: 'A', qty: 2.5, uom: 'kg', status: 'available', reserved_order_id: ' Order ', source_receipt_id: '', width_mm: null, micron: null, length_m: null };
  const row = rows.adminWarehouseMainRawRow(stock, 0, a, scope !== 'werka', scope === 'material');
  const item = rows.adminWarehouseMainItemRow({ code: 'Code', name: 'Item', warehouse: 'A', order_id: 'Order', on_hand_qty: 5, uom: 'kg', package_count: 3, item_group: 'G' }, 0, a);
  const state = { warehouse: selected ? 'A' : null, summary: { sections: [{ warehouse: 'A' }, { warehouse: 'B' }] }, pageTab: 'products', stockTab: reserved ? 'reserved' : 'available', scrollReset: 2, filterExpanded: true, itemsLoading: false, loadingMore: false, itemsError: null, hasMore: true, items: [{}], search: '' };
  const model = { state, presentation: { searchFocused: false, fillText: '', fillVersion: 0 }, scope, focused: true, locale, a, t, valid, summaryScreen: screen, current: () => true, interactive: () => true,
    searchHint: a(scope === 'admin' ? 'warehouse.products_search' : 'warehouse.location_products_search'), bottomPaddingOffset: scope === 'werka' ? 24 : 128, filterNames: ['A', 'B'], hasSearchText: false, products: { qolip: false, availableCount: 7, hasReserved: reserved, reservedCount: 1 },
    availableGroups: [[item], [row]], reservedGroups: [[row]], dialog: dialog ? { id: 77, kind: 'details', row } : null,
    profile: () => ({ type: 'RealProfileAction', props: {} }), setSearch: value => calls.push(['search', value]), setSearchFocused: value => calls.push(['focus', value]), closeSearch: () => calls.push('close-search'), clearSearch: () => calls.push('clear-search'),
    back: () => calls.push('back'), toggleFilter: () => calls.push('filter'), selectWarehouse: value => calls.push(['warehouse', value]), setPageTab: value => calls.push(['page', value]), setStockTab: value => calls.push(['stock', value]),
    openRow: value => calls.push(['row', value]), runDetailAction: (...values) => calls.push(['detail-action', ...values]), loadMore: async () => calls.push('more'), retryItems: async () => calls.push('retry-items'), reload: async () => calls.push('reload'),
    actions: [{ id: 'warehouse-create' }], settings: { onChanged: async () => {}, onDeleted: async () => {}, isCurrent: () => true }, materialStates: { type: 'RealMaterialStates', props: {} }, detailOrder: { type: 'RealReservationOrderDetails', props: {} },
    closeDialog: () => calls.push('close-dialog'), beginDismissDialog: () => calls.push('dismiss-dialog'), dialogCurrent: () => true, created: async () => calls.push('created') };
  const compose = new Proxy({ Shape: { RoundedCorner: value => value }, useNativeState: value => ({ value }),
    BasicTextField: native('BasicTextField', ['DecorationBox', 'InnerTextField', 'Placeholder']), FilterChip: native('FilterChip', ['LeadingIcon', 'Label', 'TrailingIcon']) }, { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({ Grid: native('Grid', ['Row']), TabView: native('TabView', ['Tab']), List: native('List') }, { get: (target, name) => target[name] ?? String(name) });
  swift.List.ForEach = props => ({ type: 'List.ForEach', props: { ...props, children: props.data.map((item, index) => props.children({ item, index })) } });
  const transition = { duration: () => transition, easing: () => transition };
  const mocks = { react: { useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => [value, () => {}] }, 'react/jsx-runtime': jsx,
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': { ...modifiers, ...new Proxy({}, {}) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', ScrollView: 'RN.ScrollView', Platform: { Version: 18 }, PlatformColor: value => value, StyleSheet: { create: value => value, hairlineWidth: .5 }, useWindowDimensions: () => ({ width: 400, height: 800 }),
      FlatList: props => ({ type: 'FlatList', props: { ...props, children: [props.ListHeaderComponent, props.data.map(item => props.renderItem({ item }))] } }) },
    '@expo/ui/community/pager-view': { __esModule: true, default: 'PagerView' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, LinearTransition: transition, Easing: { out: value => value, cubic: 'cubic' }, useSharedValue: value => ({ value }), useAnimatedStyle: fn => fn(), withTiming: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    '../shared/localization': l10n, '../shared/themeRuntime': { themeController: { variant: 'white' } }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    './AdminCreateMenu.android': { AdminCreateMenu: 'AdminCreateMenu' }, './AdminCreateMenu.ios': { AdminCreateMenu: 'AdminCreateMenu' }, './AdminWarehouseCreateDialog.android': { AdminWarehouseCreateDialog: 'AdminWarehouseCreateDialog' }, './AdminWarehouseCreateDialog.ios': { AdminWarehouseCreateDialog: 'AdminWarehouseCreateDialog' },
    './AdminWarehouseSettingsTab.android': { AdminWarehouseSettingsTab: 'AdminWarehouseSettingsTab' }, './AdminWarehouseSettingsTab.ios': { AdminWarehouseSettingsTab: 'AdminWarehouseSettingsTab' }, './AdminWarehouseMainRows': rows, './AdminWarehouseMainEntries': entries, './useAdminWarehouseMain': { useAdminWarehouseMain: () => model } };
  mocks['@expo/ui/swift-ui/modifiers'] = new Proxy({ useScrollGeometryChange: callback => ({ name: 'geometry', args: [callback] }) }, { get: (target, name) => target[name] ?? modifiers[name] });
  const loadingFile = path.resolve(__dirname, '../src/admin/AdminLoadingIndicator.android.tsx'), loadingModule = new Module(loadingFile, module); loadingModule.filename = loadingFile; loadingModule.paths = module.paths; loadingModule.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loadingModule._compile(ts.transpileModule(fs.readFileSync(loadingFile, 'utf8'), { fileName: loadingFile, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, loadingFile);
  mocks['./AdminLoadingIndicator.android'] = loadingModule.exports;
  const filename = path.resolve(__dirname, `../src/admin/AdminWarehouseMainScreen.${platform}.tsx`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  const props = { scope, backLabel: 'Back', footer: { type: 'RealDock', props: {} }, session: {}, witness: {} };
  return { calls, row, model, render: () => render(mod.exports.AdminWarehouseMainScreen(props)) };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} main native filter, retained pager, source rows and stock tab dispatch exact values`, () => {
    const f = fixture(platform, { reserved: true }), tree = f.render();
    if (platform === 'android') { click(byID(tree, 'warehouse-filter'), platform); click(byID(tree, 'warehouse-main-tab-settings'), platform); click(byID(tree, 'warehouse-stock-tab-reserved'), platform); }
    else { byID(tree, 'warehouse-filter').props.onIsExpandedChange(false); byID(tree, 'warehouse-main-tabs').props.onSelectionChange('settings'); byID(tree, 'warehouse-stock-tabs').props.onSelectionChange('reserved'); }
    click(byID(tree, 'warehouse-filter-option-1'), platform); click(byID(tree, `warehouse-row-${f.row.id}`), platform);
    assert.deepEqual(f.calls.slice(0, 5), ['filter', ['page', 'settings'], ['stock', 'reserved'], ['warehouse', 'B'], ['row', f.row]]);
    const pager = nodes(tree, node => node.type === (platform === 'android' ? 'PagerView' : 'TabView'))[0]; assert.ok(pager);
    if (platform === 'android') { pager.props.onPageSelected({ nativeEvent: { position: 99 } }); pager.props.onPageSelected({ nativeEvent: { position: 0 } }); }
    else { pager.props.onSelectionChange('unknown'); pager.props.onSelectionChange('products'); }
    assert.deepEqual(f.calls.at(-1), ['page', 'products']); assert.equal(nodes(tree, node => node.type === 'AdminWarehouseSettingsTab')[0].props.onChanged, f.model.settings.onChanged);
    assert.equal(nodes(tree, node => node.type === 'AdminCreateMenu')[0].props.actions, f.model.actions);
    const dock = nodes(tree, node => node.type === 'View' && node.props.children?.type === 'RealDock')[0]; assert.equal(dock.props.style.position, 'absolute'); assert.equal(dock.props.style.bottom, 0);
    const frame = nodes(tree, node => node.type === 'View' && Array.isArray(node.props.style) && node.props.style[0]?.marginHorizontal === 6)[0]; assert.ok(frame); assert.equal(frame.props.style[0].borderTopLeftRadius, 18); assert.equal(frame.props.style[1].borderBottomRightRadius, 18);
  });
  test(`${platform} source main page words stay literal while material/worker branches receive only their real children`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) { const f = fixture(platform, { locale }), tree = f.render(); assert.ok(text(tree).includes('Mahsulotlar')); assert.ok(text(tree).includes('Sozlamalar')); }
    const material = fixture(platform, { scope: 'material' }).render(); assert.equal(nodes(material, node => node.type === 'RealMaterialStates').length, 1); assert.equal(nodes(material, node => node.type === 'AdminWarehouseSettingsTab').length, 0); assert.equal(nodes(material, node => node.type === 'AdminCreateMenu').length, 0);
    if (platform === 'android') assert.ok(text(material).includes(l10n.adminText('warehouse.location_products_search', 'uz')));
    else assert.equal(nodes(material, node => node.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions.placeholder, l10n.adminText('warehouse.location_products_search', 'uz'));
    const worker = fixture(platform, { scope: 'werka' }).render(); assert.equal(nodes(worker, node => node.type === 'AdminCreateMenu' || node.type === 'TabView' || node.type === 'PagerView').length, 0);
  });
  test(`${platform} source no-selection/loading/error and native summary retry do not expose pretend data`, async () => {
    const unselected = fixture(platform, { selected: false }); assert.ok(text(unselected.render()).includes(unselected.model.a('warehouse.no_selection')));
    const loading = fixture(platform, { screen: 'loading' }).render(); assert.equal(byID(loading, 'warehouse-filter'), undefined); assert.equal(nodes(loading, node => node.type === (platform === 'android' ? 'LoadingIndicator' : 'ProgressView')).length, 1);
    const error = fixture(platform, { screen: 'error' }), tree = error.render(); assert.ok(text(tree).includes(error.model.t('serverDisconnectedRetry'))); click(byID(tree, 'warehouse-retry'), platform); await Promise.resolve(); assert.deepEqual(error.calls, ['reload']);
    assert.equal(fixture(platform, { valid: false }).render(), null);
  });
  test(`${platform} generic details stays a native sheet with real order renderer, exact QR/edit action ticket and native cancellation`, () => {
    const f = fixture(platform, { scope: 'material', dialog: true }), tree = f.render(); assert.equal(nodes(tree, node => node.type === 'RealReservationOrderDetails').length, 1);
    click(byID(tree, 'warehouse-details-qr'), platform); click(byID(tree, 'warehouse-details-edit'), platform); assert.deepEqual(f.calls, [['detail-action', 77, 'qr'], ['detail-action', 77, 'edit']]);
    if (platform === 'android') nodes(tree, node => node.type === 'ModalBottomSheet')[0].props.onDismissRequest();
    else { const sheet = nodes(tree, node => node.type === 'BottomSheet')[0]; sheet.props.onIsPresentedChange(false); sheet.props.onDismiss(); assert.equal(nodes(byID(tree, 'warehouse-details-qr'), node => node.type === 'Image' && node.props.systemName === 'qrcode').length, 1); }
    assert.deepEqual(f.calls.slice(2), platform === 'android' ? ['close-dialog'] : ['dismiss-dialog', 'close-dialog']);
  });
  test(`${platform} parent create dialog receives the genuine guarded save and close callbacks`, async () => {
    const f = fixture(platform); f.model.dialog = { id: 91, kind: 'create' }; const tree = f.render(), create = nodes(tree, node => node.type === 'AdminWarehouseCreateDialog')[0];
    assert.equal(create.props.isCurrent, f.model.dialogCurrent); await create.props.onSaved(); create.props.onClose(); assert.deepEqual(f.calls, ['created', 'close-dialog']);
    assert.equal(nodes(tree, node => node.type === 'AdminCreateMenu')[0].props.visible, false);
  });
}
test('Android main keeps source63 toolbar,58 search,61 row, segmented corners,4 body and420 pagination threshold', async () => {
  const f = fixture('android'), tree = f.render(); assert.ok(nodes(tree, node => node.type === 'View' && node.props.style?.height === 63).length);
  const field = byID(tree, 'warehouse-search'); field.props.onValueChange(' raw '); field.props.onFocusChanged(true); field.props.keyboardActions.onSearch(); assert.deepEqual(f.calls, [['search', ' raw '], ['focus', true], 'close-search']);
  assert.ok(field.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 58));
  const row = byID(tree, `warehouse-row-${f.row.id}`); assert.ok(row.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 61)); assert.deepEqual(row.props.shape.cornerRadii, { topStart: 18, topEnd: 18, bottomStart: 6, bottomEnd: 6 });
  const list = nodes(tree, node => node.type === 'FlatList')[0]; assert.equal(list.props.contentContainerStyle.paddingHorizontal, 4); assert.equal(list.props.contentContainerStyle.paddingBottom, 144);
  list.props.onScroll({ nativeEvent: { contentSize: { height: 1000 }, contentOffset: { y: 179 }, layoutMeasurement: { height: 400 } } }); assert.equal(f.calls.includes('more'), false);
  list.props.onScroll({ nativeEvent: { contentSize: { height: 1000 }, contentOffset: { y: 180 }, layoutMeasurement: { height: 400 } } }); await Promise.resolve(); assert.equal(f.calls.at(-1), 'more');
});
test('iOS native search Cancel retains text and suppresses UIKit trailing empty change without clearing loaded filter', () => {
  const f = fixture('ios'), options = nodes(f.render(), node => node.type === 'Stack.Screen')[0].props.options, search = options.headerSearchBarOptions;
  assert.equal(options.headerBackVisible, false); assert.equal(options.headerRight().type, 'RealProfileAction'); options.headerLeft().props.onPress();
  search.onChangeText({ nativeEvent: { text: ' retained ' } }); search.onCancelButtonPress(); search.onChangeText({ nativeEvent: { text: '' } }); assert.deepEqual(f.calls, ['back', ['search', ' retained '], 'close-search']);
  search.onChangeText({ nativeEvent: { text: '' } }); assert.deepEqual(f.calls.at(-1), ['search', '']);
});
test('Android Main and first product read retain source48 native box while paging scales its glyph28/38 inside host48', () => {
  const glyphs = tree => nodes(tree, node => node.type === 'LoadingIndicator').map(node => node.props.modifiers.find(value => value.name === 'graphicsLayer').args[0].scaleX);
  const loading = fixture('android', { screen: 'loading' }); assert.deepEqual(glyphs(loading.render()), [1]);
  const products = fixture('android'); products.model.state.itemsLoading = true; assert.deepEqual(glyphs(products.render()), [1]);
  products.model.state.itemsLoading = false; products.model.state.loadingMore = true; assert.deepEqual(glyphs(products.render()), [28 / 38]);
});
