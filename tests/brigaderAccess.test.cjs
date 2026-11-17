const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), r = routes.appRoutes;
const access = load('brigader/brigaderAccess', { '../shared/appRoutes': routes });
const l10n = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
const deps = { '../shared/appRoutes': routes, '../shared/localization': l10n };
const home = load('admin/adminHomeModel', deps), dock = load('admin/adminDockModel', deps), drawer = load('admin/adminDrawerModel', deps);
const session = (capabilities = ['brigader.access'], role = 'brigader') => ({ token: 'token', baseUrl: 'https://example.invalid', profile: { role, ref: 'leader' }, capabilities });
// V2 AppRouter Brigader branch and brigader_role_test.dart; independent exhaustive source table.
const allowed = ['brigaderHome', 'adminHome', 'adminFactoryMap', 'adminCalculateOrders', 'adminCalculate', 'adminProductionMapTest',
  'adminProductionMapOrders', 'adminSuppliers', 'adminActivity', 'adminItemBulkMove', 'adminOpeningWip', 'adminWipBatches', 'adminNotifications',
  'adminApparatusSettings', 'adminApparatusGroups', 'adminAdditionalSettings', 'adminWarehouses', 'adminFactoryLocations', 'adminRawMaterialSettings',
  'adminRawMaterialRules', 'adminRawMaterialAssignments', 'adminCalculateMaterials', 'adminWorkerSettings', 'adminItemGroupCreate', 'adminCreateHub',
  'adminUserCreate', 'adminSupplierCreate', 'adminCustomerCreate', 'adminCustomerDetail', 'adminWorkerDetail', 'adminWorkerProfileDetail',
  'adminInactiveSuppliers', 'adminItemCreate', 'adminItemDetail', 'adminSupplierDetail', 'adminSupplierItemsView', 'adminSupplierItemsAdd', 'adminWerka',
  'adminQueuePolicies', 'adminApparatusCreate', 'adminProgressQrScan', 'apparatusQueue', 'apparatusWorkInstructions', 'apparatusDailyWork',
  'apparatusPaddons', 'apparatusPaddonDetail', 'inventoryMovements'];
const denied = ['adminRoles', 'adminSettings', 'adminTelegram', 'adminTraining', 'adminEmergencyReset', 'adminServerMonitor', 'adminPushConfig',
  'gscaleMode', 'rezkaSplit', 'supplierHome', 'customerHome', 'qolipHome', 'preparation'];
