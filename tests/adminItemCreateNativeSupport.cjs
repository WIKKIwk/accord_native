/* global __dirname */
const path = require('node:path');
const base = require('./adminSupplierDetailViewSupport.cjs');
const source = require('./adminItemCreateSupport.cjs');
const modifier = new Proxy({}, { get: (_target, key) => (...args) => ({ name: String(key), args }) });
const colors = { ...base.colors, surfaceContainerLowest: '#FAFAFA', surfaceBright: '#FFFFFF', outline: '#777777', onPrimary: '#FFFFFF', primaryContainer: '#DDEEFF', onPrimaryContainer: '#112233' };
function model(patch = {}) {
  const form = { valid: true, draft: { code: 'code', name: 'name', group: 'Raw', uom: 'PCS', customer: null }, fillVersion: 0, saving: false,
    groups: { loading: false, error: null, value: ['Raw', 'Tayyor mahsulot'] }, uoms: { loading: false, error: null, value: ['PCS'] }, dialog: { id: 1, generation: 1, version: 1, savingView: false, customerView: null, finishedView: false }, ...patch };
  const calls = [], result = { state: { form }, a: (key, values) => source.l10n.adminText(key, 'uz', values), t: key => source.l10n.localizedGetter(key, 'uz'), current: () => true,
    changeName: value => calls.push(['name', value]), changeCode: value => calls.push(['code', value]), clearCustomer: () => calls.push('clearCustomer'), openPicker: kind => calls.push(['picker', kind]), closeDialog: () => calls.push('close'), save: () => calls.push('save') };
  return { model: result, calls, dialog: form.dialog };
}
function card(platform, fixture = model(), r = base.runtime()) {
  const component = name => Object.assign(props => ({ type: name, props }), { Label: 'Label' });
  const state = initial => { const holder = r.react.useRef(null); return holder.current ??= { value: initial, set(value) { this.value = value; }, get() { return this.value; } }; };
  const compose = new Proxy({ useNativeState: state }, { get: (target, key) => target[key] ?? component(String(key)) });
  const swift = new Proxy({ useNativeState: state }, { get: (target, key) => target[key] ?? component(String(key)) });
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/swift-ui': swift, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui/modifiers': modifier,
    'react-native': { ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 900, width: 400 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'light' }) },
    './AdminTextFields.android': { AdminOutlinedTextField: component('OutlinedTextField') }, './AdminTypography.android': { AdminText: 'Text' },
    './AdminItemCreateNative.android': { ItemCreateIcon: 'ItemCreateIcon', itemCreateRounded: radius => ({ radius }) }, './dartJsonString': source.strings };
  const module = base.compile(path.resolve(__dirname, `../src/admin/AdminItemCreateDialogCard.${platform}.tsx`), mocks);
  return { ...fixture, r, render: () => r.render(() => base.expand(module.AdminItemCreateDialogCard({ model: fixture.model, dialog: fixture.dialog }))) };
}
const nativeId = (tree, id) => base.nodes(tree, node => node.props.testID === id || node.props.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.name) && value.args[0] === id))[0];
const text = tree => base.nodes(tree, node => node.type === 'Text').map(node => node.props.children).filter(value => typeof value === 'string');
function catalogModel(patch = {}) {
  const original = model(), calls = [], list = { items: [], selectedCodes: [], query: '', searchDraft: '', group: '', groupExpanded: false, moving: false, initialLoading: false, loadingMore: false, hasMore: false, error: null, scrollReset: 0, ...patch };
  const result = { ...original.model, state: { ...original.model.state, list }, owner: { canSelect: true, needsItemDetail: true, needsCustomerCreate: true, controller: { list: { reload: async () => calls.push('reload') } } },
    interactive: () => true, scroll: value => calls.push(['scroll', value]), reload: () => calls.push('reload'), loadMore: () => calls.push('more'), toggleGroup: () => calls.push('toggleGroup'), group: value => calls.push(['group', value]), clearSelection: () => calls.push('clear'), toggleItem: value => calls.push(['toggle', value]), openItem: value => calls.push(['open', value]),
    pickerSearch: value => calls.push(['search', value]), pickerScroll: value => calls.push(['pickerScroll', value]), pickerReload: () => calls.push('pickerReload'), dismissPicker: () => calls.push('dismiss'), completePicker: () => calls.push('complete'), createCustomer: value => calls.push(['createCustomer', value]), selectPickerString: value => calls.push(['string', value]), selectCustomer: value => calls.push(['customer', value]) };
  return { model: result, calls };
}
const pickerPresentation = source.load('admin/adminItemCreatePickerPresentation', { './adminItemCreateModel': source.model, './dartJsonString': source.strings });
function leaf(kind, platform, fixture = catalogModel(), options = {}, r = base.runtime()) {
  const scrolls = [], native = {};
  const windowDomain = source.load('admin/adminPresentationWindowOwner', { '../shared/camera/synchronousGuard': source.strict });
  const windowHook = source.load('admin/useAdminPresentationWindow', { react: r.react, './adminPresentationWindowOwner': windowDomain });
  const observer = Object.hasOwn(options, 'observer') ? options.observer : { arm: async () => { throw Error('test marker was not armed'); }, waitForDetach: async () => { throw Error('unexpected wait'); }, cancelPending: async () => true, cancel: async () => true };
  let ticket = 0;
  const component = name => Object.assign(function Component(props) {
    if (name === 'ModalBottomSheet') { if (props.ref) props.ref.current = options.noSheetRef ? null : { hide: () => { fixture.calls.push('hide'); return options.hide?.promise ?? Promise.resolve(); } }; }
    return { type: name, props };
  }, { Label: 'Label', LeadingIcon: 'LeadingIcon', TrailingIcon: 'TrailingIcon', DecorationBox: 'DecorationBox', InnerTextField: 'InnerTextField', Placeholder: 'Placeholder', Row: 'Grid.Row' });
  const state = initial => { const holder = r.react.useRef(null); return holder.current ??= { value: initial, set(value) { this.value = value; }, get() { return this.value; } }; };
  const foreach = props => props.data.map((item, index) => props.children({ item, index }));
  const List = Object.assign(component('List'), { ForEach: foreach });
  const compose = new Proxy({ useNativeState: state, Shape: { RoundedCorner: value => value } }, { get: (target, key) => target[key] ?? (native[key] ??= component(String(key))) });
  const swift = new Proxy({ useNativeState: state, List }, { get: (target, key) => target[key] ?? (native[key] ??= component(String(key))) });
  const flat = props => { if (props.ref) props.ref.current = { scrollToOffset: value => scrolls.push(value) }; return { type: 'FlatList', props: { ...props, children: [...props.data.map((item, index) => props.renderItem({ item, index })), !props.data.length ? props.ListEmptyComponent : null, props.ListFooterComponent] } }; };
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/swift-ui': swift, '@expo/ui/jetpack-compose/modifiers': new Proxy({ Shapes: { RoundedCorner: value => value } }, { get: (target, key) => target[key] ?? modifier[key] }), '@expo/ui/swift-ui/modifiers': new Proxy({ useScrollGeometryChange: callback => ({ name: 'scrollGeometry', args: [callback] }) }, { get: (target, key) => target[key] ?? modifier[key] }),
    'react-native': { ScrollView: 'ScrollView', FlatList: flat, RefreshControl: 'RefreshControl', View: props => { if (props.ref) props.ref.current = { nativeTag: 101 }; return { type: 'View', props }; }, findNodeHandle: value => value?.nativeTag ?? null, Platform: { OS: platform, Version: options.version ?? 26 }, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 900, width: 400 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'light' }) }, '../shared/themeRuntime': { themeController: { variant: 'white' } },
    './AdminTextFields.android': { AdminBasicTextField: component('BasicTextField') }, './AdminTypography.android': { AdminText: 'Text' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' },
    './AdminItemCreateNative.android': { ItemCreateIcon: 'ItemCreateIcon', itemCreateRounded: radius => ({ radius }) }, './adminItemCreateModel': source.model, './dartJsonString': source.strings, './adminItemCreatePickerPresentation': pickerPresentation,
    './useAdminPresentationWindow': windowHook, './adminPresentationWindowTicket': { createAdminPresentationWindowTicket: () => `item-create-test:${++ticket}` } };
  const module = base.compile(path.resolve(__dirname, `../src/admin/AdminItemCreate${kind}.${platform}.tsx`), mocks);
  return { ...fixture, r, scrolls, render: () => r.render(() => base.expand(module[`AdminItemCreate${kind}`]({ model: fixture.model, observer, bottomPadding: options.bottomPadding === undefined ? 439 : options.bottomPadding }))) };
}
function pickerModel(kind = 'customer', state = {}, rows = []) {
  const fixture = catalogModel(); fixture.model.state.picker = { id: 1, kind, controller: { sortedItems: rows } };
  fixture.model.state.pickerState = { query: '', searchDraft: '', loading: false, loadingMore: false, error: null, closing: false, runningEmptyAction: false, ...state };
  Object.assign(fixture.model.state.picker.controller, { getSnapshot: () => fixture.model.state.pickerState, interactionGeneration: 1, isCurrent: generation => generation === 1, completeClose: () => fixture.calls.push('complete') });
  fixture.model.owner.controller.getSnapshot = () => fixture.model.state; return fixture;
}
module.exports = { ...source, ...base, model, card, nativeId, text, colors, catalogModel, leaf, pickerModel, pickerPresentation };
