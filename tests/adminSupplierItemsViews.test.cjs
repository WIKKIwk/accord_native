/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');
const modifiers = new Proxy({}, { get: (_object, name) => (...args) => ({ name: String(name), args }) });
function setup(platform, mode = 'add', patch = {}) {
  const runtime = s.runtime(), calls = []; let valid = true, focused = true;
  const state = { valid: true, loading: false, mutating: false, supplierName: 'NEVER VISIBLE', items: [{ code: 'B', name: 'Beta' }, { code: 'A', name: 'Alpha' }], prompt: null, ...patch };
  const model = { state, mode, generation: 1, a: (key, values) => s.l10n.adminText(key, 'uz', values), current: () => valid, interactive: () => valid && focused,
    title: s.l10n.adminText(mode === 'add' ? 'supplier_items.add_title' : 'supplier_items.view_title', 'uz'), empty: s.l10n.adminText(mode === 'add' ? 'supplier_items.empty_available' : 'supplier_items.empty_assigned', 'uz'),
    back: () => calls.push('back'), request: item => { if (valid && focused && !state.mutating) calls.push(item); }, promptCurrent: prompt => valid && state.prompt === prompt,
    confirm: prompt => calls.push(['confirm', prompt]), dismiss: prompt => calls.push(['dismiss', prompt]) };
  const hook = s.load('admin/useAdminSupplierItems', { react: runtime.react, '../shared/camera/synchronousGuard': s.strict, 'expo-router': {}, 'react-native': {}, '../auth': {}, '../shared/localization': s.l10n,
    '../shared/localization/runtime': {}, './adminSupplierItemsSession': {} });
  const component = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  const compose = new Proxy({ Shape: { RoundedCorner: value => value }, TopAppBar: component('TopAppBar', { NavigationIcon: 'TopAppBar.NavigationIcon', Title: 'TopAppBar.Title', Actions: 'TopAppBar.Actions' }) }, { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({}, { get: (_target, name) => String(name) }), transition = { duration: () => transition, easing: () => transition };
  const view = s.compile(path.resolve(__dirname, `../src/admin/AdminSupplierItemsScreen.${platform}.tsx`), {
    react: runtime.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', ScrollView: 'RN.ScrollView', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-reanimated': { default: { View: 'Animated.View' }, View: 'Animated.View', Easing: { cubic: 'cubic', inOut: value => value }, LinearTransition: transition },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(s.colors), './AdminTypography.android': { AdminText: 'Text' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: s.colors }) }, './useAdminSupplierItems': { ...hook, useAdminSupplierItems: () => model },
  });
  const props = { profileAction: { type: 'GenuineProfile', props: {} }, footer: { type: 'GenuineDock', props: {} }, backLabel: 'Orqaga' };
  return { model, calls, runtime, render: () => runtime.render(() => s.expand(view.AdminSupplierItemsScreen(props))), blur: () => { focused = false; }, retire: () => { valid = false; } };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} supplier items Add/View preserve source table headings/order, real profile/dock and no supplier-name subtitle`, () => {
    for (const mode of ['add', 'view']) {
      const f = setup(platform, mode), tree = f.render(), words = s.texts(tree); assert.ok(words.includes(f.model.a('supplier_items.item'))); assert.ok(words.includes(f.model.a('supplier_items.code')));
      assert.ok(words.indexOf('Beta') < words.indexOf('Alpha')); assert.equal(words.includes('NEVER VISIBLE'), false); assert.equal(words.includes(f.model.title), platform === 'android');
      assert.equal(s.nodes(tree, node => node.type === 'View' && node.props.children?.type === 'GenuineDock')[0].props.style.position, 'absolute');
      if (platform === 'ios') assert.equal(s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight().type, 'GenuineProfile');
      s.click(s.byId(tree, 'admin-supplier-items-action-0'), platform); assert.equal(f.calls[0], f.model.state.items[0]);
    }
  });
  test(`${platform} supplier items loading/empty/mutating states add no retry or busy-row spinner`, () => {
    const loading = setup(platform, 'add', { loading: true }), tree = loading.render(); assert.equal(s.nodes(tree, node => node.type === (platform === 'android' ? 'LoadingIndicator' : 'ProgressView')).length, 1);
    assert.equal(s.byId(tree, 'admin-supplier-items-action-0'), undefined);
    const empty = setup(platform, 'view', { items: [] }); assert.ok(s.texts(empty.render()).includes(empty.model.empty));
    const busy = setup(platform, 'view', { mutating: true }), rows = busy.render(), button = s.byId(rows, 'admin-supplier-items-action-0');
    assert.equal(platform === 'android' ? button.props.enabled === false : button.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0]), true);
    assert.equal(s.nodes(rows, node => ['ProgressView', 'CircularProgressIndicator'].includes(node.type)).length, 0); s.click(button, platform); assert.deepEqual(busy.calls, []);
  });
  test(`${platform} supplier item confirmation commits host removal before exact original prompt command; outside cancels`, () => {
    for (const accepted of [true, false]) {
      const prompt = Object.freeze({ serial: 9, item: { code: 'A', name: 'Alpha' } }), f = setup(platform, 'view', { prompt }), tree = f.render();
      assert.ok(s.texts(tree).includes(f.model.a('supplier_items.remove_message', { item: 'Alpha' })));
      assert.ok(s.texts(s.byId(tree, 'admin-supplier-items-confirm')).includes(f.model.a('bulk_move.yes')));
      if (accepted) s.click(s.byId(tree, 'admin-supplier-items-confirm'), platform);
      else if (platform === 'android') s.nodes(tree, node => node.type === 'BasicAlertDialog')[0].props.onDismissRequest(); else s.nodes(tree, node => node.type === 'Pressable')[0].props.onPress();
      assert.deepEqual(f.calls, []); const closed = f.render(); assert.equal(s.byId(closed, 'admin-supplier-items-confirm'), undefined); assert.deepEqual(f.calls, [[accepted ? 'confirm' : 'dismiss', prompt]]);
    }
  });
  test(`${platform} accepted supplier item command survives blur but original retirement/cleanup cannot authorize it`, () => {
    const prompt = Object.freeze({ serial: 1, item: { code: 'A', name: 'Alpha' } }), f = setup(platform, 'add', { prompt }), tree = f.render(); s.click(s.byId(tree, 'admin-supplier-items-confirm'), platform); f.blur(); f.render(); assert.deepEqual(f.calls, [['confirm', prompt]]);
    const stale = setup(platform, 'add', { prompt }), old = stale.render(); s.click(s.byId(old, 'admin-supplier-items-confirm'), platform); stale.retire(); stale.render(); assert.deepEqual(stale.calls, []);
    const detached = setup(platform, 'add', { prompt }), prior = detached.render(); detached.runtime.unmount(); s.click(s.byId(prior, 'admin-supplier-items-confirm'), platform); assert.deepEqual(detached.calls, []);
  });
}
test('Android supplier table preserves3:2 columns,44-wide action and source SoftCard/row padding', () => {
  const tree = setup('android').render(), beta = s.nodes(tree, node => node.type === 'Text' && node.props.children === 'Beta')[0], code = s.nodes(tree, node => node.type === 'Text' && node.props.children === 'B')[0];
  assert.ok(beta.props.modifiers.some(mod => mod.name === 'weight' && mod.args[0] === 3)); assert.ok(code.props.modifiers.some(mod => mod.name === 'weight' && mod.args[0] === 2));
  assert.ok(s.byId(tree, 'admin-supplier-items-action-0').props.modifiers.some(mod => mod.name === 'size' && mod.args[0] === 44));
  assert.ok(s.nodes(tree, node => node.type === 'Row' && node.props.modifiers?.some(mod => mod.name === 'padding' && mod.args.join() === '12,10,12,10')).length);
});
function realHook() {
  const runtime = s.runtime(); let valid = true, focused = true, mutations = 0, backs = 0, write = async () => ({});
  const { AdminSupplierItemsController } = s.load('admin/adminSupplierItemsController', { '../shared/camera/synchronousGuard': s.strict });
  const first = { code: 'A', name: 'Alpha' }, controller = new AdminSupplierItemsController({ mode: 'view', isCurrent: () => valid,
    detail: async guard => { guard(); return { name: 'Supplier', assigned_items: [] }; }, assigned: async (guard, witness) => { guard(); assert.equal(witness(), true); return [first]; },
    all: async () => [], mutate: async (item, guard) => { guard(); assert.equal(item, first); mutations++; return write(); } });
  const owner = { controller, current: () => valid }, props = { session: {}, witness: {}, isCurrent: () => valid, mode: 'view', supplierRef: 'raw', onBack: () => { backs++; } };
  const hook = s.load('admin/useAdminSupplierItems', { react: runtime.react, '../shared/camera/synchronousGuard': s.strict, 'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => runtime.react.useEffect(callback, [callback]) },
    'react-native': { Platform: { OS: 'ios' }, BackHandler: {} }, '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/localization': s.l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminSupplierItemsSession': { createAdminSupplierItemsSession: () => owner } });
  const render = () => runtime.render(() => hook.useAdminSupplierItems(props));
  return { render, runtime, props, controller, first, get mutations() { return mutations; }, get backs() { return backs; }, retire: () => { valid = false; }, focus: value => { focused = value; }, write: value => { write = value; },
    start: async () => { render(); await s.flush(); return render(); } };
}
test('real Supplier Items hook back cancels its original dialog before leaving once; source mutation does not return a changed result', async () => {
  const f = realHook(), model = await f.start(); model.request(f.first); assert.ok(f.controller.getSnapshot().prompt); assert.equal(model.back(), true); assert.equal(f.backs, 0); assert.equal(f.controller.getSnapshot().prompt, null);
  assert.equal(model.back(), true); assert.equal(f.backs, 1); assert.equal(model.back(), false); f.runtime.unmount();
});
test('real Supplier Items hook fences retained actions after blur/StrictMode cleanup without retiring original background authority', async () => {
  const f = realHook(), original = await f.start(); f.focus(false); f.render(); original.request(f.first); original.back(); assert.equal(f.controller.getSnapshot().prompt, null); assert.equal(f.backs, 0); assert.equal(f.controller.isCurrent(), true);
  f.focus(true); f.render(); f.runtime.replay(); await s.flush(); const fresh = f.render(); original.request(f.first); original.back(); assert.equal(f.controller.getSnapshot().prompt, null); assert.equal(f.backs, 0);
  fresh.request(f.controller.getSnapshot().items[0]); assert.ok(f.controller.getSnapshot().prompt); f.runtime.unmount(); fresh.back(); assert.equal(f.backs, 0);
});
test('real Supplier Items hook accepted write settles while parent is blurred; original account retirement cannot update a later owner', async () => {
  for (const retire of [false, true]) {
    const f = realHook(), pending = s.deferred(); f.write(() => pending.promise); const model = await f.start(); model.request(f.first); const prompt = f.controller.getSnapshot().prompt;
    model.confirm(prompt); assert.equal(f.mutations, 1); f.focus(false); f.render(); if (retire) f.retire(); pending.resolve({}); await s.flush();
    assert.equal(f.controller.getSnapshot().valid, !retire); assert.deepEqual(f.controller.getSnapshot().items, []); f.runtime.unmount();
  }
});
test('Supplier Items original host interaction holds new actions but accepted native confirmation keeps its read authority', async () => {
  const f = realHook(); let allowed = true; f.props.canInteract = () => allowed; const model = await f.start(); model.request(f.first); const prompt = f.controller.getSnapshot().prompt;
  allowed = false; model.back(); assert.equal(f.backs, 0); assert.equal(model.current(), true); assert.equal(f.controller.getSnapshot().prompt, prompt);
  model.confirm(prompt); await s.flush(); assert.equal(f.mutations, 1); assert.deepEqual(f.controller.getSnapshot().items, []); f.runtime.unmount();
});
