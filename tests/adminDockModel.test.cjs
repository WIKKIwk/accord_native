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
const model = load('admin/adminDockModel', { '../shared/appRoutes': routes, '../shared/localization': l10n });
const session = (role, capabilities) => ({ token: 'test', profile: { role, ref: 'test' }, capabilities });

test('admin dock preserves destination order and filters by V2 capability', () => {
  const account = session('admin', ['admin.access', 'party.supplier.read', 'admin.activity.read']);
  const items = model.adminDockDestinations(account, 'uz');
  assert.deepEqual(items.map(item => item.id), ['admin-home', 'admin-user', 'admin-create', 'admin-activity']);
  assert.deepEqual(items.map(item => item.label), ['Uy', 'Foydalanuvchi', 'Qo‘shish', 'Faoliyat']);
  assert.equal(items[2].tab, null); assert.equal(items[2].primary, true);
  assert.equal(model.adminDockPrimaryVisible(items, true, false, false), true);
  assert.equal(model.adminDockPrimaryVisible(items, true, true, false), false);
  assert.equal(model.adminDockPrimaryVisible(items, true, false, true), false);
  assert.equal(model.adminDockPrimaryVisible(items, false, false, false), false);
});

test('explicit primary action remains present even without create-hub route access', () => {
  const account = session('customer', ['catalog.item.read']);
  assert.ok(!model.adminDockDestinations(account, 'uz').some(item => item.primary));
  assert.ok(model.adminDockDestinations(account, 'uz', true).some(item => item.primary));
});

test('dock selection opens primary, preserves current tab and replaces root for other destinations', () => {
  const account = session('admin', ['admin.access', 'party.supplier.read', 'admin.activity.read']);
  const [home, user, create] = model.adminDockDestinations(account, 'uz');
  assert.equal(model.adminDockSelection(create, 'home', '/admin-home', '/admin-home'), 'openCreate');
  assert.equal(model.adminDockSelection(home, 'home', '/admin-home', '/admin-home'), 'none');
  assert.equal(model.adminDockSelection(home, 'home', '/admin-item-detail', '/admin-home'), 'replaceRoot');
  assert.equal(model.adminDockSelection(user, 'home', '/admin-home', '/admin-home'), 'replaceRoot');
});

test('default create actions use V2 order, capability guards and reverse stagger order', () => {
  const account = session('admin', ['admin.access', 'production.map.manage', 'party.customer.manage', 'catalog.item.create']);
  const actions = model.adminDefaultCreateActions(account, 'en');
  assert.deepEqual(actions.map(action => action.routeName), [routes.appRoutes.adminUserCreate, routes.appRoutes.adminItemCreate,
    routes.appRoutes.adminProgressQrScan, routes.appRoutes.adminCalculateOrders, routes.appRoutes.adminCalculate]);
  assert.deepEqual(actions.map(action => action.row), [0, 1, 2, 3, 4]);
  assert.deepEqual(actions.map(action => action.staggerOrder), [4, 3, 2, 1, 0]);
});
