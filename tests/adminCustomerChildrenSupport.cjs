/* global __dirname */
const path = require('node:path');
const s = require('./adminCustomerDetailViewSupport.cjs');
const apparatusModel = s.load('admin/adminCustomerApparatusModel', { './dartJsonString': s.strings });
const worker = require('./adminWorkerDetailSupport.cjs');
const { AdminCustomerApparatusController } = s.load('admin/adminCustomerApparatusController', { '../shared/camera/synchronousGuard': s.strict, './adminCustomerApparatusModel': apparatusModel });
const role = patch => Object.freeze({ principal_role: 'aparatchi', principal_ref: ' dto ref ', role_id: 'aparatchi', assigned_apparatus: ['B'], assigned_item_groups: ['Keep'], ...patch });
const machine = (id, name = id) => ({ id, name });
function apparatusFixture(t, overrides = {}) {
  let valid = true, changed = 0; const calls = [];
  const deps = { isCurrent: () => valid, material: false, ref: ' dto ref ', assignments: async (guard, witness) => { guard(); calls.push('roles'); if (!witness()) throw Error('bad witness'); return [role()]; },
    apparatus: async (guard, witness) => { guard(); calls.push('apparatus'); if (!witness()) throw Error('bad witness'); return [machine('B'), machine('A'), machine('')]; },
    save: async (input, guard) => { guard(); calls.push(['save', input]); }, changed: () => { changed++; }, ...overrides };
  const controller = new AdminCustomerApparatusController(deps); t?.after(() => controller.dispose());
  return { controller, deps, calls, get changed() { return changed; }, retire: () => { valid = false; }, start: async () => { controller.start(); await s.flush(); } };
}
function apparatusHook(r, owner) {
  return s.load('admin/useAdminCustomerApparatus', { react: r.react, '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/camera/synchronousGuard': s.strict,
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './adminCustomerApparatusSession': { adminCustomerApparatusSession: () => owner } });
}
function warehouseHook(r, owner) {
  return s.load('admin/useAdminCustomerMaterialWarehouse', { react: r.react, '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/camera/synchronousGuard': s.strict,
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } },
    './adminCustomerMaterialWarehouseSession': { adminCustomerMaterialWarehouseSession: () => owner }, './adminWorkerDetailPresentation': {
      adminWorkerDetailDialogText: (dialog, locale) => ({ title: s.l10n.adminText('warehouse.unassign_title', locale), message: s.l10n.adminText('warehouse.unassign_message', locale, { warehouse: dialog.warehouse, name: dialog.name }), cancel: s.l10n.adminText('action.no', locale), confirm: s.l10n.adminText('action.yes', locale) }) } });
}
function view(platform, filename, model, hookName, hookFile, r = s.runtime()) {
  const modifier = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
  const components = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  const ui = new Proxy({ LazyColumn: components('LazyColumn', { Items: 'LazyColumn.Items' }), List: components('List', { ForEach: 'List.ForEach' }),
    InputChip: components('InputChip', { Avatar: 'InputChip.Avatar', Label: 'InputChip.Label', TrailingIcon: 'InputChip.TrailingIcon' }) }, { get: (target, name) => target[name] ?? String(name) });
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifier,
    'react-native': { View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 844 }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminBasicTextField: ui.BasicTextField, AdminOutlinedTextField: ui.OutlinedTextField }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: s.colors }) },
    [`./${hookFile}`]: { [hookName]: () => model }, [`./AdminCustomerDetailNative.${platform}`]: { roundedCustomer: value => value, CustomerIcon: 'CustomerIcon' },
    [`./AdminWorkerDetailOverlays.${platform}`]: { WorkerDetailOverlays: 'RealWorkerDetailOverlays' } };
  const exports = s.compile(path.resolve(__dirname, `../src/admin/${filename}.${platform}.tsx`), mocks);
  return { r, exports, render: props => r.render(() => s.expand(exports[filename](props))), rows: tree => s.nodes(tree, node => ['LazyColumn.Items', 'List.ForEach'].includes(node.type)).flatMap(node => node.props.data.map((item, index) => s.expand(node.props.children({ item, index })))) };
}
function warehouseFixture(t, overrides = {}) {
  let valid = true, focused = true, serial = 0, props = { session: {}, witness: {}, principalRef: ' raw material ref ', principalRole: 'material_taminotchi', displayName: 'Original name', assignedWarehouses: ['Assigned'],
    isCurrent: () => valid, isInteractive: () => focused, onChanged: values => calls.push(['changed', values]), onNotice: message => calls.push(['notice', message]), reloadAssignedWarehouses: async () => ['Available'],
    assignedMessage: 'Exact material scope', chipKeyPrefix: 'admin-material-detail-warehouse-', addButtonKey: 'admin-material-detail-add-warehouse', buttonRadius: 14 };
  const calls = [], deps = { mode: 'warehouse', isCurrent: () => valid, nextId: () => ++serial, name: () => props.displayName, assignedWarehouses: () => props.assignedWarehouses, assignedMaterials: () => [],
    warehouses: async (guard, witness) => { guard(); if (!witness()) throw Error('witness'); calls.push('catalog'); return [{ warehouse: 'Assigned' }, { warehouse: 'Available' }, { warehouse: 'Other' }, { warehouse: 'Group', is_group: true }]; },
    assignWarehouse: async (name, display, guard) => { guard(); calls.push(['assign', name, display]); return { warehouse: name }; }, unassignWarehouse: async (name, guard) => { guard(); calls.push(['unassign', name]); },
    reloadWarehouses: async (guard, witness) => { guard(); if (!witness()) throw Error('witness'); return props.reloadAssignedWarehouses(); }, changedWarehouses: values => props.onChanged(values),
    materials: async () => [], assignMaterial: async () => ({}), unassignMaterial: async () => {}, reloadMaterials: async () => [], changedMaterials() {}, text: key => key, notice: (key, values) => calls.push(['notice', key, values]), rawNotice() {}, ...overrides };
  const controller = new worker.editor.AdminWorkerDetailEditorController(deps), owner = { current: () => valid, controller, beginAdd: () => calls.push('beginAdd'), beginRemove: () => calls.push('beginRemove') }, r = s.runtime(), h = warehouseHook(r, owner);
  const render = () => r.render(() => h.useAdminCustomerMaterialWarehouse(props)); render();
  t?.after(() => r.unmount());
  return { controller, owner, r, h, render, calls, deps, get props() { return props; }, propsUpdate: values => { props = { ...props, ...values }; }, retire: () => { valid = false; }, focus: value => { focused = value; render(); } };
}
function pickerNative(platform, model, r = s.runtime()) {
  const modifier = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) }), parts = (name, slots) => Object.assign(function Component(props) { return { type: name, props }; }, slots);
  const nativeState = initial => { const value = r.react.useRef(null); return value.current ??= { get: () => initial, set() {} }; };
  const ui = new Proxy({ useNativeState: nativeState, List: parts('List', { ForEach: 'List.ForEach' }), OutlinedTextField: parts('OutlinedTextField', { Placeholder: 'Placeholder', LeadingIcon: 'LeadingIcon' }),
    BasicTextField: parts('BasicTextField', { DecorationBox: 'DecorationBox', Placeholder: 'Placeholder', InnerTextField: 'InnerTextField' }) }, { get: (target, name) => target[name] ?? String(name) });
  const exports = s.compile(path.resolve(__dirname, `../src/admin/AdminWorkerDetailOverlays.${platform}.tsx`), { react: r.react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifier,
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': new Proxy({ useScrollGeometryChange: () => null }, { get: (target, name) => target[name] ?? modifier[name] }),
    'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', FlatList: 'FlatList', Platform: { Version: 26 }, StyleSheet: { absoluteFill: {}, create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminBasicTextField: ui.BasicTextField, AdminOutlinedTextField: ui.OutlinedTextField }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: s.colors, mode: 'light' }) },
    './AdminWorkerDetailNative.android': { WorkerDetailIcon: 'Icon', WorkerDetailLoading: 'Loading', workerDetailShape: value => value, workerDetailSegmentShape: value => value, workerDetailAlpha: value => value } });
  return { r, render: () => r.render(() => s.expand(exports.WorkerDetailOverlays({ model }))) };
}
function composition(platform, props) {
  const exports = s.compile(path.resolve(__dirname, `../src/admin/AdminCustomerDetailWithAssignments.${platform}.tsx`), {
    [`./AdminCustomerApparatusCard.${platform}`]: { AdminCustomerApparatusCard: 'ActualApparatusCard' }, [`./AdminCustomerDetailRoute.${platform}`]: { AdminCustomerDetailRoute: 'ActualCustomerRoute' },
    [`./AdminCustomerMaterialWarehouseEditor.${platform}`]: { AdminCustomerMaterialWarehouseEditor: 'ActualMaterialWarehouseEditor' }, [`./AdminProfileAvatar.${platform}`]: { AdminProfileAvatar: 'ActualProfileAvatar' } });
  return exports.AdminCustomerDetailWithAssignments(props);
}
module.exports = { ...s, apparatusModel, AdminCustomerApparatusController, role, machine, apparatusFixture, apparatusHook, warehouseHook, view, warehouseFixture, pickerNative, worker, composition };
