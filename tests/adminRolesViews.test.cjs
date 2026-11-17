/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { load, l10n, strings } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const modifiers = new Proxy({ Animation: { easeOut: value => value } }, { get: (target, name) => target[name] ?? ((...args) => ({ name: String(name), args })) });
const compounds = new Set();
function compound(name, slots) { const value = Object.assign(function NativeCompound() {}, Object.fromEntries(slots.map(slot => [slot, `${name}.${slot}`]))); compounds.add(value); return value; }
const native = new Proxy({ TopAppBar: compound('TopAppBar', ['NavigationIcon', 'Title', 'Actions']), LazyColumn: compound('LazyColumn', ['Items']), TabView: compound('TabView', ['Tab']),
  Shape: { RoundedCorner: value => value }, useNativeState: value => ({ get: () => value, set() {} }) }, { get: (target, name) => target[name] ?? String(name) });
const rolesModel = load('admin/adminRolesModel', { '../rezka/rezkaWorkerController': { apparatusLabels: () => [] }, '../shared/localization': l10n,
  './adminCustomerApparatusModel': { adminCustomerApparatusAssignment: (rows, ref) => rows.find(row => row.principal_ref === ref && ['customer', 'aparatchi'].includes(row.principal_role)) ?? null }, './dartJsonString': strings });
