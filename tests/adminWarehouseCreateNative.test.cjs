/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const slots = ['children', 'anchor'];
function render(node) {
  if (Array.isArray(node)) return node.map(render);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, ...Object.fromEntries(slots.map(key => [key, render(node.props?.[key])])) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...slots.flatMap(key => nodes(node.props?.[key], predicate))];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? slots.map(key => text(node.props?.[key])).filter(Boolean).join(' ') : '';
}
const byID = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
function fixture(platform, { saving = false, picker = false, selected = false, loadingUsers = false, current = true, empty = false, locale = 'uz', hide } = {}) {
  const calls = [], user = { id: 'id', name: 'Person', kind: 'werka' };
  const state = { phase: 'content', name: 'Storage', fillVersion: 0, saving, selected: selected ? user : null, loadingUsers, notice: null,
    picker: picker ? { id: 7, users: [user], query: '' } : null };
  const value = { state, current, users: empty ? [] : [user], a: key => l10n.adminText(key, locale), t: key => l10n.localizedGetter(key, locale), save: () => calls.push('save'),
    controller: { changeName: name => calls.push(['name', name]), openPicker: () => calls.push('open-picker'), closeButton: () => calls.push('close-button'), dismissDialog: () => calls.push('dismiss-dialog'),
      searchPicker: (...args) => calls.push(['search', ...args]), selectUser: (...args) => calls.push(['select', ...args]), dismissPicker: id => calls.push(['dismiss-picker', id]) } };
  const modifiers = new Proxy({}, { get: (_object, key) => (...args) => ({ name: String(key), args }) });
  const field = props => ({ type: 'OutlinedTextField', props }); for (const name of ['Label', 'Placeholder', 'LeadingIcon']) field[name] = `OutlinedTextField.${name}`;
  const ui = new Proxy({ useNativeState: initial => ({ get: () => initial, set() {} }), useMaterialColors: () => ({ onSurface: 'text', surface: 'surface', surfaceContainerHighest: 'row', surfaceContainerLowest: 'card', outlineVariant: 'outline' }),
    Shape: { RoundedCorner: config => config }, OutlinedTextField: field }, { get: (object, key) => Object.hasOwn(object, key) ? object[key] : String(key) });
  const mocks = { react: { useEffect() {}, useRef: initial => ({ current: initial }) }, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { absoluteFill: {}, create: value => value }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surface: 'surface', surfaceContainerLowest: 'card' } }) },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, './adminUsersModel': { adminUserRoleLabel: () => 'Werka' }, './useAdminWarehouseCreate': { useAdminWarehouseCreate: () => value } };
  if (platform === 'android' && picker) mocks['./AdminWarehouseAssigneePicker.android'] = require('./adminWarehouseItemRollsNativeSupport.cjs').nativeAssigneePicker(hide);
  else if (platform === 'android') mocks['./AdminWarehouseAssigneePicker.android'] = { AdminWarehouseAssigneePicker: 'AssigneePicker' };
  return { tree: render(load(`admin/AdminWarehouseCreateDialog.${platform}.tsx`, mocks).AdminWarehouseCreateDialog({})), calls, value, user };
}

