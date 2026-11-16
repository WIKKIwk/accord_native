/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { load, l10n } = require('./adminUsersSupport.cjs');
const presentation = load('admin/adminWarehouseSettingsPresentation', { '../shared/localization': l10n });
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const slots = ['children', 'anchor', 'header'];
function render(node) {
  if (Array.isArray(node)) return node.map(render); if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, ...Object.fromEntries(slots.map(key => [key, render(node.props?.[key])])) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate)); if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...slots.flatMap(key => nodes(node.props?.[key], predicate))];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? slots.map(key => text(node.props?.[key])).filter(Boolean).join(' ') : '';
}
const byID = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
function fixture(platform, { current = true, selected = true, loading = false, busy = false, dialogKind = null, picker = false, locale = 'uz' } = {}) {
  const calls = [], summary = { warehouse: 'A', product_count: 5, reserved_count: dialogKind === 'blocked' ? 3 : 0, assignment_count: 2 },
    row = { warehouse: 'A', principal_role: 'werka', principal_ref: 'ref', display_name: ' Person ' }, user = { name: 'Other', id: 'other', kind: 'werka' };
  const dialog = dialogKind === 'unassign' ? { kind: dialogKind, id: 11, assignment: row, displayName: 'Person', warehouse: 'A' } : dialogKind ? { kind: dialogKind, id: 11, summary } : null;
  const state = { warehouse: selected ? 'A' : '', summaries: [summary, { ...summary, warehouse: 'B' }], assignments: [row], assignmentsLoading: loading,
    assigning: busy, removingKey: busy ? 'other' : null, deleting: busy, dialog, picker: picker ? { id: 13, query: '', users: [user] } : null, notice: null };
  const value = { state, summary: selected ? summary : null, current, users: [user], notice: null, dialogText: dialog ? presentation.adminWarehouseSettingsDialogText(dialog, locale) : null,
    a: (key, values) => l10n.adminText(key, locale, values), t: key => l10n.localizedGetter(key, locale), toggleFilter: () => calls.push('filter'), selectWarehouse: name => calls.push(['warehouse', name]),
    assign: () => calls.push('assign'), unassign: assignment => calls.push(['unassign', assignment]), deleteWarehouse: () => calls.push('delete'), confirm: id => calls.push(['confirm', id]), dismiss: id => calls.push(['dismiss', id]),
    search: (...args) => calls.push(['search', ...args]), select: (...args) => calls.push(['select', ...args]), dismissPicker: id => calls.push(['dismiss-picker', id]) };
  const native = (name, names) => { const component = props => ({ type: name, props }); names.forEach(slot => { component[slot] = `${name}.${slot}`; }); return component; };
  const ui = new Proxy({ Shape: { RoundedCorner: shape => shape }, useNativeState: initial => ({ get: () => initial, set() {} }),
    useMaterialColors: () => new Proxy({}, { get: (_obj, key) => String(key) }), FilterChip: native('FilterChip', ['LeadingIcon', 'TrailingIcon', 'Label']),
    ListItem: native('ListItem', ['LeadingContent', 'HeadlineContent', 'SupportingContent', 'TrailingContent']), AlertDialog: native('AlertDialog', ['Title', 'Text', 'Icon', 'ConfirmButton']),
    OutlinedTextField: native('OutlinedTextField', ['Placeholder', 'LeadingIcon']) }, { get: (obj, key) => Object.hasOwn(obj, key) ? obj[key] : String(key) });
  const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: String(key), args }) });
  const mocks = { react: { useEffect() {}, useRef: initial => ({ current: initial }) }, 'expo-symbols': { SymbolView: 'SymbolView' }, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { error: 'error', surfaceContainerHigh: 'surface' } }) },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, './adminUsersModel': { adminUserPrincipalRoleFromJson: role => role, adminUserRoleLabel: () => 'Werka' }, './adminWarehouseSettingsController': {
      adminWarehouseSettingsAssignmentKey: assignment => `${assignment.warehouse.toLowerCase()}-${assignment.principal_role}-${assignment.principal_ref.toLowerCase()}`, adminWarehouseSettingsRoleLabel: () => 'Werka' },
    './dartJsonString': { dartTrim: value => value.trim() }, './useAdminWarehouseSettings': { useAdminWarehouseSettings: () => value } };
  const filename = path.resolve(__dirname, `../src/admin/AdminWarehouseSettingsTab.${platform}.tsx`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { tree: render(mod.exports.AdminWarehouseSettingsTab({ bottomPadding: 128, filterExpanded: true })), calls, row, user, value };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} native settings shows source counts and genuine filter/assign/unassign/delete actions in every locale`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const f = fixture(platform, { locale }); assert.ok(text(f.tree).includes(l10n.adminText('warehouse.summary', locale))); assert.ok(text(f.tree).includes('5'));
      assert.ok(text(f.tree).includes(' Person ')); assert.ok(text(f.tree).includes('Werka'));
      byID(f.tree, 'warehouse-settings-filter').props[platform === 'android' ? 'onClick' : 'onPress']();
      byID(f.tree, 'warehouse-settings-assign').props[platform === 'android' ? 'onClick' : 'onPress']();
      byID(f.tree, 'warehouse-settings-delete').props[platform === 'android' ? 'onClick' : 'onPress']();
      byID(f.tree, 'warehouse-settings-unassign-a-werka-ref').props[platform === 'android' ? 'onClick' : 'onPress']();
      assert.deepEqual(f.calls, ['filter', 'assign', 'delete', ['unassign', f.row]]);
    }
  });
  test(`${platform} source busy state disables independently and no-selection omits all mutation controls`, () => {
    const f = fixture(platform, { busy: true }), button = byID(f.tree, 'warehouse-settings-assign');
    if (platform === 'android') { assert.equal(button.props.enabled, false); assert.ok(button.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56)); }
    else assert.ok(button.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0]));
    assert.equal(byID(fixture(platform, { selected: false }).tree, 'warehouse-settings-delete'), undefined);
    assert.equal(fixture(platform, { current: false }).tree, null);
    assert.equal(nodes(fixture(platform, { loading: true }).tree, node => node.type === (platform === 'android' ? 'CircularProgressIndicator' : 'ProgressView')).length, 1);
  });
  for (const kind of ['unassign', 'delete', 'blocked']) test(`${platform} ${kind} dialog keeps exact labels, warnings, confirmation and dismiss ticket`, () => {
    const f = fixture(platform, { dialogKind: kind }), labels = f.value.dialogText;
    assert.ok(text(f.tree).includes(labels.title)); assert.ok(text(f.tree).includes(labels.body)); if (labels.warning) assert.ok(text(f.tree).includes(labels.warning));
    const confirm = byID(f.tree, 'warehouse-settings-confirm'); confirm.props[platform === 'android' ? 'onClick' : 'onPress']();
    if (platform === 'android') nodes(f.tree, node => node.type === (kind === 'unassign' ? 'BasicAlertDialog' : 'AlertDialog'))[0].props.onDismissRequest();
    else nodes(f.tree, node => node.type === 'Modal')[0].props.onRequestClose();
    assert.deepEqual(f.calls, [['confirm', 11], ['dismiss', 11]]);
    if (kind === 'delete') {
      const actions = nodes(f.tree, node => ['Button', 'OutlinedButton'].includes(node.type));
      const cancelIndex = actions.findIndex(node => text(node).includes(labels.cancel) || node.props.label === labels.cancel);
      const confirmIndex = actions.findIndex(node => node === confirm); assert.ok(cancelIndex >= 0 && confirmIndex > cancelIndex);
    }
  });
  test(`${platform} picker native search/select/dismiss preserve the issued ticket`, async () => {
    const f = fixture(platform, { picker: true }), input = byID(f.tree, 'warehouse-settings-assignee-search'); input.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('find');
    const item = nodes(f.tree, node => node.type === (platform === 'android' ? 'Surface' : 'Button') && text(node).includes('Other'))[0]; item.props[platform === 'android' ? 'onClick' : 'onPress']();
    await new Promise(resolve => setImmediate(resolve));
    if (platform === 'android') nodes(f.tree, node => node.type === 'ModalBottomSheet')[0].props.onDismissRequest(); else nodes(f.tree, node => node.type === 'BottomSheet')[0].props.onIsPresentedChange(false);
    assert.deepEqual(f.calls, [['search', 13, 'find'], ['select', 13, f.user], ['dismiss-picker', 13]]);
  });
}