const role = (id, system = false, capability_codes = []) => ({ id, label: id, system, capability_codes, base_role: null });
function expand(tree) {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!tree || typeof tree !== 'object') return tree;
  if (typeof tree.type === 'function' && !compounds.has(tree.type)) return expand(tree.type(tree.props));
  if (tree.type === 'LazyColumn.Items') return { ...tree, props: { ...tree.props, children: tree.props.data.map((item, index) => expand(tree.props.children({ item, index }))) } };
  return { ...tree, props: { ...tree.props, children: expand(tree.props?.children) } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function id(node, value) { return node.props?.modifiers?.some(item => ['testID', 'accessibilityIdentifier'].includes(item.name) && item.args[0] === value); }
function render(platform, options = {}) {
  const calls = [], capabilities = [{ code: 'catalog.item.read', label: 'Catalog', default_roles: [] }], roles = [role('admin', true), role('custom', false, ['catalog.item.read']), role('aparatchi', true, ['apparatus.queue.read'])];
  const data = { roles, capabilities, assignments: [], settings: { werka_name: 'Warehouse' }, suppliers: [{ ref: 'supplier', name: 'Supplier' }], customers: [{ ref: 'customer', name: 'Customer' }], apparatus: options.apparatus ?? [{ id: 'apparatus:print:a', name: 'Press' }] };
  const base = { valid: true, loading: false, refreshing: false, data, tab: 0, expandedRoleId: 'custom', notice: null, sheet: null };
  const sheet = options.editor ? { id: 9, kind: 'editor', data, closing: false, pending: null, label: '', capabilities: [], role: null } : options.assignment ? {
    id: 9, kind: 'assignment', data, closing: options.closing ?? false, pending: null, principal: { role: 'customer', ref: 'customer', name: 'Customer', icon: 'person' }, selected: options.selected ?? [] } : null;
  const state = { ...base, sheet, ...options.state }, controller = new Proxy({ getSnapshot: () => state, subscribe() {} }, { get: (target, name) => target[name] ?? ((...args) => calls.push([String(name), ...args])) });
  const react = { useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect() {}, useSyncExternalStore: (_subscribe, get) => get() };
  const hook = load('admin/useAdminRoles', { react, '../auth': { subscribeSessionWitness() {} }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } }, './dartJsonString': strings,
    './adminRolesSession': { adminRolesSession: () => ({ current: () => options.current !== false, controller }) }, './adminRolesModel': rolesModel });
  const props = { session: {}, witness: {}, isCurrent: () => true, showTopNotice() {}, navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') },
    profileAction: { type: 'RealProfile', props: {} }, footer: { type: 'RealDock', props: {} }, topNotice: { type: 'RealTopNotice', props: {} } };
  const model = hook.useAdminRoles(props);
  const mocks = { react, 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': native, '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: {} }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' },
    './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminOutlinedTextField: compound('OutlinedTextField', ['Label']) }, './useAdminRoles': { useAdminRoles: () => model } };
  const filename = path.resolve(__dirname, `../src/admin/AdminRolesScreen.${platform}.tsx`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return { tree: expand(mod.exports.AdminRolesScreen(props)), calls, model, state, data };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Roles preserves ordered rows, source one-role expansion and custom-only editing`, () => {
    const { tree, calls } = render(platform);
    assert.equal(nodes(tree, node => id(node, 'admin-role-card-admin')).length, 1);
    assert.equal(nodes(tree, node => id(node, 'admin-role-edit-admin')).length, 0);
    const edit = nodes(tree, node => id(node, 'admin-role-edit-custom'))[0]; (edit.props.onClick ?? edit.props.onPress)(); assert.equal(calls[0][0], 'openEditor');
    const details = nodes(tree, node => id(node, 'admin-role-details-custom'))[0]; (details.props.onClick ?? details.props.onPress)(); assert.deepEqual(calls[1], ['expand', 'custom']);
    assert.ok(nodes(tree, node => node.type === 'Text' && node.props.children === 'Catalog item read').length > 0);
    const create = nodes(tree, node => id(node, 'admin-role-create'))[0]; (create.props.onClick ?? create.props.onPress)(); assert.deepEqual(calls[2], ['openEditor']);
  });
  test(`${platform} Roles keeps genuine notice and dock outside its body and suppresses retired screens`, () => {
    const { tree } = render(platform), body = nodes(tree, node => node.type === 'AdminShellBodyFrame')[0];
    assert.equal(nodes(body, node => node.type === 'RealDock' || node.type === 'RealTopNotice').length, 0);
    assert.equal(nodes(tree, node => node.type === 'RealDock').length, 1); assert.equal(nodes(tree, node => node.type === 'RealTopNotice').length, 1);
    assert.equal(render(platform, { current: false }).tree, null);
  });
  test(`${platform} role editor keeps checkbox labels/codes, disabled empty save and sheet-result callback`, () => {
    const { tree, calls } = render(platform, { editor: true });
    const save = nodes(tree, node => id(node, 'admin-role-save-action'))[0];
    if (platform === 'android') assert.equal(save.props.enabled, false);
    else assert.deepEqual(save.props.modifiers.find(m => m.name === 'disabled').args, [true]);
    const capability = nodes(tree, node => id(node, 'admin-role-capability-catalog.item.read'))[0];
    (capability.props.onCheckedChange ?? capability.props.onIsOnChange)(true); assert.deepEqual(calls[0], ['toggleCapability', 9, 'catalog.item.read', true]);
    const sheet = nodes(tree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet'))[0];
    (sheet.props.onDismissRequest ?? sheet.props.onDismiss)(); assert.deepEqual(calls[1], ['nativeDismiss', 9]);
  });
  test(`${platform} assignment sheet preserves system eligibility and actual apparatus selection`, () => {
    const { tree, calls } = render(platform, { assignment: true });
    const admin = nodes(tree, node => id(node, 'admin-role-option-admin'))[0];
    // Source system roles with no baseRole remain assignable, even the Admin-id fixture.
    if (platform === 'android') assert.equal(admin.props.enabled, true);
    else assert.deepEqual(admin.props.modifiers.find(m => m.name === 'disabled').args, [false]);
    if (platform === 'android') nodes(tree, node => id(node, 'admin-role-apparatus-row-0'))[0].props.modifiers.find(m => m.name === 'toggleable').args[1]();
    else nodes(tree, node => id(node, 'admin-role-apparatus-0'))[0].props.onIsOnChange(true);
    assert.deepEqual(calls[0], ['toggleApparatus', 9, 'apparatus:print:a', true]);
    const save = nodes(tree, node => id(node, 'admin-role-apparatus-save-aparatchi'))[0]; (save.props.onClick ?? save.props.onPress)(); assert.equal(calls[1][0], 'assign'); assert.equal(calls[1][1], 9);
  });
}
test('Android apparatus row/name and checkbox share one native checkbox target, preserving selected and disabled semantics', () => {
  for (const selected of [false, true]) {
    const { tree, calls } = render('android', { assignment: true, selected: selected ? ['apparatus:print:a'] : [] });
    const row = nodes(tree, node => id(node, 'admin-role-apparatus-row-0'))[0], checkbox = nodes(row, node => id(node, 'admin-role-apparatus-0'))[0];
    const toggle = row.props.modifiers.find(m => m.name === 'toggleable');
    assert.equal(toggle.args[0], selected); assert.deepEqual(toggle.args[2], { role: 'checkbox', enabled: true });
    assert.equal(nodes(row, node => node.type === 'Text' && node.props.children === 'Press').length, 1);
    assert.equal(checkbox.props.value, selected); assert.equal(checkbox.props.onCheckedChange, undefined, 'passive checkbox cannot double-toggle the row event');
    // Both label and checkbox hit paths belong to this one ancestor native handler.
    for (const hit of ['label', 'checkbox']) {
      calls.length = 0; toggle.args[1](); assert.deepEqual(calls, [['toggleApparatus', 9, 'apparatus:print:a', !selected]], hit);
    }
  }
  for (const options of [{ closing: true }, { apparatus: [{ id: '', name: 'Legacy missing ID' }] }]) {
    const { tree } = render('android', { assignment: true, ...options });
    const row = nodes(tree, node => id(node, 'admin-role-apparatus-row-0'))[0], checkbox = nodes(row, node => id(node, 'admin-role-apparatus-0'))[0];
    assert.equal(row.props.modifiers.find(m => m.name === 'toggleable').args[2].enabled, false);
    assert.equal(checkbox.props.enabled, false);
  }
});
