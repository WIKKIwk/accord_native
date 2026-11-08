const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const routes = load('shared/appRoutes'), nav = load('material/materialNavigation', { '../shared/appRoutes': routes });
const session = caps => ({ token: 'x', profile: { role: 'material_taminotchi', ref: 'material-1' }, capabilities: caps });
test('material drawer only routes to implemented safe destinations, without Chat or GScale', () => {
  const items = nav.materialDrawerItems(session(['raw_material.assign', 'gscale.print', 'inventory.movement.manage']), { home: 'Bosh sahifa', profile: 'Profil' });
  assert.deepEqual(items.map(item => item.id), ['home', 'history', 'profile']);
  assert.equal(nav.materialRoute('history', 'ios'), '/ios-material/history');
  assert.equal(nav.materialRoute('history', 'android'), '/android-material/history');
  assert.equal(nav.materialRoute('chat', 'ios'), null); assert.equal(nav.materialRoute('scale', 'android'), null);
  assert.equal(nav.materialDrawerActive('/ios-material/history'), 'history');
  assert.equal(nav.materialDrawerActive('/android-material/profile'), 'profile');
  assert.deepEqual(nav.materialDrawerItems(session(['inventory.movement.manage']), { home: 'Home', profile: 'Profile' }).map(x => x.id), ['home', 'profile']);
});