test('Brigader preserves all 47 source routes and omissions even with stale Admin grants', () => {
  assert.equal(allowed.length, 47);
  for (const caps of [['brigader.access'], ['brigader.access', 'admin.access', 'admin.settings.read', 'role.capability.manage', 'gscale.print', 'rezka.split.manage']]) {
    const actor = session(caps);
    for (const name of allowed) assert.equal(routes.canOpenRoute(actor, r[name]), true, name);
    for (const name of denied) assert.equal(routes.canOpenRoute(actor, r[name]), false, name);
    assert.equal(routes.homeRoute(actor), r.brigaderHome);
  }
  for (const name of allowed) assert.equal(routes.canOpenRoute(session(['admin.access']), r[name]), false, name);
});
test('only real Brigader native sessions reach the new homes; other role admissions remain separate', () => {
  assert.equal(routes.homeTarget(session(), 'android'), '/android-brigader');
  assert.equal(routes.homeTarget(session(), 'ios'), '/ios-brigader');
  assert.equal(routes.homeTarget(session(), 'web'), null);
  for (const actor of [null, session([], 'brigader'), session(['brigader.access'], 'admin'), { ...session(), token: ' ' },
    { ...session(), profile: { role: 'brigader', ref: ' ' } }, { ...session(), token: 'test-mode-token' }]) {
    assert.equal(access.brigaderMayEnter(actor), false);
  }
  assert.equal(routes.homeTarget({ ...session(), token: 'test-mode-token' }, 'ios'), null);
  for (const name of denied) assert.equal(access.brigaderDestinationPath(session(), r[name], 'android'), null);
  assert.equal(access.brigaderDestinationPath(session(), r.profile, 'ios'), '/ios-brigader/profile');
  assert.equal(access.brigaderDestinationPath(session(), '/unknown', 'android'), null);
});
test('reused source models retain 17 actions, 4 shortcuts, 16 drawer rows, 4 dock entries and 5 Create actions', () => {
  const actor = session();
  assert.equal(home.adminHomeTitle(actor, 'en'), 'Brigader');
  assert.equal(home.adminHomeCanLoadSummary(actor), false);
  assert.equal(home.adminHomeActions(actor, 'uz').length, 17);
  assert.deepEqual(home.adminHomeShortcuts(actor, 'uz').map(row => row.routeName), [r.adminFactoryMap, r.adminCalculateOrders, r.adminCalculate, r.adminProductionMapOrders]);
  assert.equal(home.adminHomeCanLoadSummary(session(['brigader.access', 'party.supplier.read'])), true);
  assert.equal(drawer.adminDrawerDestinations(actor, 'uz').length, 16);
  assert.deepEqual(dock.adminDockDestinations(actor, 'uz').map(row => row.id), ['admin-home', 'admin-user', 'admin-create', 'admin-activity']);
  assert.deepEqual(dock.adminDefaultCreateActions(actor, 'uz').map(row => row.routeName), [r.adminUserCreate, r.adminItemCreate, r.adminProgressQrScan, r.adminCalculateOrders, r.adminCalculate]);
  const coverage = access.brigaderRouteCoverage(actor);
  for (const name of allowed) assert.ok(coverage.some(row => row.name === name), name);
  assert.ok(coverage.some(row => row.route === r.adminUserCreate && row.ios === null && row.android === null));
});
test('original Brigader owner rejects late work, role/grant/scope changes, and cannot revive', () => {
  const scope = load('sessionReadScope'), strict = load('shared/camera/synchronousGuard');
  for (const change of [f => { f.current = false; }, f => { f.epoch++; }, f => { f.actor.capabilities = []; },
    f => { f.actor.profile.role = 'admin'; }, f => { f.actor.assigned_warehouses = ['other']; }]) {
    const f = { actor: session(), epoch: 1, current: true }, witness = { session: f.actor };
    const factory = load('brigader/brigaderSession', { '../auth': { activeSessionEpoch: () => f.epoch, activeSessionToken: s => s === f.actor && f.current ? s.token : null,
      isSessionWitnessCurrent: w => w === witness && f.current }, '../sessionReadScope': scope,
      '../shared/camera/synchronousGuard': strict, './brigaderAccess': access });
    const owner = factory.createBrigaderSession(f.actor, witness);
    assert.equal(owner.isCurrent(), true);
    assert.equal(owner.destination(r.adminFactoryLocations, 'ios'), '/ios-brigader/factory-locations');
    owner.deactivate(); assert.equal(owner.isCurrent(), false); assert.equal(owner.destination(r.profile, 'ios'), null);
    assert.equal(owner.activate(), true); // effect replay retains its original account, not another witness
    change(f); assert.equal(owner.isCurrent(), false); f.current = true; f.epoch = 1; f.actor.profile.role = 'brigader'; f.actor.capabilities = ['brigader.access']; f.actor.assigned_warehouses = [];
    assert.equal(owner.activate(), false); assert.equal(owner.isCurrent(), false); assert.equal(owner.destination(r.profile, 'ios'), null);
  }
});
test('drawer observes the real Brigader namespace and excludes Admin and inactive native-tab stacks', () => {
  const state = load('admin/adminDrawerNavigationState');
  const stack = (key, routes, index = routes.length - 1) => ({ key, type: 'stack', index, routes: routes.map(name => ({ name })) });
  const android = { key: 'root', type: 'stack', index: 0, routes: [{ name: 'android-brigader', state: stack('brigader-stack', ['index', 'factory-locations']) }] };
  assert.deepEqual(state.adminDrawerActiveStack(android, 'android', 'brigader'), { key: 'brigader-stack', currentPath: '/android-brigader/factory-locations', paths: ['/android-brigader', '/android-brigader/factory-locations'] });
  assert.equal(state.adminDrawerActiveStack(android, 'android'), null);
  const ios = { key: 'root', type: 'stack', index: 0, routes: [{ name: 'ios-brigader', state: { key: 'tabs', type: 'tab', index: 1,
    routes: [{ name: '(home)', state: stack('home-stack', ['index', 'profile']) }, { name: 'activity', state: stack('activity-stack', ['index']) }] } }] };
  assert.deepEqual(state.adminDrawerActiveStack(ios, 'ios', 'brigader'), { key: 'activity-stack', currentPath: '/ios-brigader/activity', paths: ['/ios-brigader/activity'] });
  assert.equal(state.adminDrawerActiveStack(ios, 'ios'), null);
});
test('child Notice layout replay precedes parent passive replay without retiring the original account', async () => {
  const notice = require('./adminTopNoticeSupport.cjs'), actor = session(), witness = { session: actor };
  const factory = load('brigader/brigaderSession', { '../auth': { activeSessionEpoch: () => 1, activeSessionToken: () => actor.token,
    isSessionWitnessCurrent: w => w === witness }, '../sessionReadScope': load('sessionReadScope'),
    '../shared/camera/synchronousGuard': notice.strict, './brigaderAccess': access });
  const owner = factory.createBrigaderSession(actor, witness); let clears = 0;
  const mount = factory.brigaderSessionLease(owner, () => { clears++; }), release = mount();
  const messenger = new notice.messenger.AdminTopNoticeMessenger({ isCurrent: owner.isCurrent });
  const driver = {}, stopDriver = messenger.attachDriver(driver, false); assert.equal(typeof stopDriver, 'function');
  stopDriver(); release(); // disappear child layout, then disconnect parent passive
  const stopReplayed = messenger.attachDriver(driver, false); // reappear child layout BEFORE reconnect parent passive
  assert.equal(typeof stopReplayed, 'function'); assert.equal(messenger.current(), true);
  const releaseReplayed = mount(); await Promise.resolve();
  assert.equal(messenger.current(), true); assert.equal(clears, 1);
  stopReplayed(); releaseReplayed(); await Promise.resolve();
  assert.equal(owner.isCurrent(), false); assert.equal(messenger.current(), false); assert.equal(clears, 2);
});
