/* global __dirname */
const path = require('node:path');
const s = require('./adminUsersSupport.cjs');
const base = require('./adminSupplierDetailViewSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard'), mobile = s.load('shared/mobileApiException');
const catalog = s.load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': mobile, './searchActivityStore': { SearchActivityStore: class {} } });
const domain = s.load('admin/adminCustomerDetailModel', { '../shared/catalogApi': catalog, './dartJsonString': s.strings });
const { AdminCustomerDetailController } = s.load('admin/adminCustomerDetailController', { '../shared/mobileApiException': mobile, '../shared/camera/synchronousGuard': strict,
  './adminCustomerDetailModel': domain, './dartJsonString': s.strings });
const { AdminCustomerDetailPresentation } = s.load('admin/adminCustomerDetailPresentation', { '../shared/camera/synchronousGuard': strict, './dartJsonString': s.strings });
const { AdminWorkerDetailEditorController } = s.load('admin/adminWorkerDetailEditorController', { '../shared/camera/synchronousGuard': strict, '../shared/mobileApiException': mobile,
  '../qolip/qolipSearchRelevance': {}, './adminWorkerDetailModel': { adminWorkerDetailWarehouseNames: values => [...new Set(values)] }, './dartJsonString': s.strings });
const initials = s.load('admin/adminWerkaPresentation', { './dartJsonString': s.strings });
const item = (code, name = code) => catalog.supplierItemFromJson({ code, name });
const detail = patch => domain.adminCustomerDetailFromJson({ ref: 'resolved ref', name: 'Customer Name', phone: ' original phone ', avatar_url: 'https://images.example/real.png',
  code: ' raw code ', code_locked: true, code_retry_after_sec: 27, assigned_items: [item('A')], assigned_item_groups: ['Rulon'], assigned_warehouses: ['W'], ...patch });
