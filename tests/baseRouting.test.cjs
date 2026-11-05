const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { appRoutes: r, homeRoute, homeTarget, canOpenRoute } = loaded.exports;
const session = (role, capabilities = [], ref = 'user') => ({ token: 'token', profile: { role, ref }, capabilities });

// @v2-test test/app_session_capability_test.dart
test('home routing follows V2 capability precedence and role-specific overrides', () => {
  assert.equal(homeRoute(null), '/');
  assert.equal(homeRoute(session('aparatchi', ['apparatus.queue.read'], ' ')), '/');
  for (const [role, caps, expected] of [
    ['werka', ['gscale.print', 'rps.batch.manage'], r.gscaleMode],
    ['admin', ['admin.access', 'gscale.print'], r.adminHome],
    ['customer', ['catalog.item.read', 'gscale.print'], r.adminHome],
    ['customer', ['rezka.split.manage'], r.rezkaSplit],
    ['qolipchi', ['qolip.manage', 'admin.access'], r.qolipHome],
    ['material_taminotchi', ['inventory.movement.manage'], r.materialHome],
    ['rezka_master', ['rezka.master.access', 'admin.access'], r.apparatusQueue],
    ['brigader', ['brigader.access', 'admin.access'], r.brigaderHome],
    ['sales_manager', ['sales.access', 'admin.access'], r.salesHome],
    ['tayyorlov_masteri', ['preparation.access', 'admin.access'], r.preparation],
    ['homashyo_rezkachi', ['raw_material.split', 'admin.access'], r.rawMaterialSplit],
    ['aparatchi', ['apparatus.queue.read'], r.apparatusQueue],
    ['supplier', ['supplier.access'], r.supplierHome],
    ['customer', ['customer.access'], r.customerHome],
    ['boyoqchi', ['boyoqchi.access'], r.boyoqchiHome],
    ['werka', ['werka.access'], r.werkaHome],
    ['aparatchi', [], r.login],
  ]) assert.equal(homeRoute(session(role, caps)), expected, role);
});

// @v2-test test/app_route_capability_test.dart
// @v2-test test/rezka_master_role_test.dart
// @v2-test test/brigader_role_test.dart
test('route guards enforce capability, session and role exceptions', () => {
  assert.equal(canOpenRoute(null, r.profile), true);
  assert.equal(canOpenRoute(null, r.werkaHome), false);
  assert.equal(canOpenRoute(session('werka', ['werka.access']), r.werkaHome), true);
  assert.equal(canOpenRoute(session('supplier', ['supplier.access']), r.werkaHome), false);
  assert.equal(canOpenRoute(session('werka', ['production.map.manage']), r.adminProductionMapOrders), true);
  assert.equal(canOpenRoute(session('tayyorlov_masteri', ['preparation.access']), r.inventoryMovements), true);
  assert.equal(canOpenRoute(session('admin', ['preparation.access']), r.preparationProduction), false);
  assert.equal(canOpenRoute(session('admin', ['qolip.manage']), r.qolipProductTransfer), false);
  assert.equal(canOpenRoute(session('qolipchi', ['qolip.manage']), r.qolipProductTransfer), true);
  assert.equal(canOpenRoute(session('customer', ['raw_material.split']), r.rawMaterialSplit), false);
  assert.equal(canOpenRoute(session('homashyo_rezkachi', ['raw_material.split']), r.rawMaterialSplit), true);
  assert.equal(canOpenRoute(session('brigader', ['brigader.access']), r.adminFactoryMap), true);
  assert.equal(canOpenRoute(session('brigader', ['admin.access']), r.adminFactoryMap), false);
  assert.equal(canOpenRoute(session('rezka_master', ['rezka.master.access']), `${r.apparatusPaddons}?id=1`), true);
  assert.equal(canOpenRoute(session('rezka_master', ['rezka.master.access']), `https://example.test${r.apparatusPaddons}?id=1`), true);
  assert.equal(canOpenRoute(session('rezka_master', ['rezka.master.access']), 'apparatus-paddons?id=1'), false);
  assert.equal(canOpenRoute(session('rezka_master', ['rezka.master.access', 'admin.access']), r.adminProductionMapOrders), false);
  assert.equal(canOpenRoute(session('sales_manager', ['sales.access', 'werka.access']), r.werkaHome), false);
  assert.equal(canOpenRoute(session('admin', ['admin.settings.read']), r.adminPushConfig), true);
  assert.equal(canOpenRoute(session('supplier', ['admin.settings.read']), r.adminPushConfig), false);
  assert.equal(canOpenRoute(session('admin', ['admin.access']), '/unknown'), false);
});

test('only available platform homes are selected', () => {
  const worker = session('aparatchi', ['apparatus.queue.read']);
  assert.equal(homeTarget(worker, 'ios'), '/ios-worker');
  assert.equal(homeTarget(worker, 'android'), 'worker');
  assert.equal(homeTarget(worker, 'web'), null);
  assert.equal(homeTarget(session('supplier', ['supplier.access']), 'ios'), null);
  assert.equal(homeTarget(session('supplier', ['supplier.access']), 'android'), null);
});
