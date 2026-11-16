/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminWorkerDetailSupport.cjs');
const { runtime, compile, expand, nodes, byId } = require('./adminSupplierDetailViewSupport.cjs');
const { load, l10n, strings, deferred, flush, id } = s;
const strict = load('shared/camera/synchronousGuard');
const domain = load('admin/adminWorkerProfileController', { '../shared/camera/synchronousGuard': strict });
const quantity = load('werka/werkaDeliveryPresentation', { '../shared/localization': l10n });
const presentation = load('admin/adminWorkerProfilePresentation', { '../workerControlsApi': s.controls, '../shared/localization': l10n, '../werka/werkaDeliveryPresentation': quantity, './dartJsonString': strings });
function data(patch = {}) { return { worker: { id: ' original ref ', name: 'Worker name', phone: ' phone ', level: 'level', code: '\u0085' }, assigned_apparatus: [], assigned_groups: [], active_sessions: [], recent_batches: [], recent_logs: [], ...patch }; }
test('worker profile keeps all six cards/source rows in order and applies entered fallback only to InfoLine values', () => {
  const cards = presentation.adminWorkerProfileCards(data(), [], 'uz'), a = key => l10n.adminText(key, 'uz');
  assert.deepEqual(cards.map(card => card.title), ['Worker name', a('label.apparatus'), a('detail.worker_groups'), a('detail.active_jobs'), a('detail.progress_batches'), a('detail.logs')]);
  assert.deepEqual(cards[0].rows.map(row => row.label), ['detail.ref', 'profile.phone', 'detail.level', 'detail.item_code'].map(a));
  assert.deepEqual(cards[0].rows.map(row => row.value), ['original ref', 'phone', 'level', a('profile.entered')]);
  assert.deepEqual(cards.slice(1).map(card => card.rows[0].value), ['detail.assigned_none', 'detail.assigned_none', 'detail.active_none', 'detail.batch_none', 'detail.log_none'].map(a));
});
test('canonical apparatus display trims IDs, uses last nonempty name, deduplicates assigned IDs before labels and sorts names', () => {
  const second = 'apparatus:default:second', catalog = [{ id, name: 'Zed' }, { id, name: '  Alpha\u0085' }, { id, name: '  ' }, { id: second, name: 'Alpha' }];
  const cards = presentation.adminWorkerProfileCards(data({ assigned_apparatus: [id, ` ${id} `, second, 'legacy', 'apparatus:default:missing'] }), catalog, 'uz');
  assert.equal(cards[1].rows[0].value, 'Alpha, Alpha, apparatus:default:missing');
});
test('group strings retain empty-time dash and days suffix while active sessions preserve source order/status composition', () => {
  const dto = data({ assigned_groups: [{ apparatus_id: id, group_code: ' G ', shift: '  ', start_time: '', end_time: '', work_days_per_week: 0 }],
    active_sessions: [{ apparatus: id, order_id: ' O ', status: ' status ' }, { apparatus: 'apparatus:default:unknown', order_id: '', status: '' }] });
  const cards = presentation.adminWorkerProfileCards(dto, [{ id, name: 'Press' }], 'uz');
  assert.equal(cards[2].rows[0].label, 'Press'); assert.equal(cards[2].rows[0].value, `G  • - • 0 ${l10n.adminText('worker.day_count', 'uz')}`);
  assert.deepEqual(cards[3].rows, [{ label: 'Press', value: 'O  •  status' }, { label: 'apparatus:default:unknown', value: '•' }]);
});
test('batch output keeps two decimal source formatter, integer/negativezero, optional zero kg/m, exact prefixes and order', () => {
  const dto = data({ recent_batches: [{ order_id: 'One', apparatus: id, status: 'done', produced_qty: 1.5, uom: 'Kg', finished_goods_kg: 0, finished_goods_meter: 2 },
    { order_id: 'Two', apparatus: id, status: '', produced_qty: -0, uom: '', finished_goods_kg: null, finished_goods_meter: null }] });
  const rows = presentation.adminWorkerProfileCards(dto, [{ id, name: 'Press' }], 'uz')[4].rows;
  assert.deepEqual(rows, [{ label: 'One', value: 'Press • done • 1.50 Kg • kg 0 • m 2' }, { label: 'Two', value: 'Press • -0' }]);
});
for (const locale of ['uz', 'ru', 'ur']) test(`log action source mapping/merge localization/unknown fallback and issue suffix ${locale}`, () => {
  const actions = ['start', 'pause', 'detach_roll', 'merge', 'resume', 'roll_complete', 'complete', 'custom action', '  '], keys = ['detail.action_start', 'detail.action_pause', 'detail.action_detach_roll', null, 'detail.action_resume', 'detail.action_roll_complete', 'detail.action_complete'];
  const dto = data({ recent_logs: actions.map(action => ({ apparatus: id, action, order_id: '', from_state: '', to_state: '', completed_with_issue: true })) });
  const rows = presentation.adminWorkerProfileCards(dto, [{ id, name: 'Press' }], locale)[5].rows;
  assert.deepEqual(rows.map(row => row.label), actions.map((action, index) => `${index === 3 ? l10n.productionText('worker.action.merge', locale) : index < 7 ? l10n.adminText(keys[index], locale) : action.trim() || l10n.adminText('detail.action_generic', locale)} • Press`));
  assert.equal(rows[0].value, `→  • ${l10n.adminText('detail.problem_closed', locale)}`);
});
function ownerFixture() {
  let valid = true; const reads = [], catalogs = [];
  const controller = new domain.AdminWorkerProfileController({ isCurrent: () => valid, detail: (guard, witness) => { const wait = deferred(); reads.push({ guard, witness, ...wait }); return wait.promise; },
    apparatus: (guard, witness) => { const wait = deferred(); catalogs.push({ guard, witness, ...wait }); return wait.promise; } });
  return { controller, reads, catalogs, retire: () => { valid = false; } };
}
test('profile detail and catalog start together and commit atomically only when both settle', async () => {
  const f = ownerFixture(); f.controller.start(); await flush(); assert.equal(f.reads.length, 1); assert.equal(f.catalogs.length, 1);
  f.reads[0].resolve(data()); await flush(); assert.equal(f.controller.getSnapshot().phase, 'loading'); f.catalogs[0].resolve([{ id, name: 'Press' }]); await flush();
  assert.equal(f.controller.getSnapshot().phase, 'content'); assert.equal(f.controller.getSnapshot().data.apparatus[0].name, 'Press');
});
test('source non-eager Future.wait failure keeps loading until the other read settles, then retry replaces with full loading', async () => {
  const f = ownerFixture(); f.controller.start(); await flush(); f.reads[0].reject(Error('offline')); await flush(); assert.equal(f.controller.getSnapshot().phase, 'loading');
  f.catalogs[0].resolve([]); await flush(); assert.deepEqual(f.controller.getSnapshot(), { valid: true, phase: 'error', data: null });
  const retry = f.controller.reload(); assert.equal(f.controller.getSnapshot().phase, 'loading'); await flush(); f.reads[1].resolve(data()); f.catalogs[1].resolve([]); await retry; assert.equal(f.controller.getSnapshot().phase, 'content');
});
test('superseded reload/retired account/replayed owner cannot install old results or issue another original guarded read', async () => {
  const f = ownerFixture(); f.controller.start(); await flush(); const firstGen = f.controller.interactionGeneration; const next = f.controller.reload(); await flush();
  assert.throws(f.reads[0].guard, /changed/); f.reads[0].resolve(data({ worker: { name: 'old' } })); f.catalogs[0].resolve([]); await flush(); assert.equal(f.controller.getSnapshot().phase, 'loading');
  f.reads[1].resolve(data()); f.catalogs[1].resolve([]); await next; f.controller.dispose(); f.controller.start(); assert.equal(f.controller.isCurrent(firstGen), false); await flush();
  f.retire(); f.reads[2].resolve(data()); f.catalogs[2].resolve([]); await flush(); assert.equal(f.controller.getSnapshot().valid, false); assert.equal(f.controller.getSnapshot().data, null); await f.controller.reload(); assert.equal(f.reads.length, 3);
});
test('loading subscriber retiring before sends prevents both detail/catalog reads', async () => {
  const f = ownerFixture(); f.controller.subscribe(() => f.retire()); f.controller.start(); await flush(); assert.equal(f.reads.length, 0); assert.equal(f.catalogs.length, 0); assert.equal(f.controller.getSnapshot().valid, false);
});
test('profile session uses raw entry id, profile route capability, genuine catalog limit10000 and captured read witnesses', async () => {
  let valid = true, capability = true; const calls = [], session = { token: 'real' }, entry = { id: ' raw entry id ' }, witness = { session };
  const factory = load('admin/adminWorkerProfileSession', { '../auth': { activeSessionEpoch: () => 1, activeSessionToken: () => session.token, isSessionWitnessCurrent: () => valid },
    '../apparatusApi': { adminApparatus: async (_session, options) => { options.beforeSend(); assert.equal(options.readWitness(), true); calls.push(options.limit); return []; } },
    '../sessionReadScope': { sessionReadScope: () => 'original' }, '../shared/appRoutes': { appRoutes: { adminWorkerProfileDetail: 'profile-route' }, canOpenRoute: (_session, route) => route === 'profile-route' && capability },
    '../shared/camera/synchronousGuard': strict, './adminWorkerDetailApi': { adminWorkerDetailProfile: async (_session, id, guard, readWitness) => { guard(); assert.equal(readWitness(), true); calls.push(id); return data(); } }, './adminWorkerProfileController': domain });
  const owner = factory.createAdminWorkerProfileSession(session, witness, () => true, entry); owner.controller.start(); await flush(); assert.deepEqual(calls, [' raw entry id ', 10000]);
  capability = false; assert.equal(owner.current(), false); capability = true; valid = true; assert.equal(owner.current(), false);
});
function hookFixture(t) {
  const r = runtime(), f = ownerFixture(); let focus = true, notify; const calls = [];
  const props = { session: {}, witness: {}, entry: {}, isCurrent: () => true, onBack: () => calls.push('back') };
  const hook = load('admin/useAdminWorkerProfile', { react: r.react,
    'expo-router': { useIsFocused: () => focus, useFocusEffect: callback => r.react.useEffect(callback, [callback]) }, 'react-native': { Platform: { OS: 'ios' }, BackHandler: {} },
    '../auth': { subscribeSessionWitness: listener => { notify = listener; return () => {}; } }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './adminWorkerProfilePresentation': presentation,
    './adminWorkerProfileSession': { createAdminWorkerProfileSession: () => ({ controller: f.controller, current: () => f.controller.isCurrent() }) } });
  const render = () => r.render(() => hook.useAdminWorkerProfile(props)); t.after(r.unmount);
  return { ...f, r, props, calls, render, focus: value => { focus = value; }, notify: () => notify() };
}
test('actual profile hook keeps owned read through blur; back and refresh require focus and a live original generation', async t => {
  const f = hookFixture(t); f.render(); const first = f.render(); await flush(); f.focus(false); const blur = f.render(); await blur.reload(); blur.back(); assert.deepEqual(f.calls, []); assert.equal(f.reads.length, 1);
  f.reads[0].resolve(data()); f.catalogs[0].resolve([]); await flush(); assert.equal(f.render().cards.length, 6); f.focus(true); f.render().back(); first.back(); assert.deepEqual(f.calls, ['back']);
});
test('actual profile hook retires stale reload/back through StrictMode and changed witness', async t => {
  const f = hookFixture(t); f.render(); const first = f.render(); await flush(); f.r.replay(); await flush(); const fresh = f.render(); first.back(); await first.reload(); assert.deepEqual(f.calls, []); assert.equal(f.reads.length, 2);
  f.retire(); f.notify(); fresh.back(); await fresh.reload(); assert.equal(fresh.current(), false); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().data, null);
});
for (const platform of ['android', 'ios']) test(`${platform} native profile represents six passive cards, real pull refresh/retry, source button and genuine header/dock`, () => {
  const calls = [], model = { state: { valid: true, phase: 'content' }, current: () => true, title: 'Source title', retryLabel: 'Source reload', cards: presentation.adminWorkerProfileCards(data(), [], 'uz'), back: () => calls.push('back'), reload: async () => { calls.push('reload'); } };
  const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) }), ui = new Proxy({ Shape: { RoundedCorner: value => value }, TopAppBar: Object.assign('TopAppBar', {}), List: 'List' }, { get: (target, name) => target[name] ?? String(name) });
  ui.TopAppBar = Object.assign(({ children }) => children, { NavigationIcon: 'NavigationIcon', Title: 'Title', Actions: 'Actions' });
  const module = compile(path.resolve(__dirname, `../src/admin/AdminWorkerProfileScreen.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) }, [`../components/BaseHost.${platform}`]: { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(), './AdminTypography.android': { AdminText: 'Text' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surface: '#ffffff', surfaceContainerHigh: '#eeeeee', surfaceContainerLow: '#dddddd', outlineVariant: '#888888' } }) }, './useAdminWorkerProfile': { useAdminWorkerProfile: () => model } });
  const props = { profileAction: { type: 'GenuineProfile', props: {} }, footer: { type: 'GenuineDock', props: {} }, backLabel: 'Back' };
  let raw = module.AdminWorkerProfileScreen(props), tree = expand(raw); assert.deepEqual(nodes(tree, node => node.type === 'Text').map(node => node.props.children), [...(platform === 'android' ? [model.title] : []), ...model.cards.flatMap(card => [card.title, ...card.rows.flatMap(row => [row.label, row.value])])]); assert.equal(nodes(tree, node => node.type === 'Button').length, 0); assert.equal(nodes(tree, node => node.type === 'GenuineDock').length, 1); if (platform === 'android') assert.equal(nodes(tree, node => node.type === 'GenuineProfile').length, 1); else assert.equal(nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight(), props.profileAction);
  if (platform === 'android') { const scroll = nodes(raw, node => node.type === 'ScrollView')[0]; scroll.props.refreshControl.props.onRefresh(); assert.equal(scroll.props.contentContainerStyle.paddingBottom, 116); }
  else nodes(tree, node => node.type === 'List')[0].props.modifiers.find(mod => mod.name === 'refreshable').args[0]();
  assert.deepEqual(calls, ['reload']); model.state.phase = 'loading'; tree = expand(module.AdminWorkerProfileScreen(props)); assert.equal(nodes(tree, node => ['CircularProgressIndicator', 'ProgressView'].includes(node.type)).length, 1); assert.deepEqual(nodes(tree, node => node.type === 'Text').map(node => node.props.children), platform === 'android' ? [model.title] : []);
  model.state.phase = 'error'; tree = expand(module.AdminWorkerProfileScreen(props)); const retry = byId(tree, 'admin-worker-profile-retry'); retry.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(calls, ['reload', 'reload']);
  model.state.valid = false; assert.equal(module.AdminWorkerProfileScreen(props), null);
});
