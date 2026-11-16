/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { load, l10n, strings, detail, tick } = require('./adminWorkerDetailSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const slotNames = ['children', 'anchor', 'ListEmptyComponent', 'ListFooterComponent'];
function expand(node) {
  if (Array.isArray(node)) return node.map(expand); if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, props: { ...node.props, ...Object.fromEntries(slotNames.map(key => [key, expand(node.props?.[key])])) } };
}
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate)); if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...slotNames.flatMap(key => nodes(node.props?.[key], predicate))]; }
const texts = node => nodes(node, item => item.type === 'Text' || typeof item.props?.label === 'string').flatMap(item => [item.props.children, item.props.label]).filter(value => typeof value === 'string');
const byId = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
const click = (node, platform) => node.props[platform === 'android' ? 'onClick' : 'onPress']();
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
function runtime() {
  let cursor = 0; const slots = [], effects = [];
  const react = { useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useEffect: (callback, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(callback); } } };
  return { react, render(callback) { cursor = 0; const value = callback(); effects.splice(0).forEach(fn => fn()); return value; } };
}
const colors = Object.fromEntries(['surface', 'surfaceContainer', 'surfaceContainerLow', 'surfaceContainerHigh', 'surfaceContainerHighest', 'outlineVariant', 'onSurface', 'onSurfaceVariant', 'secondaryContainer', 'onSecondaryContainer', 'error', 'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer'].map((key, index) => [key, `#${(index * 3783).toString(16).padStart(6, '0')}FF`]));
function fixture(platform, { locale = 'uz', readOnly = false, system = false, preparation = true, expanded = true, loading = false, profileError = false, noCode = false, savingPhone = false, regeneratingCode = false, overlays = [], current = true } = {}) {
  const calls = [], avatars = [], r = runtime(); let valid = current, focused = true;
  const row = { material_id: 'm', material_name: 'Backend material', estimated_kg: null }, material = { id: 'm', name: 'Backend material', variants: [{ micron: 7 }], active: true };
  const state = { phase: 'content', expanded, loading, loadError: false, profileLoading: loading, profileError, profile: loading || profileError ? null : {},
    detail: detail({ code: noCode ? '' : ' RAW CODE ', code_locked: true, code_retry_after_sec: 9 }), phoneDraft: ' draft ', phoneFillVersion: 0, phoneEditing: false,
    savingPhone, regeneratingCode, warehouses: ['Warehouse A'], responsibilities: [row], changed: false, notice: null };
  const record = name => (...args) => calls.push([name, ...args]);
  const facade = mode => ({ state: { adding: false, removing: null, picker: null, dialog: null }, warehouses: ['Warehouse A'], materials: [material], dialogText: { title: 'Confirmation', message: 'Message', cancel: 'No', confirm: 'Yes' },
    canInteract: () => valid && focused, canInteractOverlay: id => valid && focused && value.overlays.at(-1)?.id === id, add: record(`${mode}add`), removeWarehouse: record('removeWarehouse'), removeMaterial: record('removeMaterial'),
    search: record('search'), selectWarehouse: record('selectWarehouse'), confirmWarehouse: record('confirmWarehouse'), selectMaterial: record('selectMaterial'), materialScroll: record('scroll'), retryMaterial: record('retry'), dismissPicker: record('dismissPicker'), confirmRemove: record('confirmRemove'), dismissDialog: record('dismissDialog') });
  const warehouse = facade('warehouse'), materialEditor = facade('material');
  const value = { state, detail: state.detail, scopeCurrent: () => valid, current: () => valid && focused, interactive: () => valid && focused, locale, warehouse, material: materialEditor, overlays: [], generation: 1, phoneGeneration: 1,
    readOnly, system, preparation, responsibilityEnabled: preparation && !readOnly, warehouseEnabled: !readOnly, initials: 'LN', displayName: 'Loaded name', subtitle: 'Level • Worker profile', status: 'Ready', apparatusLabels: ['Apparatus'], notice: null,
    a: (key, values) => l10n.adminText(key, locale, values), u: value => l10n.uiText(value, locale), t: key => l10n.localizedGetter(key, locale),
    back: record('back'), toggle: record('toggle'), phoneAction: record('phoneAction'), changePhone: record('changePhone'), submitPhone: record('submitPhone'), copy: record('copy'), regenerate: record('regenerate'), retryProfile: record('retryProfile'), reload: record('reload'), openActivity: record('activity') };
  for (const item of overlays) {
    const editor = item.mode === 'material' ? materialEditor : warehouse, id = item.id ?? (value.overlays.length + 1);
    if (item.type === 'dialog') editor.state.dialog = { id, kind: item.mode };
    else editor.state.picker = item.mode === 'material' ? { id, kind: 'material', query: '', loading: false, loadingMore: false, hasMore: false, error: false, items: [material] }
      : { id, kind: 'warehouse', query: '', selected: item.selected ? 'Warehouse A' : null, available: ['Warehouse A'] };
    value.overlays.push({ id, type: item.type ?? 'picker', editor });
  }
  const component = (name, slots = []) => Object.assign(props => ({ type: name, props }), Object.fromEntries(slots.map(slot => [slot, `${name}.${slot}`])));
  const nativeState = initial => { const ref = r.react.useRef(null); return ref.current ??= { value: initial, get() { return this.value; }, set(value) { this.value = value; } }; };
  const list = component('List'); list.ForEach = props => props.data.map((item, index) => props.children({ item, index }));
  const ui = new Proxy({ useNativeState: nativeState, Shape: { RoundedCorner: value => value }, List: list, InputChip: component('InputChip', ['Avatar', 'Label', 'TrailingIcon']),
    TopAppBar: component('TopAppBar', ['Title', 'NavigationIcon', 'Actions']), BasicTextField: component('BasicTextField', ['DecorationBox', 'InnerTextField', 'Placeholder']), OutlinedTextField: component('OutlinedTextField', ['Placeholder', 'LeadingIcon']) }, { get: (target, name) => target[name] ?? String(name) });
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': new Proxy({ Animation: { easeOut: value => value } }, { get: (target, name) => target[name] ?? modifiers[name] }),
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'RN.ScrollView', Platform: { OS: platform, Version: 18 }, StyleSheet: { absoluteFill: { position: 'absolute' }, create: value => value },
      useWindowDimensions: () => ({ width: 400, height: 800 }), FlatList: props => ({ type: 'FlatList', props: { ...props, children: props.data?.length ? props.data.map((item, index) => props.renderItem({ item, index })) : props.ListEmptyComponent } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(colors), './AdminTypography.android': { AdminText: 'Text' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, './dartJsonString': strings, './useAdminWorkerDetail': { useAdminWorkerDetail: () => value } };
  const compiled = new Map();
  function compile(relative) {
    if (compiled.has(relative)) return compiled.get(relative);
    const filename = path.resolve(__dirname, '../src', relative), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./AdminWorkerDetail') ? compile(`admin/${id.slice(2)}.tsx`) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); compiled.set(relative, mod.exports); return mod.exports;
  }
  const screen = compile(`admin/AdminWorkerDetailScreen.${platform}.tsx`), props = { backLabel: 'Back', profileAction: { type: 'RealProfile', props: {} }, footer: { type: 'RealDock', props: {} },
    renderAvatar: value => { avatars.push(value); return { type: 'RealAvatar', props: value }; }, renderChatAction: current => ({ type: 'RealChat', props: { current } }) };
  return { render: () => r.render(() => expand(screen.AdminWorkerDetailScreen(props))), value, props, calls, avatars, row, material, valid: next => { valid = next; }, focus: next => { focused = next; }, r };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Worker native view uses genuine preview/chat/profile/footer slots, source header204/avatar92 and overlay dock`, () => {
    const f = fixture(platform), tree = f.render(); assert.equal(nodes(tree, n => n.type === 'RealAvatar').length, 1); assert.equal(nodes(tree, n => n.type === 'RealChat').length, 1);
    assert.deepEqual(f.avatars[0], { avatarUrl: '', fallbackText: 'LN', displayName: 'LN', size: 92, isCurrent: f.value.scopeCurrent, canInteract: f.value.interactive });
    assert.equal(nodes(tree, n => n.type === 'RealDock').length, 1); assert.ok(nodes(tree, n => n.type === 'View' && n.props.style?.height === 204).length);
    assert.ok(nodes(tree, n => n.type === 'View' && n.props.style?.position === 'absolute' && n.props.style?.bottom === 0).length);
    if (platform === 'android') { const top = nodes(tree, n => n.type === 'TopAppBar')[0]; assert.ok(top.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 60)); assert.equal(nodes(tree, n => n.type === 'RealProfile').length, 1); }
    else { const stack = nodes(tree, n => n.type === 'Stack.Screen')[0]; assert.equal(stack.props.options.gestureEnabled, false); assert.equal(stack.props.options.headerRight(), f.props.profileAction); }
  });
  test(`${platform} parent blur retains mounted avatar preview read authority while hiding native overlays and denying new interactions`, () => {
    const f = fixture(platform, { overlays: [{ mode: 'material' }] }); f.render(); f.focus(false); const tree = f.render(), avatar = f.avatars.at(-1);
    assert.equal(nodes(tree, n => n.type === 'RealAvatar').length, 1); assert.equal(avatar.isCurrent(), true); assert.equal(avatar.canInteract(), false);
    assert.equal(nodes(tree, n => ['BottomSheet', 'ModalBottomSheet'].includes(n.type)).length, 0);
    const outer = nodes(tree, n => n.props.testID === 'admin-worker-detail-body-frame-reserve')[0], frame = nodes(tree, n => n.props.testID === 'admin-worker-detail-body-frame')[0];
    const flat = require('./adminShellFrameViewSupport.cjs').flattenStyle; assert.equal(flat(outer.props.style).marginHorizontal, 6); assert.equal(flat(frame.props.style).borderTopLeftRadius, 18); assert.equal(flat(frame.props.style).borderBottomLeftRadius, 18);
    f.valid(false); assert.equal(avatar.isCurrent(), false); assert.equal(f.render(), null);
  });
  test(`${platform} source phone remains editable during save; independent code/copy have no code_locked or retry cooldown gate`, () => {
    const f = fixture(platform, { savingPhone: true }); f.value.state.phoneEditing = true; const tree = f.render();
    const field = byId(tree, 'admin-worker-detail-phone-input'); assert.ok(field); field.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('typing');
    if (platform === 'android') { assert.notEqual(field.props.enabled, false); field.props.keyboardActions.onDone(); assert.equal(byId(tree, 'admin-worker-detail-phone-action').props.enabled, false); assert.equal(byId(tree, 'admin-worker-detail-regenerate-code').props.enabled, true); }
    else { assert.ok(!field.props.modifiers.some(mod => mod.name === 'disabled')); field.props.modifiers.find(mod => mod.name === 'onSubmit').args[0](); assert.ok(byId(tree, 'admin-worker-detail-phone-action').props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0])); }
    click(byId(tree, 'admin-worker-detail-copy-code'), platform); click(byId(tree, 'admin-worker-detail-regenerate-code'), platform);
    assert.deepEqual(f.calls, [['changePhone', 'typing'], ['submitPhone'], ['copy'], ['regenerate']]); assert.ok(texts(tree).includes(' RAW CODE '));
    assert.ok(texts(tree).includes(f.value.a('profile.code_wait', { seconds: 9 })));
  });
  test(`${platform} source readonly hides admin/activity/warehouse management but retains preparation labels and assigned materials`, () => {
    const f = fixture(platform, { readOnly: true }), tree = f.render(); assert.equal(byId(tree, 'admin-worker-detail-admin-toggle'), undefined); assert.equal(byId(tree, 'admin-worker-detail-phone-action'), undefined);
    assert.equal(byId(tree, 'admin-worker-detail-activity'), undefined); assert.equal(byId(tree, 'admin-qolipchi-detail-add-warehouse'), undefined); assert.equal(byId(tree, 'admin-prep-resp-add'), undefined);
    assert.ok(texts(tree).includes('Backend material')); assert.ok(texts(tree).includes(f.value.u('Javobgar homashyolar')));
  });
  test(`${platform} no source code omits copy; loading/error assignment summary keeps independent retry and full interactive profile fallback`, () => {
    const empty = fixture(platform, { noCode: true }); assert.equal(byId(empty.render(), 'admin-worker-detail-copy-code'), undefined);
    const loading = fixture(platform, { loading: true }), tree = loading.render(); assert.ok(texts(tree).includes(loading.value.a('detail.activity_loading'))); assert.ok(byId(tree, 'admin-worker-detail-admin-toggle'));
    const failed = fixture(platform, { profileError: true }), retry = byId(failed.render(), 'admin-worker-detail-profile-retry'); click(retry, platform); assert.deepEqual(failed.calls, [['retryProfile']]);
    const system = fixture(platform, { system: true }); assert.equal(byId(system.render(), 'admin-worker-detail-activity'), undefined); const inactive = fixture(platform, { current: false }); assert.equal(inactive.render(), null);
  });
  test(`${platform} source54/radius14 warehouse and responsibility actions retain independent busy flags`, () => {
    const f = fixture(platform); f.value.warehouse.state.adding = true; const tree = f.render(), warehouse = byId(tree, 'admin-qolipchi-detail-add-warehouse'), material = byId(tree, 'admin-prep-resp-add');
    if (platform === 'android') { assert.equal(warehouse.props.enabled, false); assert.equal(material.props.enabled, true); assert.ok(material.props.modifiers.some(mod => mod.name === 'defaultMinSize' && mod.args[0].minHeight === 54)); assert.deepEqual(Object.values(material.props.shape.cornerRadii), [14, 14, 14, 14]); }
    else { assert.ok(warehouse.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0])); assert.ok(material.props.modifiers.some(mod => mod.name === 'disabled' && !mod.args[0])); assert.ok(material.props.modifiers.some(mod => mod.name === 'frame' && mod.args[0].minHeight === 54)); }
    click(material, platform); assert.deepEqual(f.calls, [['materialadd']]);
    if (platform === 'android') { assert.equal(material.props.colors.contentColor, colors.onSurface); assert.ok(nodes(tree, n => n.type === 'Text' && n.props.children === 'Javobgar homashyolar' && n.props.style?.fontSize === 20 && n.props.style.fontWeight === '700').length); }
  });
  test(`${platform} warehouse native sheet radio does not assign until explicit confirm and retains source72percent/search callbacks`, async () => {
    const f = fixture(platform, { overlays: [{ mode: 'warehouse', selected: true }] }), tree = f.render(), search = byId(tree, 'admin-material-warehouses-search'), id = f.value.overlays[0].id;
    search.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('query');
    const row = byId(tree, 'admin-material-warehouse-warehouse a'); click(row, platform); assert.deepEqual(f.calls, [['search', id, 'query'], ['selectWarehouse', id, 'Warehouse A']]);
    click(byId(tree, 'admin-material-warehouse-confirm'), platform);
    if (platform === 'android') { const sheet = nodes(tree, n => n.type === 'ModalBottomSheet')[0]; assert.ok(nodes(sheet, n => n.type === 'Column').some(n => n.props.modifiers?.some(mod => mod.name === 'height' && mod.args[0] === 576))); await tick(); }
    else { assert.ok(nodes(tree, n => n.type === 'Group').some(n => n.props.modifiers?.some(mod => mod.name === 'presentationDetents' && mod.args[0][0].fraction === .72))); assert.equal(f.calls.length, 2); nodes(tree, n => n.type === 'BottomSheet')[0].props.onDismiss(); }
    assert.deepEqual(f.calls.at(-1), ['confirmWarehouse', id]);
  });
  test(`${platform} source material sheet plain Uzbek title/hint/subtitle stay plain in Urdu; selecting dismisses before assignment`, async () => {
    const f = fixture(platform, { locale: 'ur', overlays: [{ mode: 'material' }] }), tree = f.render(), id = f.value.overlays[0].id;
    assert.ok(texts(tree).includes('Homashyo tanlang')); assert.ok(texts(tree).includes('1 mikron varianti'));
    const search = byId(tree, 'admin-worker-detail-material-search'); if (platform === 'ios') assert.equal(search.props.placeholder, 'Qidirish'); else assert.ok(texts(search).includes('Qidirish'));
    const row = nodes(tree, n => n.type === (platform === 'android' ? 'Surface' : 'Button') && texts(n).includes('Backend material') && texts(n).includes('1 mikron varianti'))[0]; click(row, platform);
    if (platform === 'android') await tick(); else { assert.equal(f.calls.length, 0); nodes(tree, n => n.type === 'BottomSheet')[0].props.onDismiss(); }
    assert.deepEqual(f.calls, [['selectMaterial', id, f.material]]);
  });
  test(`${platform} source removal confirms/cancels with original dialog id and independent native controls`, () => {
    const f = fixture(platform, { overlays: [{ mode: 'warehouse', type: 'dialog', id: 8 }] }), tree = f.render(); click(byId(tree, 'admin-worker-detail-editor-remove-confirm'), platform); assert.deepEqual(f.calls, [['confirmRemove', 8]]);
    if (platform === 'android') nodes(tree, n => n.type === 'BasicAlertDialog')[0].props.onDismissRequest(); else { nodes(tree, n => n.type === 'Modal')[0].props.onRequestClose(); nodes(tree, n => n.type === 'Pressable')[0].props.onPress(); }
    assert.deepEqual(f.calls.at(-1), ['dismissDialog', 8]);
  });
  test(`${platform} retained native selection cannot even start sheet hide after original focus/lifetime guard fails`, async () => {
    const f = fixture(platform, { overlays: [{ mode: 'warehouse', selected: true }] }), tree = f.render(); f.valid(false); click(byId(tree, 'admin-material-warehouse-confirm'), platform); await tick(); assert.deepEqual(f.calls, []);
  });
}
test('Android source material loading uses expressive48 glyph in64 host; profile inline busy remains18 circular', () => {
  const f = fixture('android', { loading: true, overlays: [{ mode: 'material' }] }); f.value.material.state.picker.loading = true;
  const tree = f.render(), glyph = nodes(tree, n => n.type === 'LoadingIndicator')[0]; assert.ok(glyph.props.modifiers.some(mod => mod.name === 'size' && mod.args[0] === 48));
  assert.ok(nodes(tree, n => n.type === 'Box' && n.props.modifiers?.some(mod => mod.name === 'size' && mod.args[0] === 64)).length);
  assert.ok(nodes(tree, n => n.type === 'CircularProgressIndicator' && n.props.modifiers?.some(mod => mod.name === 'size' && mod.args[0] === 18)).length);
  assert.ok(nodes(tree, n => n.type === 'Surface' && n.props.color === colors.surfaceContainerHigh && n.props.modifiers?.some(mod => mod.name === 'height' && mod.args[0] === 3)).length);
});
test('iOS independent editors nest second sheet within first presented content in original overlay order', () => {
  const f = fixture('ios', { overlays: [{ mode: 'warehouse', id: 3 }, { mode: 'material', id: 4 }] }), tree = f.render(), sheets = nodes(tree, n => n.type === 'BottomSheet');
  assert.equal(sheets.length, 2); assert.equal(nodes(sheets[0].props.children, n => n.type === 'BottomSheet').length, 1);
});
test('presentation keeps source fallback defaults and raw material confirmation independent from UrduAware labels', () => {
  const presentation = load('admin/adminWorkerDetailPresentation', { '../shared/localization': l10n, './adminUsersModel': require('./adminWorkerDetailSupport.cjs').model, './dartJsonString': strings,
    './adminWerkaPresentation': load('admin/adminWerkaPresentation', { './dartJsonString': strings }) });
  assert.equal(presentation.adminWorkerDetailInitials(''), 'I'); assert.equal(presentation.adminWorkerDetailInitials('Ali Vali'), 'AV');
  assert.deepEqual(presentation.adminWorkerDetailDialogText({ kind: 'material', material: { material_name: 'Raw material' }, name: 'Raw name' }, 'ur'), { title: 'Biriktirishni olib tashlash', message: 'Raw material — Raw name endi bu homashyoli buyurtmalarni ko‘rmaydi.', cancel: 'Yo‘q', confirm: 'Ha' });
  const fallback = presentation.adminWorkerDetailDisplay({ detail: null, loading: true, retryAfterSec: 3 }, require('./adminWorkerDetailSupport.cjs').entry(), 'uz'); assert.equal(fallback.phone, l10n.adminText('detail.loading', 'uz')); assert.equal(fallback.code, fallback.phone); assert.equal(fallback.code_retry_after_sec, 3);
});