/** Model React's insertion/mutation lifetime separately from StrictMode's layout/passive replay. */
function runtime() {
  let cursor = 0, pending = [];
  const slots = [], effects = new Map(), cleanups = new Map(), counters = { writes: 0 };
  const memo = (callback, deps) => { const index = cursor++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: callback() }; return slots[index].value; };
  const effect = kind => (callback, deps) => { const index = cursor++, old = slots[index]; effects.set(index, { kind, callback });
    if (!old || !deps || deps.some((value, i) => !Object.is(value, old[i]))) { slots[index] = deps; pending.push({ kind, run() { cleanups.get(index)?.(); cleanups.set(index, callback()); } }); } };
  const react = { useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [slots[index], next => { counters.writes++; slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo: memo, useCallback: (callback, deps) => memo(() => callback, deps), useInsertionEffect: effect('insertion'), useLayoutEffect: effect('layout'), useEffect: effect('passive'),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
  const commit = kinds => { for (const kind of kinds ?? ['insertion', 'layout', 'passive']) { const work = pending.filter(item => item.kind === kind); pending = pending.filter(item => item.kind !== kind); work.forEach(item => item.run()); } };
  const unmount = () => { [...cleanups.entries()].reverse().forEach(([, cleanup]) => cleanup?.()); cleanups.clear(); };
  return { react, counters, commit, unmount, render(callback, committed = true) { cursor = 0; pending = []; const value = callback(); if (committed) commit(); return value; },
    replayCleanup() { for (const [index, effect] of effects) if (effect.kind !== 'insertion') { cleanups.get(index)?.(); cleanups.delete(index); } },
    replaySetup() { for (const kind of ['layout', 'passive']) for (const [index, effect] of effects) if (effect.kind === kind) cleanups.set(index, effect.callback()); },
    replay() { this.replayCleanup(); this.replaySetup(); } };
}
function hooks(r, extra = {}) {
  return base.compile(path.resolve(__dirname, '../src/admin/useAdminCustomerDetail.ts'), { react: r.react,
    'expo-router': { useIsFocused: () => true, useFocusEffect: callback => r.react.useEffect(callback, [callback]) },
    'react-native': { Platform: { OS: 'ios' }, BackHandler: {} }, '../auth': { subscribeSessionWitness: () => () => {} },
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './adminCustomerDetailSession': {}, './adminCustomerDetailModel': domain, './adminCustomerDetailPresentation': { AdminCustomerDetailPresentation },
    './adminUsersModel': s.model, './adminWerkaPresentation': initials, './dartJsonString': s.strings, ...extra });
}
function model(patch = {}, modes = {}) {
  let valid = true, focused = true, phone = async () => true;
  const calls = [], state = { valid: true, removed: false, loading: false, loadError: null, detail: detail(), seconds: 3, expanded: true, savingPhone: false,
    regenerating: false, removing: false, addingItem: false, editingGroups: false, removingItemCode: null, changed: false, notice: null, prompt: null, ...patch };
  const dto = state.detail ?? detail(), mode = { management: true, material: false, items: true, remove: true, ...modes }, overlays = { sheets: [] };
  const result = { state, detail: dto, mode, overlays, generation: 1, overlayGeneration: 1, locale: 'uz', displayName: dto.name, initials: 'CN', title: 'Customer', subtitle: 'Haridor profili', status: 'Tayyor', notice: null,
    current: () => valid, interactive: () => valid && focused && !overlays.sheets.length && !state.prompt,
    controlsCurrent: () => valid && focused && mode.management && state.expanded && !overlays.sheets.length && !state.prompt,
    a: (key, values) => s.l10n.adminText(key, 'uz', values), t: key => s.l10n.localizedGetter(key, 'uz'),
    back: () => calls.push('back'), reload: () => calls.push('reload'), toggle: () => calls.push('toggle'),
    regenerate: () => calls.push('regen'), copy: code => calls.push(['copy', code]), openAssigned: dto => calls.push(['view', dto]), openAvailable: () => calls.push('add'), editGroups: () => calls.push('groups'), requestRemove: () => calls.push('remove'),
    savePhone: async (dto, input) => { calls.push(['phone', dto, input]); return phone(); },
    sheetCurrent: id => valid && overlays.sheets.some(sheet => sheet.id === id), sheetInteractive: id => valid && focused && overlays.sheets.at(-1)?.id === id && !state.prompt,
    actOnItem: async (id, item) => { if (result.sheetInteractive(id)) calls.push(['item', id, item]); },
    searchGroups: (id, query) => calls.push(['search', id, query]), toggleGroup: (id, group, checked) => calls.push(['group', id, group, checked]),
    beginCloseSheet: (id, save) => { calls.push(['beginClose', id, save]); return valid; }, nativeBeginDismiss: id => calls.push(['nativeClose', id]), finishCloseSheet: id => calls.push(['finishClose', id]),
    presentation: { visibleGroups: sheet => sheet.choices.available.filter(group => !sheet.query || group.toLowerCase().includes(sheet.query)) },
    promptCurrent: prompt => valid && state.prompt === prompt, promptInteractive: prompt => valid && focused && state.prompt === prompt,
    choosePrompt: (prompt, yes) => { if (!result.promptInteractive(prompt)) return false; calls.push(['choose', prompt, yes]); return true; },
    confirmPrompt: async prompt => { if (result.promptCurrent(prompt)) calls.push(['confirm', prompt]); }, dismissPrompt: prompt => { if (result.promptCurrent(prompt)) calls.push(['dismiss', prompt]); },
    apparatus: { customerRef: ' raw widget ref ', session: {}, witness: {}, isCurrent: () => valid, isInteractive: () => valid && focused, onChanged: () => calls.push('apparatus') },
    materialWarehouse: null, promptText: state.prompt ? { title: 'Prompt title', body: 'Prompt body', cancel: 'Cancel', confirm: 'Confirm', destructive: state.prompt.kind === 'customer' } : null };
  return { model: result, calls, focus: value => { focused = value; }, valid: value => { valid = value; }, phone: value => { phone = value; } };
}
const colors = { ...base.colors, error: '#AA0000FF', primaryContainer: '#CCDDEEFF', onPrimaryContainer: '#112233FF' };
function view(platform, value, r = runtime()) {
  const components = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  const nativeState = initial => { const slot = r.react.useRef(null); return slot.current ??= { value: initial, get() { return this.value; }, set(value) { this.value = value; } }; };
  const modifier = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
  const compose = new Proxy({ Shape: { RoundedCorner: value => value }, useNativeState: nativeState,
    LazyColumn: components('LazyColumn', { Items: 'LazyColumn.Items' }), OutlinedTextField: components('OutlinedTextField', { LeadingIcon: 'LeadingIcon', Placeholder: 'Placeholder' }),
    BasicTextField: components('BasicTextField', { DecorationBox: 'DecorationBox', InnerTextField: 'InnerTextField', Placeholder: 'Placeholder' }),
    TopAppBar: components('TopAppBar', { Title: 'TopAppBar.Title', NavigationIcon: 'TopAppBar.NavigationIcon', Actions: 'TopAppBar.Actions' }) }, { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({ useNativeState: nativeState, List: components('List', { ForEach: 'List.ForEach' }), LazyVStack: components('LazyVStack', { ForEach: 'LazyVStack.ForEach' }) }, { get: (target, name) => target[name] ?? String(name) });
  const transition = { duration: () => transition, easing: () => transition }, shared = hooks(r);
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({ Animation: { easeOut: value => value, easeInOut: value => value } }, { get: (target, name) => target[name] ?? modifier[name] }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'RN.ScrollView', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-reanimated': { View: 'Animated.View', default: { View: 'Animated.View' }, LinearTransition: transition, Easing: { cubic: 'cubic', out: value => value, inOut: value => value },
      useSharedValue: value => r.react.useRef({ value }).current, useAnimatedStyle: callback => callback(), withTiming: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(colors), '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'light' }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    '../shared/localization': s.l10n, './dartJsonString': s.strings, './useAdminCustomerDetail': { ...shared, useAdminCustomerDetail: () => value } };
  const native = base.compile(path.resolve(__dirname, `../src/admin/AdminCustomerDetailNative.${platform}.tsx`), mocks); mocks[`./AdminCustomerDetailNative.${platform}`] = native;
  const sheets = base.compile(path.resolve(__dirname, `../src/admin/AdminCustomerDetailSheets.${platform}.tsx`), mocks); mocks[`./AdminCustomerDetailSheets.${platform}`] = sheets;
  const screen = base.compile(path.resolve(__dirname, `../src/admin/AdminCustomerDetailScreen.${platform}.tsx`), mocks);
  const avatars = [], apparatus = [], warehouses = [], props = { profileAction: { type: 'ActualProfileAction', props: {} }, footer: { type: 'ActualDock', props: {} }, chatAction: { type: 'ActualChatAction', props: {} }, backLabel: 'Orqaga',
    renderAvatar: value => { avatars.push(value); return { type: 'ActualAvatar', props: value }; }, renderApparatusCard: value => { apparatus.push(value); return { type: 'ActualApparatusCard', props: value }; },
    renderMaterialWarehouseEditor: value => { warehouses.push(value); return { type: 'ActualWarehouseEditor', props: value }; } };
  return { ...screen, ...native, ...sheets, runtime: r, avatars, apparatus, warehouses, props, render: () => r.render(() => base.expand(screen.AdminCustomerDetailScreen(props))),
    rows: tree => base.nodes(tree, node => ['LazyColumn.Items', 'LazyVStack.ForEach', 'List.ForEach'].includes(node.type)).flatMap(node => node.props.data.map((item, index) => base.expand(node.props.children({ item, index })))) };
}
module.exports = { ...s, ...base, strict, domain, detail, item, runtime, hooks, model, view, colors, AdminCustomerDetailController, AdminCustomerDetailPresentation, AdminWorkerDetailEditorController };
