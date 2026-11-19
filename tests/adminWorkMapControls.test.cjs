/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
const modifiers = new Proxy({}, { get: (_target, name) => value => ({ name, value }) });
const dart = load('admin/dartJsonString.ts', {});
const order = load('admin/adminApparatusFilterOrderStore.ts', { './dartJsonString': dart });
const catalog = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id.toUpperCase() }));
const key = order.apparatusFilterOrderKey('ADMIN-A');
const flush = () => new Promise(resolve => setImmediate(resolve));

function storage(initial) {
  const data = new Map(initial), writes = [];
  const preferences = {
    async getItem(id) { return data.get(id) ?? null; },
    async setItem(id, value) { writes.push(['set', id]); data.set(id, value); },
    async removeItem(id) { writes.push(['remove', id]); data.delete(id); },
  };
  return { data, writes, preferences };
}

function androidControls(react, colors, preferences = {}, sheet = {}) {
  return load('admin/AdminWorkMapControls.android.tsx', {
    react, 'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    'expo-router': { useIsFocused: () => true }, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '../appPreferences': { appPreferences: preferences }, '../brigader/BrigaderSequenceList': { BrigaderSequenceList: 'SequenceList' },
    '../components/BaseHost.android': { BaseHost: 'Host' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../nativeSheet': { useNativeSheet: () => sheet }, '../shared/filters/DropdownFilter.android': { DropdownFilter: 'WorkerDropdown' },
    '../shared/localization': { adminText: id => id, localizedGetter: id => id, productionText: id => id.split('.').at(-1) },
    './AdminTypography.android': { AdminText: 'NativeText' }, './adminApparatusFilterOrderStore': order, './dartJsonString': dart,
  });
}

function setupSequence(initialOrder, profileRef = 'ADMIN-A') {
  const { data, writes, preferences } = storage(initialOrder ? [[key, JSON.stringify(initialOrder)]] : []);
  let owner, cleanup, ref, draft, opened, closing = false, current = true;
  const sheet = {
    isOpen: () => !!opened,
    open(content, options) { assert.equal(opened, undefined); opened = { content, options }; draft = undefined; },
    close() { assert.ok(opened); closing = true; },
  };
  const react = {
    useMemo: (callback, deps) => typeof deps[0] === 'string' ? owner ??= callback() : callback(),
    useRef: value => ref ??= { current: value }, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useEffect: effect => { cleanup ??= effect(); }, useLayoutEffect: effect => effect(),
    useState: initial => [draft ??= initial, update => { draft = update(draft); }],
  };
  const exports = androidControls(react, {}, preferences, sheet), selections = [], errors = [];
  const props = { catalog, selected: catalog[1], locale: 'uz', profileRef, isCurrent: () => current,
    onApparatus: value => selections.push(value), onError: error => errors.push(error) };
  const dropdown = () => {
    const component = exports.AdminWorkMapSequenceFilter(props);
    return nodes(component.type(component.props)).find(node => node.type === 'WorkerDropdown').props;
  };
  const openMenu = (id = 'b') => dropdown().options.find(option => option.value === id).onLongPress();
  const menu = () => nodes(opened?.content);
  const editor = () => nodes(opened.content.type(opened.content.props));
  const press = (tree, label) => tree.find(node => node.type === 'Button' && node.props.label === label).props.onPress();
  const dismiss = () => { const { options } = opened; opened = undefined; closing = false; options.onDismiss(); };
  return { data, writes, props, selections, errors, dropdown, openMenu, menu, editor, press, dismiss,
    isOpen: sheet.isOpen, closing: () => closing, retire: () => { current = false; cleanup?.(); } };
}
test('iOS controls retain the selected apparatus and source tab labels', () => {
  const calls = [];
  const native = { Button: 'Button', HStack: 'HStack', Picker: 'Picker', Text: 'NativeText', VStack: 'VStack' };
  const exports = load('admin/AdminWorkMapControls.ios.tsx', {
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  });
  const a = { id: 'a', name: 'Pechat' }, b = { id: 'b', name: 'Rezka' };
  const props = { module: 'sequence', catalog: [a, b], selected: b, expanded: true,
    onModule: id => calls.push(['module', id]), onApparatus: id => calls.push(['apparatus', id]), onToggle: () => calls.push('toggle'),
    apparatusLabel: 'Apparat', unselectedLabel: 'Tanlanmagan', countText: '7 ta buyurtma' };
  const modules = nodes(exports.AdminWorkMapModules(props));
  assert.deepEqual(modules.filter(node => node.type === 'NativeText').map(node => node.props.children), ['Ketma-ketlik', 'Buyurtmalar', 'Ko‘chirish', 'Yopilgan', 'Tekshiruv']);
  modules[0].props.onSelectionChange('orders');
  const filter = nodes(exports.AdminWorkMapApparatusFilter(props));
  filter.find(node => node.type === 'Button' && node.props.label === 'Pechat').props.onPress();
  assert.ok(filter.find(node => node.type === 'Button' && node.props.label === 'Rezka').props.modifiers.some(m => m.name === 'accessibilityAddTraits'));
  filter.find(node => node.type === 'Button' && !node.props.label).props.onPress();
  modules[0].props.onSelectionChange('closed'); modules[0].props.onSelectionChange('move');
  assert.deepEqual(calls, [['module', 'orders'], ['apparatus', 'a'], 'toggle', ['module', 'closed'], ['module', 'move']]);
  assert.ok(filter.some(node => node.type === 'NativeText' && node.props.children === props.countText));
  const collapsed = nodes(exports.AdminWorkMapApparatusFilter({ ...props, expanded: false }));
  assert.equal(collapsed.some(node => node.props.label === 'Pechat'), false);
});

test('Android sequence uses the same dropdown as Worker with the original IDs and selected label', () => {
  const chosen = [], colors = { surface: 'device surface', onSurfaceVariant: 'device content' };
  const { AdminWorkMapApparatusFilter: Filter } = androidControls({ useMemo: callback => callback() }, colors);
  const b = { id: 'b', name: ' Rezka ' }, props = { catalog: [{ id: 'a', name: 'Pechat' }, b], selected: b,
    apparatusLabel: 'Apparat', unselectedLabel: 'Tanlanmagan', countText: '7 ta buyurtma', onApparatus: id => chosen.push(id) };
  const rendered = nodes(Filter(props)), dropdown = rendered.find(node => node.type === 'WorkerDropdown');
  assert.equal(dropdown.props.selectedLabel, 'Rezka');
  assert.deepEqual(dropdown.props.options, [{ value: 'a', label: 'Pechat' }, { value: 'b', label: 'Rezka' }]);
  assert.equal(dropdown.props.backgroundColor, colors.surface); assert.equal(dropdown.props.enabled, true);
  dropdown.props.onChange('a'); assert.deepEqual(chosen, ['a']);
  assert.ok(rendered.some(node => node.type === 'NativeText' && node.props.children === '7 ta buyurtma'));
  const empty = nodes(Filter({ ...props, catalog: [], selected: null, countText: '' })).find(node => node.type === 'WorkerDropdown');
  assert.equal(empty.props.selectedLabel, 'Tanlanmagan'); assert.equal(empty.props.enabled, false);
});

// @v2-test test/admin_apparatus_filter_order_test.dart
test('display order normalizes stored IDs, preserves renamed rows and isolates and resets preferences', async () => {
  const { data, preferences } = storage([[key, '[" c ","","c","a"]']]);
  const owner = new order.AdminApparatusFilterOrder(' ADMIN-A ', preferences, () => true);
  const other = new order.AdminApparatusFilterOrder('ADMIN-B', preferences, () => true);
  await Promise.all([owner.start(), other.start()]);
  const saved = owner.getSnapshot().savedIds, renamed = { id: 'c', name: 'Renamed C' }, refreshed = [catalog[0], renamed, catalog[3]];
  assert.deepEqual(saved, ['c', 'a']); assert.deepEqual(other.getSnapshot().savedIds, []);
  const sorted = order.applyApparatusFilterOrder(refreshed, [...saved, 'removed', 'c']);
  assert.deepEqual(sorted, [renamed, catalog[0], catalog[3]]); assert.equal(sorted[0], renamed);
  assert.equal(refreshed[0], catalog[0]); assert.deepEqual(saved, ['c', 'a']);
  await owner.save(owner.begin(), null, catalog);
  assert.equal(data.has(key), false); assert.deepEqual(owner.getSnapshot().savedIds, []);
  assert.throws(() => order.apparatusFilterOrderKey(' '), /Profile reference/);
});

test('Worker dropdown long press opens the actions and reset keeps the apparatus selected', async () => {
  const flow = setupSequence(['c', 'a', 'b']); flow.dropdown(); await flush();
  const ids = () => flow.dropdown().options.map(option => option.value);
  assert.deepEqual(ids(), ['c', 'a', 'b', 'd', 'e']);
  flow.openMenu('c');
  assert.deepEqual(flow.menu().filter(node => node.type === 'Button').map(node => node.props.label), ['edit', 'reset']);
  flow.press(flow.menu(), 'reset'); assert.equal(flow.closing(), true); assert.deepEqual(flow.writes, []);
  flow.dismiss(); await flush();
  assert.deepEqual(ids(), ['a', 'b', 'c', 'd', 'e']); assert.equal(flow.dropdown().selectedLabel, 'B');
  assert.deepEqual(flow.selections, []); assert.deepEqual(flow.writes, [['remove', key]]);
  flow.dropdown().onChange('c'); assert.deepEqual(flow.selections, ['c']);
});

test('shared sequence drag saves after dismissal and reconciles changes in the catalog', async () => {
  const flow = setupSequence(); flow.dropdown(); await flush();
  flow.openMenu(); flow.press(flow.menu(), 'edit'); flow.dismiss();
  const sequence = () => flow.editor().find(node => node.type === 'SequenceList').props;
  const ids = () => sequence().rows.map(sequence().rowKey);
  sequence().onReorder(4, 2); assert.deepEqual(ids(), ['a', 'b', 'e', 'c', 'd']);
  sequence().onReorder(0, 3); assert.deepEqual(ids(), ['b', 'e', 'c', 'a', 'd']);
  const renamed = { id: 'c', name: 'Renamed C' };
  flow.props.catalog = [{ id: 'f', name: 'F' }, renamed, catalog[0], catalog[1], catalog[4]]; flow.dropdown();
  assert.equal(flow.data.has(key), false);
  flow.press(flow.editor(), 'save'); assert.equal(flow.closing(), true); assert.equal(flow.data.has(key), false);
  flow.dismiss(); await flush();
  assert.deepEqual(JSON.parse(flow.data.get(key)), ['b', 'e', 'c', 'a', 'f']);
  assert.deepEqual(flow.dropdown().options.map(option => option.label), ['B', 'E', 'Renamed C', 'A', 'F']);
  assert.equal(flow.dropdown().selectedLabel, 'B'); assert.deepEqual(flow.selections, []);
  const remount = setupSequence(JSON.parse(flow.data.get(key)));
  remount.props.catalog = flow.props.catalog; remount.dropdown(); await flush();
  assert.deepEqual(remount.dropdown().options.map(option => option.value), ['b', 'e', 'c', 'a', 'f']);
});

test('cancel keeps storage and retiring an account rejects saved and menu callbacks', async () => {
  const flow = setupSequence(['b', 'a']); flow.dropdown(); await flush();
  flow.openMenu(); flow.press(flow.menu(), 'edit'); flow.dismiss();
  flow.editor().find(node => node.type === 'SequenceList').props.onReorder(0, 1);
  flow.press(flow.editor(), 'action.cancel'); flow.dismiss();
  assert.deepEqual(JSON.parse(flow.data.get(key)), ['b', 'a']); assert.deepEqual(flow.writes, []);
  flow.openMenu(); flow.press(flow.menu(), 'edit'); flow.dismiss();
  flow.press(flow.editor(), 'save'); flow.retire(); flow.dismiss(); await flush();
  assert.deepEqual(flow.writes, []); assert.deepEqual(flow.errors, []);
  const menu = setupSequence(); menu.dropdown(); await flush();
  menu.openMenu(); menu.press(menu.menu(), 'edit'); menu.retire(); menu.dismiss(); assert.equal(menu.isOpen(), false);
  const readOnly = setupSequence(undefined, ''); readOnly.dropdown(); await flush();
  assert.ok(readOnly.dropdown().options.every(option => option.onLongPress === undefined));
});

test('Android Move selects the exact native-sheet ticket item through the shared picker', () => {
  const { AdminWorkMapMovePicker: Picker } = load('admin/AdminWorkMapMovePicker.android.tsx', {
    '../shared/orders/PickerSheetContent': { PickerSheetContent: 'WorkerPicker' },
  });
  const selection = { id: 'station-a' }, selected = [], closed = [];
  const sheet = Picker({ title: 'Apparat', closeLabel: 'Yopish', rows: [{ key: 'a', name: 'Station A', selected: true, selection }],
    onChoose: value => selected.push(value), onClose: () => closed.push(true) });
  assert.equal(sheet.type, 'WorkerPicker'); assert.equal(sheet.props.searchEnabled, false);
  assert.equal(sheet.props.items[0].selected, true);
  sheet.props.items[0].select(); sheet.props.onClose();
  assert.deepEqual(selected, [selection]); assert.deepEqual(closed, [true]);
});
