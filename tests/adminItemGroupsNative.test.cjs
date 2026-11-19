/* global __dirname */
const { adminShellThemeFixture } = require('./support/adminShellTheme.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, name) ? mocks[name] :
    name === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const modifier = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
const native = new Proxy({ useMaterialColors: () => ({}), useNativeState: value => ({ value }), Shape: { RoundedCorner: value => value } }, { get: (obj, key) => key in obj ? obj[key] : key });
const rn = { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} } };
test('Android uses source 56-high, 20-corner native filled submit and the real disabled state', () => {
  const Button = load('admin/ItemGroupsActionButton.android.tsx', { '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier }).ItemGroupsActionButton;
  let clicked = 0; const tree = Button({ label: 'Create', disabled: true, onPress: () => clicked++ }), button = nodes(tree, node => node.type === 'Button')[0];
  assert.equal(button.props.enabled, false); assert.equal(button.props.shape.cornerRadii.topStart, 20);
  assert.ok(button.props.modifiers.some(value => value.name === 'height' && value.args[0] === 56));
  assert.equal(nodes(tree, node => node.type === 'Text')[0].props.children, 'Create'); assert.equal(clicked, 0);
});
test('Android uses a true outlined native name field and 52-high/12-corner source picker field', () => {
  const fieldNative = { ...native, Host: 'Host', OutlinedTextField: Object.assign('OutlinedTextField', { Label: 'OutlinedTextField.Label' }) };
  const Name = load('admin/ItemGroupsNameField.android.tsx', { '@expo/ui/jetpack-compose': fieldNative, '@expo/ui/jetpack-compose/modifiers': modifier }).ItemGroupsNameField;
  const tree = Name({ label: 'Name', initial: '', enabled: true, onChange() {} });
  assert.equal(tree.props.children.props.shape.cornerRadii.topStart, 12); assert.equal(tree.props.children.props.enabled, true); assert.equal(tree.props.children.props.singleLine, true);
  const Field = load('admin/ItemGroupsPickerField.android.tsx', { '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier, 'expo-symbols': { SymbolView: 'SymbolView' } }).ItemGroupsPickerField;
  const pick = Field({ label: 'Parent', value: null, placeholder: 'Choose parent', enabled: false, onPress() {} });
  const button = nodes(pick, node => node.type === 'Surface')[0]; assert.equal(button.props.enabled, false); assert.equal(button.props.shape.cornerRadii.topStart, 12); assert.equal(button.props.border.width, 1);
  assert.ok(button.props.modifiers.some(value => value.name === 'height' && value.args[0] === 52));
  assert.deepEqual(nodes(pick, node => node.type === 'Text').map(node => node.props.children), ['Parent', 'Choose parent']);
});
test('dialog content uses source create/move fields and captures the particular dialog ID in native callbacks', () => {
  const calls = [], controller = { setName: (...args) => calls.push(['name', ...args]), openPicker: (...args) => calls.push(['picker', ...args]),
    setIsGroup: (...args) => calls.push(['group', ...args]), submit: (...args) => calls.push(['submit', ...args]), closeDialog: (...args) => calls.push(['close', ...args]) };
  const Content = load('admin/ItemGroupsDialogContent.tsx', { '@expo/ui': { Host: 'Host', Switch: 'Switch' }, 'react-native': rn,
    '../components/WorkerIconButton': { WorkerIconButton: 'Close' }, '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    './itemGroupsModel': { itemGroupsMoveChoices: () => ({ groups: ['A'], parents: ['Root'] }) }, './ItemGroupsNameField': { ItemGroupsNameField: 'Name' },
    './ItemGroupsPickerField': { ItemGroupsPickerField: 'Field' }, './ItemGroupsTypeSwitch': { ItemGroupsTypeSwitch: 'TypeSwitch' }, './ItemGroupsActionButton': { ItemGroupsActionButton: 'Action' } }).ItemGroupsDialogContent;
  const model = { controller, t: key => key, state: { picker: null } }, dialog = { id: 42, kind: 'create', groups: ['Root'], phase: 'ready', name: '', parent: 'Root', isGroup: true, saving: false };
  const create = Content({ dialog, model }); assert.deepEqual(nodes(create, node => node.type === 'Field').map(node => node.props.label), ['item_group.parent']);
  nodes(create, node => node.type === 'Name')[0].props.onChange('New'); nodes(create, node => node.type === 'Action')[0].props.onPress();
  assert.deepEqual(calls, [['name', 42, 'New'], ['submit', 42]]);
  nodes(create, node => node.type === 'TypeSwitch')[0].props.onChange(false); assert.deepEqual(calls.at(-1), ['group', 42, false]);
  const saving = Content({ dialog: { ...dialog, saving: true }, model }); assert.equal(nodes(saving, node => node.type === 'TypeSwitch')[0].props.disabled, true);
  assert.equal(nodes(saving, node => node.type === 'Name')[0].props.enabled, true);
  const move = Content({ dialog: { ...dialog, id: 43, kind: 'move', group: 'A' }, model });
  assert.equal(nodes(move, node => node.type === 'Name').length, 0);
  assert.deepEqual(nodes(move, node => node.type === 'Field').map(node => node.props.label), ['item_group.movable_group', 'item_group.new_parent']);
  assert.equal(nodes(move, node => node.type === 'Action')[0].props.disabled, false);
});
test('Android type switch keeps both labels beside the native switch and delegates the disabled accessibility row', () => {
  const TypeSwitch = load('admin/ItemGroupsTypeSwitch.android.tsx', { '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier }).ItemGroupsTypeSwitch;
  const tree = TypeSwitch({ label: 'Group', hint: 'Contains other groups', value: true, disabled: true, onChange() {} });
  const row = nodes(tree, node => node.type === 'Row')[0], control = nodes(tree, node => node.type === 'Switch')[0];
  assert.equal(row.props.modifiers.find(value => value.name === 'toggleable').args[2].enabled, false); assert.equal(control.props.enabled, false); assert.equal(control.props.onCheckedChange, undefined);
  assert.deepEqual(nodes(row.props.children[0], node => node.type === 'Text').map(node => node.props.children), ['Group', 'Contains other groups']);
});
for (const platform of ['android', 'ios']) test(`${platform} native route preserves source swipe pages, menu order, focus visibility and stable action identities`, () => {
  const calls = [], t = key => key, controller = { open: kind => calls.push(kind), setTab: tab => calls.push(['tab', tab]),
    reload: async () => calls.push('refresh-tree'), loadItems: async replace => calls.push(['refresh-items', replace]), itemsScrolled() {} }, current = () => true;
  const state = { valid: true, treePhase: 'ready', parentsPhase: 'ready', tab: 'tree', expanded: new Set(), items: [], notice: null, dialog: null, picker: null };
  const model = { state, controller, t, locale: 'en', roots: [], displayGroups: [], current, focused: true };
  let cursor = 0, effects = []; const memos = [];
  const react = { useMemo: create => { const index = cursor++; return memos[index] ??= create(); }, useRef: value => ({ current: value }), useEffect: callback => effects.push(callback) };
  const mocks = { '../components/useBaseTheme': { useBaseTheme: () => ({ colors: {}, mode: 'light' }) },
    './AdminTopBar.android': { AdminScreenHeader: 'AdminScreenHeader' }, './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' },
    react, 'react-native': { ...rn, FlatList: 'FlatList', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Pressable: 'Pressable', Modal: 'Modal', KeyboardAvoidingView: 'KeyboardAvoidingView',
    PlatformColor: value => value, useWindowDimensions: () => ({ height: 800, width: 400 }) },
    '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifier,
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/ordersWorkspaceTypes': { ORDERS_TAB_BAR_HEIGHT: 48 }, './AdminTypography.android': { AdminText: 'Text' },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    '../shared/localization': { localizedGetter: key => key }, './useItemGroupsRoute': { useItemGroupsRoute: () => model },
    './itemGroupsModel': { itemGroupsVisibleTree: () => [] }, [`./AdminCreateMenu.${platform}`]: { AdminCreateMenu: 'Menu' } };
  const Route = load(`admin/ItemGroupsRoute.${platform}.tsx`, mocks).ItemGroupsRoute, props = { navigation: null };
  cursor = 0; const tree = Route(props), menu = nodes(tree, node => node.type === 'Menu')[0];
  assert.deepEqual(menu.props.actions.map(action => action.label), ['item_group.add', 'item_group.move_parent']); menu.props.actions[0].onPress(); menu.props.actions[1].onPress(); assert.deepEqual(calls, ['create', 'move']);
  const pagerType = platform === 'android' ? 'OrdersWorkspace' : 'TabView';
  const pager = nodes(tree, node => node.type === pagerType)[0];
  if (platform === 'android') {
    assert.equal(pager.props.selected, 'tree'); assert.equal(pager.props.swipeEnabled, true);
    assert.deepEqual(pager.props.tabs, [{ id: 'tree', name: 'item_group.tree_tab' }, { id: 'items', name: 'item_group.items_tab' }]);
    pager.props.onSelect('items'); pager.props.onSelect('tree'); pager.props.onSelect('unknown');
  } else {
    assert.equal(pager.props.children.length, 2);
    assert.equal(pager.props.selection, 'tree'); assert.deepEqual(pager.props.children.map(tab => tab.props.value), ['tree', 'items']);
    assert.deepEqual(pager.props.modifiers.find(value => value.name === 'tabViewStyle').args[0], { type: 'page', indexDisplayMode: 'never' });
    pager.props.onSelectionChange('items'); pager.props.onSelectionChange('tree'); pager.props.onSelectionChange('unknown');
  }
  assert.deepEqual(calls.slice(2), [['tab', 'items'], ['tab', 'tree']]);
  if (platform === 'android') {
    const gesture = {}, treeList = pager.props.children('tree', gesture);
    assert.equal(treeList.type, 'OrdersList'); assert.equal(treeList.props.pagerGesture, gesture); assert.equal(treeList.props.active, true);
    treeList.props.onRefresh();
    const surface = nodes(treeList, node => node.type === 'Surface')[0]; assert.equal(surface.props.shadowElevation, 4); assert.equal(surface.props.shape.cornerRadii.topStart, 18);
    assert.equal(surface.props.children.props.children.props.style.padding, 14);
    const itemsList = pager.props.children('items', gesture);
    assert.equal(itemsList.type, 'OrdersList'); assert.equal(itemsList.props.active, false); assert.equal(itemsList.props.onScrollMetrics, controller.itemsScrolled);
    itemsList.props.onRefresh();
    assert.deepEqual(calls.slice(-2), ['refresh-tree', ['refresh-items', true]]);
  }
  cursor = 0; effects = []; state.tab = 'items';
  state.selectedGroup = 'Group A'; state.items = [{ code: 'same', name: 'First', uom: 'kg' }, { code: 'same', name: 'Second', uom: 'kg' }];
  const selected = Route(props), selectedPager = nodes(selected, node => node.type === pagerType)[0];
  if (platform === 'android') {
    assert.equal(selectedPager.props.selected, 'items');
    const itemList = selectedPager.props.children('items');
    assert.equal(itemList.props.active, true); assert.equal(itemList.props.rows, state.items);
    assert.deepEqual(itemList.props.rows.map(itemList.props.rowKey), ['0:same', '1:same']);
  }
  else assert.equal(selectedPager.props.selection, 'items');
  cursor = 0; model.focused = false; const second = Route(props), next = nodes(second, node => node.type === 'Menu')[0];
  assert.equal(next.props.visible, false); assert.equal(menu.props.actions, next.props.actions); assert.equal(menu.props.isCurrent, next.props.isCurrent);
  if (platform === 'android') assert.equal(nodes(second, node => node.type === pagerType)[0].props.swipeEnabled, false);
  else assert.equal(nodes(second, node => node.type === 'TabView')[0].props.modifiers.find(value => value.name === 'disabled').args[0], true);
});
test('actual route hook keeps owner and menu identity across focus loss and StrictMode reattachment', () => {
  let focused = true, cursor = 0, refCursor = 0, layout = [], effects = [], interact, created = 0;
  const memos = [], refs = [], calls = [], current = () => true;
  const controller = { getSnapshot: () => ({ notice: null, tree: [], parents: [] }), subscribe() {}, pickerRows: () => ({ items: [], hasMore: false }),
    start: () => calls.push('start'), dispose: () => calls.push('dispose'), suspendInteraction: () => calls.push('suspend') };
  const react = { useRef: value => refs[refCursor++] ??= { current: value }, useMemo: create => memos[cursor++] ??= create(),
    useLayoutEffect: callback => layout.push(callback), useEffect: callback => effects.push(callback), useSyncExternalStore: (_subscribe, get) => get() };
  const interaction = load('admin/itemGroupsInteraction.ts');
  const hook = load('admin/useItemGroupsRoute.ts', { './itemGroupsInteraction': interaction, react, 'expo-router': { useIsFocused: () => focused },
    './itemGroupsSession': { createItemGroupsSession: (_session, _witness, _current, canInteract) => { created++; interact = canInteract; return { current, controller }; } },
    '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/localization': { adminText: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './itemGroupsModel': { itemGroupsTree: () => [], itemGroupsMerge: value => value } });
  const props = { session: {}, witness: {}, isCurrent: current };
  function render() { cursor = 0; refCursor = 0; layout = []; effects = []; const model = hook.useItemGroupsRoute(props); layout.forEach(callback => callback()); return model; }
  const first = render(); assert.equal(interact(), true); const cleanup = effects[1](); cleanup();
  focused = false; const second = render(); effects[0](); const detach = effects[1]();
  assert.equal(interact(), false); assert.equal(second.current(), true); assert.equal(first.current, second.current); assert.equal(first.t, second.t); assert.equal(created, 1);
  focused = true; render(); assert.equal(interact(), true); assert.deepEqual(calls, ['start', 'dispose', 'suspend', 'start']); detach();
});
function noticeFixture() {
  let memoCursor = 0, refCursor = 0, effects = [], layouts = [], focused = true, current = true;
  const memos = [], refs = [], notices = [];
  const state = { valid: true, treePhase: 'ready', parentsPhase: 'ready', tab: 'tree', expanded: new Set(), tree: [], parents: [], items: [],
    notice: { id: 1, key: 'item_group.saved', values: { name: 'Packing' }, success: true }, dialog: null, picker: null };
  const react = { useRef: value => refs[refCursor++] ??= { current: value },
    useMemo: (create, deps) => { const index = memoCursor++, old = memos[index];
      if (!old || deps.some((value, key) => value !== old.deps[key])) memos[index] = { deps, value: create() }; return memos[index].value; },
    useLayoutEffect: callback => layouts.push(callback), useEffect: callback => effects.push(callback), useSyncExternalStore: (_subscribe, get) => get() };
  const localization = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const hook = load('admin/useItemGroupsRoute.ts', { react, 'expo-router': { useIsFocused: () => focused },
    './itemGroupsInteraction': load('admin/itemGroupsInteraction.ts'), './itemGroupsSession': { createItemGroupsSession: () => ({ current: () => current,
      controller: { getSnapshot: () => state, subscribe() {}, pickerRows: () => ({ items: [], hasMore: false }) } }) },
    '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/localization': localization,
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './itemGroupsModel': { itemGroupsTree: () => [], itemGroupsMerge: value => value } });
  const showTopNotice = (...args) => notices.push(args), props = { session: {}, witness: {}, isCurrent: () => current, navigation: null, showTopNotice };
  return { state, notices, props, setCurrent: value => { current = value; }, setFocused: value => { focused = value; },
    render(overrides = {}) { memoCursor = 0; refCursor = 0; effects = []; layouts = []; const model = hook.useItemGroupsRoute({ ...props, ...overrides });
      layouts.forEach(callback => callback()); effects.at(-1)(); return model; } };
}
test('actual hook dispatches each source success once per captured owner, preserves blur, and guards retired sessions', () => {
  const f = noticeFixture(); f.render(); f.render();
  f.render({ showTopNotice: (...args) => f.notices.push(args) });
  assert.deepEqual(f.notices, [['Item group added: Packing', 'success']]);
  f.state.notice = { id: 2, key: 'item_group.parent_updated', values: { name: 'Packing' }, success: true };
  f.setFocused(false); f.render(); assert.deepEqual(f.notices.at(-1), ['Parent updated for Packing', 'success']);
  f.setCurrent(false); f.state.notice = { ...f.state.notice, id: 3 }; f.render(); assert.equal(f.notices.length, 2);
  f.setCurrent(true); f.state.notice = { ...f.state.notice, id: 2, key: 'item_group.saved' };
  f.render({ session: {} }); assert.equal(f.notices.length, 3);
  f.state.notice = { id: 4, key: 'item_group.parent_update_failed', values: { error: 'Offline' }, success: false };
  f.render(); assert.equal(f.notices.length, 3);
});
for (const platform of ['android', 'ios']) test(`${platform} native route uses the genuine global success host and retains the legacy fallback`, () => {
  const f = noticeFixture(); let model = f.render(); const topNotice = { type: 'OriginalTopNotice', props: {} }, snackbars = [];
  const mocks = { '../components/useBaseTheme': { useBaseTheme: () => ({ colors: {}, mode: 'light' }) },
    './AdminTopBar.android': { AdminScreenHeader: 'AdminScreenHeader' }, './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' },
    react: { useMemo: create => create(), useRef: () => ({ current: { setPage() {}, showSnackbar: message => snackbars.push(message) } }), useEffect: callback => callback() },
    'react-native': { ...rn, RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', PlatformColor: value => value, useWindowDimensions: () => ({ height: 800, width: 400 }) },
    '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifier,
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/ordersWorkspaceTypes': { ORDERS_TAB_BAR_HEIGHT: 48 }, './AdminTypography.android': { AdminText: 'Text' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) }, './useItemGroupsRoute': { useItemGroupsRoute: () => model },
    '../shared/localization': { localizedGetter: key => key }, './itemGroupsModel': { itemGroupsVisibleTree: () => [] } };
  const Route = load(`admin/ItemGroupsRoute.${platform}.tsx`, mocks).ItemGroupsRoute;
  const composed = Route({ ...f.props, topNotice });
  assert.deepEqual(f.notices, [['Item group added: Packing', 'success']]);
  assert.equal(nodes(composed, node => node === topNotice).length, 1); assert.equal(nodes(composed, node => node.props?.accessibilityRole === 'alert').length, 0);
  const fallback = Route({ ...f.props, showTopNotice: undefined });
  const local = nodes(fallback, node => node.props?.accessibilityRole === 'alert'); assert.equal(local.length, 1);
  assert.equal(nodes(local[0], node => node.type === 'Text')[0].props.children, 'Item group added: Packing');
  f.state.notice = { id: 2, key: 'item_group.parent_update_failed', values: { error: 'Offline' }, success: false }; model = f.render();
  const failed = Route(f.props); assert.equal(f.notices.length, 1);
  if (platform === 'ios') assert.equal(nodes(failed, node => node.props?.accessibilityRole === 'alert').length, 1);
  else assert.deepEqual(snackbars, [{ message: 'Could not update the parent: Offline', duration: 'short' }]);
});
for (const platform of ['android', 'ios']) test(`${platform} picker resolves the captured selection only after native dismissal, and outside cancellation returns null`, async () => {
  const finished = [], closed = [], hide = {}; hide.promise = new Promise(resolve => { hide.resolve = resolve; });
  const model = { state: { picker: { id: 23, title: 'Title', hint: 'Hint', query: '' } }, pickerRows: { items: ['A', 'B'], hasMore: false }, t: key => key,
    controller: { finishPicker: (...args) => finished.push(args) } };
  const refs = [], react = { useRef: value => { const ref = { current: value }; refs.push(ref); return ref; }, useContext: () => () => closed.push(true) };
  const Sheet = load(`admin/ItemGroupsPickerSheet.${platform}.tsx`, { react,
    [`../components/WorkerOrderSheet.${platform}`]: { WorkerOrderSheet: 'Sheet' }, '../components/workerSheetContext': { WorkerSheetCloseContext: {} },
    [`../shared/orders/PickerSheetContent.${platform}`]: { PickerSheetContent: 'Content' } }).ItemGroupsPickerSheet;
  const tree = Sheet({ model });
  if (platform === 'android') refs[0].current = { hide: () => { closed.push(true); return hide.promise; } };
  const content = platform === 'android' ? tree.props.children : tree.props.children.type(tree.props.children.props);
  content.props.items[0].select(); content.props.items[1].select(); assert.deepEqual(finished, []); assert.ok(closed.length);
  if (platform === 'android') { hide.resolve(); await hide.promise; await Promise.resolve(); }
  else tree.props.onClose();
  tree.props.onClose(); assert.deepEqual(finished, [[23, 'A']]);
  const cancelled = Sheet({ model }); cancelled.props.onClose(); cancelled.props.onClose(); assert.deepEqual(finished, [[23, 'A'], [23, null]]);
});
