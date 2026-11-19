/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { load, strings, l10n, deferred, flush } = require('./adminUsersSupport.cjs');
const { runtime, compile, nodes, expand } = require('./adminSupplierDetailViewSupport.cjs');
const strict = load('shared/camera/synchronousGuard');
const domain = load('admin/adminProfileActionController', { '../shared/camera/synchronousGuard': strict, './dartJsonString': strings });
const profile = (url = 'https://images.example/one') => ({ role: 'admin', ref: ' original ref ', avatar_url: url });
function controllerFixture() {
  let valid = true; const reads = [];
  const controller = new domain.AdminProfileActionController({ isCurrent: () => valid,
    load: (dto, current) => { const wait = deferred(); reads.push({ dto, current, ...wait }); return wait.promise; } });
  controller.start(); return { controller, reads, retire: () => { valid = false; } };
}
test('profile action preserves original raw key and prior bytes while the new profile key loads; late old URI cannot replace it', async () => {
  const f = controllerFixture(), p = profile(); assert.equal(domain.adminProfileActionKey(p), 'admin: original ref :https://images.example/one');
  f.controller.update(p); await flush(); f.reads[0].resolve('first'); await flush(); assert.equal(f.controller.getSnapshot().uri, 'first');
  f.controller.update(profile('https://images.example/second')); await flush(); assert.equal(f.controller.getSnapshot().uri, 'first');
  f.controller.update(profile('https://images.example/third')); await flush(); assert.equal(f.reads[1].current(), false);
  f.reads[2].resolve('third'); await flush(); f.reads[1].resolve('late second'); await flush(); assert.equal(f.controller.getSnapshot().uri, 'third');
});
test('source cache revision forces ensureCached for the unchanged key without reopening old request authority', async () => {
  const f = controllerFixture(), p = profile(); f.controller.update(p); f.controller.update(p); await flush(); assert.equal(f.reads.length, 1);
  f.controller.update(p, true); await flush(); assert.equal(f.reads.length, 2); assert.equal(f.reads[0].current(), false);
  f.reads[1].resolve('new cache bytes'); await flush(); assert.equal(f.controller.getSnapshot().uri, 'new cache bytes');
  f.controller.update({ ...p, access_role: 'sales_manager' }); await flush(); assert.equal(f.reads.length, 3);
});
test('empty/error read settles to the source person fallback without a new notice; captured profile does not mutate during read', async () => {
  const f = controllerFixture(), p = profile(); f.controller.update(p); p.avatar_url = 'mutated in place'; await flush(); assert.equal(f.reads[0].dto.avatar_url, 'https://images.example/one');
  f.reads[0].resolve('old image'); await flush(); f.controller.update(profile('new URL')); await flush(); f.reads[1].reject(Error('offline')); await flush(); assert.deepEqual(f.controller.getSnapshot(), { valid: true, uri: null });
});
test('account retirement and detach/StrictMode cannot publish old image bytes or revive old generation', async () => {
  const f = controllerFixture(); f.controller.update(profile()); await flush(); const generation = f.controller.interactionGeneration;
  f.controller.dispose(); f.controller.start(); assert.equal(f.controller.isCurrent(generation), false); f.controller.update(profile()); await flush(); f.reads[0].resolve('detached'); await flush(); assert.equal(f.controller.getSnapshot().uri, null);
  f.retire(); f.reads[1].resolve('retired'); await flush(); assert.deepEqual(f.controller.getSnapshot(), { valid: false, uri: null });
});
function hookFixture(t) {
  const r = runtime(), reads = [], calls = []; let valid = true, focused = true, revision, witnessListener, sheetOpen = false;
  const controller = new domain.AdminProfileActionController({ isCurrent: () => valid, load: (dto, guard) => { const wait = deferred(); reads.push({ dto, guard, ...wait }); return wait.promise; } });
  const props = { session: { profile: profile() }, witness: {}, isCurrent: () => valid, canInteract: () => focused, onProfile: () => calls.push('profile') };
  const hook = load('admin/useAdminProfileAction', { react: r.react,
    '../auth': { subscribeSessionWitness: callback => { witnessListener = callback; return () => {}; } },
    '../components/useAccountSwitcherLauncher': { useAccountSwitcherLauncher: onProfile => ({ hint: 'Actual account hint', onPress: () => { if (!sheetOpen) onProfile(); }, open: () => { if (!sheetOpen) { sheetOpen = true; calls.push('switcher'); } } }) },
    '../shared/camera/synchronousGuard': strict, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } },
    '../shared/profileAvatarRuntime': { subscribeProfileAvatarCache: callback => { revision = callback; return () => { revision = undefined; }; } },
    './adminProfileActionSession': { createAdminProfileActionSession: () => ({ controller, current: () => valid }) } });
  const render = () => r.render(() => hook.useAdminProfileAction(props)); t.after(r.unmount);
  return { r, props, controller, reads, calls, render, focus: value => { focused = value; }, cacheRevision: () => revision(), retire: () => { valid = false; witnessListener(); } };
}
test('actual profile hook uses genuine launcher: hold opens once and release never pushes profile; focus only gates interactions', async t => {
  const f = hookFixture(t); f.render(); const model = f.render(); model.hold(); model.hold(); model.press(); assert.deepEqual(f.calls, ['switcher']);
  f.focus(false); model.press(); model.hold(); assert.equal(model.current(), true); await flush(); f.reads[0].resolve('owned image'); await flush(); assert.equal(f.render().state.uri, 'owned image');
});
test('actual profile hook taps real profile, reacts to shared uploaded-avatar revisions and rejects replaced native handlers', async t => {
  const f = hookFixture(t); f.render(); const first = f.render(); first.press(); assert.deepEqual(f.calls, ['profile']); await flush();
  f.cacheRevision(); await flush(); assert.equal(f.reads.length, 2); assert.equal(f.reads[0].guard(), false);
  f.props.onProfile = () => f.calls.push('new profile'); const second = f.render(); first.press(); second.press(); assert.deepEqual(f.calls, ['profile', 'new profile']);
  f.r.replay(); second.press(); assert.deepEqual(f.calls, ['profile', 'new profile']); f.render().press(); assert.deepEqual(f.calls, ['profile', 'new profile', 'new profile']);
});
test('async/reentrant canInteract and retired witness reject profile/switch while keeping focus distinct from read authority', t => {
  const f = hookFixture(t); f.render(); f.props.canInteract = async () => true; const asyncModel = f.render(); asyncModel.press(); asyncModel.hold(); assert.deepEqual(f.calls, []); assert.equal(asyncModel.current(), true);
  let nested; f.props.canInteract = () => { nested.press(); return true; }; nested = f.render(); nested.press(); assert.deepEqual(f.calls, []);
  f.props.canInteract = () => true; const current = f.render(); f.retire(); current.press(); current.hold(); assert.deepEqual(f.calls, []); assert.equal(current.current(), false);
});
test('shared cache observer reports committed bytes/clear, unsubscribes and cannot change legacy cache result when listener throws', () => {
  const { ProfileAvatarCache } = load('shared/profileAvatarCache', { './profileSessionGuard': load('shared/profileSessionGuard') });
  const cache = new ProfileAvatarCache(), events = [], account = { baseUrl: 'https://erp.example', profile: profile() };
  const remove = cache.subscribe(() => { events.push(cache.get(account)); }); cache.subscribe(() => { throw Error('observer'); });
  cache.clear(); assert.deepEqual(events, []); const uri = cache.remember(account, Uint8Array.of(1)); assert.equal(events[0], uri); cache.clear(); assert.equal(events[1], null); remove(); cache.remember(account, Uint8Array.of(2)); assert.equal(events.length, 2);
});
for (const platform of ['android', 'ios']) test(`${platform} Admin uses the shared profile press target with its real avatar and guarded actions`, () => {
  const clicks = [], model = { state: { valid: true, uri: null }, current: () => true, label: 'Profil', hint: 'Hisoblar', press: () => clicks.push('press'), hold: () => clicks.push('hold') };
  const navigation = require('./support/roleNavigation.cjs');
  const native = { Platform: { OS: platform }, Pressable: 'Pressable', StyleSheet: { create: value => value } };
  const buttons = navigation.load('RoleHeaderButton.tsx', {
    'react-native': native, 'expo-symbols': { SymbolView: 'SymbolView' },
    './roleNavigationMetrics': navigation.metrics, '../../components/useAccountSwitcherLauncher': {},
  });
  const module = compile(path.resolve(__dirname, '../src/admin/AdminProfileAction.tsx'), {
    'react-native': native, 'expo-image': { Image: 'ExpoImage' }, '../shared/navigation/RoleHeaderButton': buttons,
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { onSurface: 'ink', onSurfaceVariant: 'muted' } }) },
    './useAdminProfileAction': { useAdminProfileAction: () => model },
  });
  let target = module.AdminProfileAction({});
  assert.equal(target.type, buttons.RoleProfileButton);
  const press = target.type(target.props);
  assert.equal(press.props.testID, 'admin-profile-account-action');
  assert.equal(press.props.delayLongPress, 500);
  assert.equal(press.props.accessibilityHint, model.hint);
  assert.equal(press.props.style({ pressed: false }).filter(Boolean).at(-1).height, platform === 'android' ? 48 : 44);
  assert.equal(press.props.children.type, 'SymbolView');
  press.props.onPress();
  press.props.onLongPress();
  assert.deepEqual(clicks, ['press', 'hold']);
  model.state.uri = 'data:image/png;base64,AQ==';
  target = module.AdminProfileAction({});
  const image = target.type(target.props).props.children;
  assert.equal(image.type, 'ExpoImage');
  assert.equal(image.props.source.uri, model.state.uri);
  assert.equal(image.props.style.width, 32);
  assert.equal(image.props.style.height, 32);
  assert.equal(image.props.cachePolicy, 'memory');
  model.state.valid = false; assert.equal(module.AdminProfileAction({}), null);
});
for (const changed of ['epoch', 'scope', 'witness', 'parent', 'test-token']) test(`profile action session captures original authority and never revives after ${changed} change`, () => {
  let epoch = 1, scope = 'original', witnessCurrent = true, parent = true; const session = { token: 'real', profile: profile() }, witness = { session };
  const { createAdminProfileActionSession } = load('admin/adminProfileActionSession', {
    '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token, isSessionWitnessCurrent: value => value === witness && witnessCurrent },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/camera/synchronousGuard': strict,
    '../shared/profileAvatarRuntime': { ensureProfileAvatar: async () => null }, './adminProfileActionController': domain });
  const owner = createAdminProfileActionSession(session, witness, () => parent); assert.equal(owner.current(), true);
  if (changed === 'epoch') epoch++; if (changed === 'scope') scope = 'new'; if (changed === 'witness') witnessCurrent = false; if (changed === 'parent') parent = false; if (changed === 'test-token') session.token = 'test-mode-token';
  assert.equal(owner.current(), false); epoch = 1; scope = 'original'; witnessCurrent = true; parent = true; session.token = 'real'; assert.equal(owner.current(), false);
});
