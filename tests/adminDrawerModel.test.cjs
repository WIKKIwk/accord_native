const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes');
const l10n = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
const model = load('admin/adminDrawerModel', { '../shared/appRoutes': routes, '../shared/localization': l10n });
const session = (role, capabilities) => ({ token: 'test', profile: { role, ref: 'test' }, capabilities });

test('drawer follows route capability filtering and preserves V2 order and localized labels', () => {
  const account = session('admin', ['admin.access', 'production.map.manage', 'admin.settings.read', 'party.supplier.read']);
  const entries = model.adminDrawerDestinations(account, 'en');
  assert.equal(entries[0].routeName, routes.appRoutes.adminHome);
  assert.ok(entries.some(item => item.routeName === routes.appRoutes.adminApparatusSettings));
  assert.ok(entries.some(item => item.routeName === routes.appRoutes.adminTelegram));
  assert.ok(entries.some(item => item.routeName === routes.appRoutes.profile && item.push));
  assert.ok(entries.findIndex(item => item.routeName === routes.appRoutes.adminProductionMapOrders) <
    entries.findIndex(item => item.routeName === routes.appRoutes.adminApparatusSettings));
});

test('catalog-only profile hides restricted entries and sales product drawer opens item creation', () => {
  const custom = session('customer', ['catalog.item.create', 'catalog.item.read', 'catalog.item.bulk_move', 'gscale.print']);
  const entries = model.adminDrawerDestinations(custom, 'uz');
  assert.ok(entries.some(item => item.routeName === routes.appRoutes.adminItemBulkMove));
  assert.ok(entries.some(item => item.routeName === routes.appRoutes.gscaleMode && item.push));
  assert.ok(!entries.some(item => item.routeName === routes.appRoutes.adminTelegram));
  const sales = session('sales_manager', ['sales.access', 'catalog.item.create']);
  assert.ok(model.adminDrawerDestinations(sales, 'uz').some(item => item.routeName === routes.appRoutes.adminItemCreate));
});

test('drawer navigation plan honors current route, forced push, prior destination and home stack', () => {
  const target = { routeName: '/target', push: false };
  assert.equal(model.adminDrawerNavigationPlan('/target', target, '/home', ['/home', '/target']), 'none');
  assert.equal(model.adminDrawerNavigationPlan('/other', { ...target, push: true }, '/home', ['/home', '/target', '/other']), 'push');
  assert.equal(model.adminDrawerNavigationPlan('/target', { ...target, push: true }, '/home', ['/home', '/target']), 'push');
  assert.equal(model.adminDrawerNavigationPlan('/other', target, '/home', ['/home', '/target', '/other']), 'popTo');
  assert.equal(model.adminDrawerNavigationPlan('/other', target, '/home', ['/home', '/other']), 'replace');
  assert.equal(model.adminDrawerNavigationPlan('/home', target, '/home', ['/home']), 'push');
  assert.equal(model.adminDrawerNavigationPlan('/other', target, '/home', ['/other']), 'push');
});