test('Android assignee picker settles a selection once, after the original native hide', async () => {
  let finishHide;
  const pending = new Promise(resolve => { finishHide = resolve; });
  const f = fixture('android', { picker: true, hide: () => pending });
  const picker = nodes(f.tree, node => node.type === 'PickerSheetContent')[0];
  picker.props.items[0].select(); picker.props.items[0].select(); picker.props.onClose();
  assert.deepEqual(f.calls, []);
  finishHide(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls, [['select', 7, f.user]]);
});
for (const platform of ['android', 'ios']) {
  test(`${platform} create uses source texts, native name field and native assignment action in all locales`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const f = fixture(platform, { locale }), field = nodes(f.tree, node => node.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'))[0];
      assert.equal(field.props[platform === 'ios' ? 'text' : 'value'].get(), 'Storage');
      field.props[platform === 'ios' ? 'onTextChange' : 'onValueChange']('Edited'); assert.deepEqual(f.calls[0], ['name', 'Edited']);
      assert.ok(text(f.tree).includes(l10n.adminText('warehouse.create', locale)));
      assert.ok(text(f.tree).includes(l10n.adminText('warehouse.assign', locale)));
      if (platform === 'ios') field.props.modifiers.find(mod => mod.name === 'onSubmit').args[0](); else field.props.keyboardActions.onDone();
      assert.equal(f.calls.at(-1), 'save');
    }
  });
  test(`${platform} save disables only the source save/close buttons and preserves picker/name editing and outside dismiss`, () => {
    const f = fixture(platform, { saving: true, selected: true }), save = byID(f.tree, 'admin-warehouse-create-save'), select = byID(f.tree, 'admin-warehouse-create-assignee');
    if (platform === 'android') {
      assert.equal(save.props.enabled, false); assert.ok(save.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56));
      assert.deepEqual(Object.values(save.props.shape.cornerRadii), [20, 20, 20, 20]);
      const close = nodes(f.tree, node => node.type === 'IconButton')[0]; assert.equal(close.props.enabled, false);
      select.props.onClick(); nodes(f.tree, node => node.type === 'BasicAlertDialog')[0].props.onDismissRequest();
    } else {
      assert.ok(save.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0])); assert.ok(!select.props.modifiers.some(mod => mod.name === 'disabled'));
      select.props.onPress(); nodes(f.tree, node => node.type === 'Modal')[0].props.onRequestClose();
    }
    assert.deepEqual(f.calls, ['open-picker', 'dismiss-dialog']); assert.ok(text(select).includes('Person')); assert.ok(text(select).includes('Werka'));
    const field = nodes(f.tree, node => node.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'))[0]; assert.notEqual(field.props.enabled, false);
  });
  test(`${platform} assignee sheet search, select and dismiss retain original picker ticket`, async () => {
    const f = fixture(platform, { picker: true });
    if (platform === 'android') {
      const picker = nodes(f.tree, node => node.type === 'PickerSheetContent')[0];
      assert.equal(picker.props.searchTestID, 'admin-warehouse-assignee-search'); picker.props.onSearch('query');
      const sheet = nodes(f.tree, node => node.type === 'ModalBottomSheet')[0]; assert.equal(sheet.props.scrimColor, 'rgba(0,0,0,0.32)'); assert.equal(sheet.props.sheetGesturesEnabled, true);
      const [row] = picker.props.items; assert.equal(row.title, 'Person'); assert.equal(row.subtitle, 'Werka'); row.select(); await new Promise(resolve => setImmediate(resolve));
      sheet.props.onDismissRequest();
    } else {
      byID(f.tree, 'admin-warehouse-assignee-search').props.onTextChange('query');
      const row = nodes(f.tree, node => node.type === 'Button' && text(node).includes('Person'))[0]; row.props.onPress();
      const sheet = nodes(f.tree, node => node.type === 'BottomSheet')[0]; assert.equal(sheet.props.isPresented, true); sheet.props.onIsPresentedChange(false);
    }
    assert.deepEqual(f.calls[0], ['search', 7, 'query']);
    assert.deepEqual(f.calls.slice(-2), [['select', 7, f.user], ['dismiss-picker', 7]]);
  });
  test(`${platform} picker empty search text is source noRecordsYet and inactive owner renders no modal`, () => {
    const f = fixture(platform, { picker: true, empty: true }); assert.ok(text(f.tree).includes(l10n.localizedGetter('noRecordsYet', 'uz')));
    assert.equal(fixture(platform, { current: false }).tree, null);
    assert.ok(text(fixture(platform, { loadingUsers: true }).tree).includes(l10n.adminText('action.loading', 'uz')));
  });
}
