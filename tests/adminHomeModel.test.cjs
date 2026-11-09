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
const model = load('admin/adminHomeModel', { '../shared/appRoutes': routes, '../shared/localization': l10n });
const session = (role, capabilities) => ({ token: 'test', profile: { role, ref: 'test' }, capabilities });
const store = { loadingSummary: false, loadedSummary: false, summaryError: null };

test('custom catalog role gets capability-filtered actions and no summary request', () => {
  const account = session('customer', ['catalog.item.read', 'catalog.item.create', 'gscale.print', 'rps.batch.manage']);
  assert.equal(model.adminHomeCanLoadSummary(account), false);
  assert.equal(model.adminHomeViewState(account, store), 'actions');
  const actions = model.adminHomeActions(account, 'uz');
  assert.ok(actions.some(action => action.title === 'Mahsulot qo‘shish'));
  assert.ok(actions.some(action => action.title === 'GScale'));
  assert.ok(!actions.some(action => action.routeName === routes.appRoutes.adminSuppliers));
});

test('admin summary view retains loading/error/loaded rules and four ordered shortcuts', () => {
  const account = session('admin', ['admin.access', 'party.supplier.read', 'production.map.manage']);
  assert.equal(model.adminHomeCanLoadSummary(account), true);
  assert.equal(model.adminHomeViewState(account, { ...store, loadingSummary: true }), 'loading');
  assert.equal(model.adminHomeViewState(account, { ...store, summaryError: new Error('offline') }), 'error');
  assert.equal(model.adminHomeViewState(account, { ...store, loadedSummary: true, summaryError: new Error('offline') }), 'shortcuts');
  assert.deepEqual(model.adminHomeShortcuts(account, 'en').map(action => action.title), ['Factory map', 'Quick orders', 'Open order', 'Work map']);
});

test('English action labels use V2 catalog and preserve action order', () => {
  const account = session('customer', ['admin.access', 'catalog.item.read', 'catalog.item.create', 'catalog.item.bulk_move',
    'catalog.item_group.read', 'catalog.item_group.manage', 'production.map.manage', 'raw_material.rule.manage', 'raw_material.assign', 'gscale.print']);
  const titles = model.adminHomeActions(account, 'en').map(action => action.title);
  for (const title of ['Warehouses', 'Quick orders', 'Work map', 'Semi-finished products']) assert.ok(titles.includes(title), title);
  assert.ok(titles.indexOf('Quick orders') < titles.indexOf('Work map'));
  assert.ok(titles.indexOf('Work map') < titles.indexOf('Semi-finished products'));
});

test('sales home hides four V2 actions even if route access is granted and has no action icons', () => {
  const account = session('sales_manager', ['sales.access', 'production.order.create', 'production.order.edit', 'production.map.edit',
    'production.map.read', 'catalog.item.create', 'party.customer.read', 'party.customer.manage']);
  const actions = model.adminHomeActions(account, 'uz');
  assert.equal(model.adminHomeTitle(account, 'en'), 'Sotuv manageri');
  assert.equal(model.adminHomeShowsActionIcons(account), false);
  for (const route of [routes.appRoutes.adminItemCreate, routes.appRoutes.adminUserCreate, routes.appRoutes.adminSuppliers,
    routes.appRoutes.adminProductionMapTest]) assert.ok(!actions.some(action => action.routeName === route));
  assert.ok(actions.some(action => action.routeName === routes.appRoutes.adminCalculateOrders));
  assert.ok(actions.some(action => action.routeName === routes.appRoutes.adminProductionMapOrders));
});
