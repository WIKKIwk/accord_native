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
  const { AdminWorkMapApparatusFilter: Filter } = load('admin/AdminWorkMapControls.android.tsx', {
    react: { useMemo: callback => callback() }, 'react-native': { View: 'View' },
    '@expo/ui/jetpack-compose/modifiers': modifiers, '../components/BaseHost.android': { BaseHost: 'Host' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'WorkerDropdown' },
    './AdminTypography.android': { AdminText: 'NativeText' },
  });
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
