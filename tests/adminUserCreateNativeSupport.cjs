/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { frameModule } = require('./adminShellFrameViewSupport.cjs');
const { l10n, model: source, role } = require('./adminUserCreateSupport.cjs');
const { load } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const modifiers = new Proxy({}, { get: (_target, name) => name === 'Shapes' ? { RoundedCorner: value => value } : (...args) => ({ name: String(name), args }) });
const colors = { surface: '#FFFFFFFF', surfaceBright: '#FAFAFAFF', surfaceContainerLow: '#EEEEEEFF', surfaceContainerHigh: '#DDDDDDFF', surfaceContainerHighest: '#CCCCCCFF', secondaryContainer: '#BBBBBBFF', onSecondaryContainer: '#111111FF', onSurface: '#111111FF', onSurfaceVariant: '#666666FF', primary: '#334455FF', outlineVariant: '#AAAAAAFF' };
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate)); if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const byID = (tree, id) => nodes(tree, node => node.props?.testID === id || node.props?.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.name) && value.args[0] === id))[0];
const text = tree => nodes(tree, node => ['Text', 'RN.Text'].includes(node.type)).map(node => node.props.children ?? node.props.label).flat().filter(Boolean).join(' ');
const click = (node, platform) => node.props[platform === 'android' ? 'onClick' : 'onPress']();
let uuidSerial = 0;
function fixture(platform, kind = 'customer', locale = 'uz', { hide = async () => {}, missingSheet = false } = {}) {
  let cursor = 0, pending = [], refs = [], dirty = false, sheetAvailable = !missingSheet, tagSerial = 100, hookReads = 0; const values = [], effects = new Map(), calls = [], nativeValues = [], cache = new Map(), windows = new Map(), markers = new Map(), windowCalls = [];
  const memo = (fn, deps) => { const index = cursor++, old = values[index]; if (!old || deps?.some((value, i) => value !== old.deps?.[i])) values[index] = { deps, value: fn() }; return values[index].value; };
  const effect = (fn, deps) => { const index = cursor++, old = effects.get(index); if (!old || !deps || deps.some((value, i) => value !== old.deps?.[i])) { const entry = { deps, fn, cleanup: old?.cleanup }; effects.set(index, entry); pending.push(() => { entry.cleanup?.(); entry.cleanup = fn(); }); } };
  const react = { useEffect: effect, useLayoutEffect: effect, useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => memo(() => ({ current: value }), []),
    useState: initial => { const value = memo(() => ({ value: typeof initial === 'function' ? initial() : initial }), []); return [value.value, next => { const result = typeof next === 'function' ? next(value.value) : next; if (result !== value.value) { value.value = result; dirty = true; } }]; },
    useSyncExternalStore: (subscribe, get) => { effect(() => subscribe(() => { dirty = true; }), [subscribe]); return get(); } };
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
  const windowObserver = { arm: (viewTag, ticket) => { windowCalls.push(['arm', viewTag, ticket]); const arm = deferred(), detach = deferred(), value = { protocol: 1, guarantee: 'window-tree-detach', state: 'armed', viewTag, ticket, handle: `window-${ticket}` }; windows.set(ticket, { arm, detach, value }); return arm.promise; },
    waitForDetach: value => { windowCalls.push(['wait', value.handle, value.ticket]); return windows.get(value.ticket).detach.promise; }, cancelPending: async ticket => { windowCalls.push(['pending-cancel', ticket]); return false; }, cancel: async value => { windowCalls.push(['cancel', value.handle, value.ticket]); return true; } };
  const { AdminPresentationWindowOwner } = load('admin/adminPresentationWindowOwner', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard') });
  const presentationHook = load('admin/useAdminPresentationWindow', { react, './adminPresentationWindowOwner': { AdminPresentationWindowOwner } });
  const ticket = load('admin/adminPresentationWindowTicket', { 'expo-crypto': { randomUUID: () => `10000000-0000-4000-8000-${(++uuidSerial).toString(16).padStart(12, '0')}` } });
  const observable = value => memo(() => { const state = { value, writes: [], set(next) { this.value = next; this.writes.push(next); }, get() { return this.value; } }; nativeValues.push(state); return state; }, []);
  const native = (name, slots = []) => { const fn = props => ({ type: name, props }); for (const slot of slots) fn[slot] = `${name}.${slot}`; return fn; };
  const ui = new Proxy({ Shape: { RoundedCorner: value => value }, useNativeState: observable, BasicTextField: native('BasicTextField', ['DecorationBox', 'InnerTextField', 'Placeholder']),
    OutlinedTextField: native('OutlinedTextField', ['Label']), AlertDialog: native('AlertDialog', ['Title', 'Text', 'DismissButton', 'ConfirmButton']), TopAppBar: native('TopAppBar', ['NavigationIcon', 'Title', 'Actions']),
    ModalBottomSheet: props => { const value = memo(() => ({ hide }), []); if (props.ref) refs.push(() => { if (typeof props.ref === 'function') props.ref(sheetAvailable ? value : null); else props.ref.current = sheetAvailable ? value : null; }); return { type: 'ModalBottomSheet', props }; } }, { get: (target, name) => target[name] ?? String(name) });
  const a = (key, values) => l10n.adminText(key, locale, values), choice = kind === 'material' ? { kind, role: role('material_taminotchi', 'material_taminotchi') } : kind === 'aparatchi' ? { kind: 'custom', role: role('aparatchi') } : { kind, role: null };
  const state = { valid: true, choice, choices: source.adminUserCreateChoices([], 'admin', []), formId: 7, fillVersion: 0, phase: 'ready', saving: false, regenerating: false, code: ' CODE ', seconds: 0,
    apparatusLoading: false, apparatus: [{ id: 'apparatus:default:A', name: 'Press' }, { id: '', name: 'Blank' }], selectedApparatus: [], groupsLoading: false, groups: ['Kley', 'Kraska'], selectedGroups: [], picker: null, issuedCode: null, notice: null };
  const model = { state, fields: { name: 'Draft', phone: 'Phone' }, current: () => state.valid, interactive: () => state.valid, nativeCurrent: () => state.valid, focused: true, a, t: key => l10n.localizedGetter(key, locale), locale, formId: 7,
    custom: ['material', 'aparatchi'].includes(kind), material: kind === 'material', apparatusVisible: kind === 'aparatchi', customerOnly: false, footer: { type: 'RealFooter', props: {} }, notice: null, label: kind, subtitle: 'Subtitle', pickerRows: [], saveEnabled: true, codeCopyEnabled: true, regenerateEnabled: true, copyLabel: locale === 'uz' ? 'Nusxa olish' : a('action.copy'),
    back: () => calls.push('back'), rolePicker: () => calls.push('role-picker'), groupPicker: () => calls.push('group-picker'), changeName: value => calls.push(['name', value]), changePhone: value => calls.push(['phone', value]),
    save: () => calls.push('save'), regenerate: () => calls.push('regenerate'), copy: () => calls.push('copy'), reload: () => calls.push('reload'), selectApparatus: (...args) => calls.push(['apparatus', ...args]),
    pickerSearch: (...args) => calls.push(['picker-search', ...args]), chooseRole: (...args) => calls.push(['role', ...args]), toggleGroup: (...args) => calls.push(['group', ...args]), confirmGroups: id => calls.push(['groups-confirm', id]),
    dismissPicker: id => calls.push(['picker-dismiss', id]), completePicker: id => calls.push(['picker-complete', id]), dismissCode: id => calls.push(['code-dismiss', id]), completeCode: id => calls.push(['code-complete', id]), copyIssued: id => calls.push(['code-copy', id]) };
  model.controller = { getSnapshot: () => state, completeCode: id => model.completeCode(id), completePicker: id => model.completePicker(id) };
  const base = { './AdminTopBar.android': require('./support/adminChrome.cjs'), react, 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'react-native': { View: 'View', Text: 'RN.Text', ScrollView: 'RN.ScrollView', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } }, useWindowDimensions: () => ({ width: 400, height: 800 }), findNodeHandle: value => value?.tag ?? null },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'light' }) },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' }, './AdminTypography.android': { AdminText: 'Text', useAdminFontsReady: () => false },
    './AdminTextFields.android': { AdminBasicTextField: ui.BasicTextField, AdminOutlinedTextField: ui.OutlinedTextField }, './adminFontFamily.android': { adminTextStyle: value => value },
    './AdminProfileAction.android': { AdminProfileAction: 'AdminProfileAction' }, './AdminProfileAction.ios': { AdminProfileAction: 'AdminProfileAction' }, './AdminShellBodyFrame': frameModule(colors),
    './adminUserCreateModel': source, './useAdminUserCreate': { useAdminUserCreate: () => { hookReads++; return model; } }, './useAdminPresentationWindow': presentationHook, './adminPresentationWindowTicket': ticket };
  function compile(name) {
    if (cache.has(name)) return cache.get(name); const filename = path.resolve(__dirname, '../src/admin', `${name}.tsx`), mod = new Module(filename, module); cache.set(name, mod.exports); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => Object.hasOwn(base, id) ? base[id] : id.startsWith('./AdminUserCreate') ? compile(id.slice(2)) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); cache.set(name, mod.exports); return mod.exports;
  }
  function expand(node) { if (Array.isArray(node)) return node.map(expand); if (!node || typeof node !== 'object') return node; if (typeof node.type === 'function') return expand(node.type(node.props));
    if (node.type === 'View' && node.props.nativeID) { if (!markers.has(node.props.nativeID)) markers.set(node.props.nativeID, { tag: ++tagSerial }); if (node.props.ref) refs.push(() => { node.props.ref.current = markers.get(node.props.nativeID); }); }
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } }; }
  const screen = compile(`AdminUserCreateScreen.${platform}`).AdminUserCreateScreen, overlays = compile(`AdminUserCreateOverlays.${platform}`).AdminUserCreateOverlays;
  let lastTree;
  const render = (onlyOverlays = false) => { for (let attempt = 0; attempt < 8; attempt++) { cursor = 0; pending = []; refs = []; dirty = false;
    const result = expand(onlyOverlays ? overlays({ model, windowObserver }) : screen(props)); refs.splice(0).forEach(fn => fn()); pending.splice(0).forEach(fn => fn()); lastTree = result; if (!dirty) return result;
  } throw Error('Native hook fixture did not settle'); };
  const props = { session: {}, witness: {}, mode: 'general', backLabel: 'Back', onProfile: () => calls.push('profile'), windowObserver };
  const roles = query => { state.picker = { id: 21, kind: 'roles', query, closing: false, selected: [] }; model.pickerRows = source.adminUserCreateVisibleChoices(state.choices, query, a); };
  const nativeLayout = () => { for (const node of nodes(lastTree, value => value.type === 'View' && value.props.nativeID)) node.props.onLayout(); };
  const acknowledge = () => { for (const value of windows.values()) value.arm.resolve(value.value); };
  const detached = () => { for (const value of windows.values()) value.detach.resolve({ ...value.value, state: 'detached' }); };
  const cleanup = () => { effects.forEach(value => value.cleanup?.()); };
  return { calls, model, state, props, nativeValues, render, roles, nativeLayout, acknowledge, detached, windowCalls, cleanup, rawOverlays: () => overlays({ model, windowObserver }), hookReads: () => hookReads, sheetAvailable: value => { sheetAvailable = value; }, retire: () => { state.valid = false; } };
}
module.exports = { fixture, nodes, byID, text, click };
