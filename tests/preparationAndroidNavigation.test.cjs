const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), loaded = new Module(filename, module);
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}

test('preparation opens Android scale with the shared route parameter contract', () => {
  let route;
  const args = { order: { id: 'o1', code: '42', title: 'Film', order_kg: '10', saved: true }, warehouse: 'Main',
    materialId: 'm1', materialName: 'Raw', formulaVariantId: 'v1', freshForm: true };
  const serializer = load('gscale/gscaleRouteArgs');
  const navigation = load('preparation/preparationNavigation.android', { 'expo-router': { router: { push: value => { route = value; } } },
    '../gscale/gscaleRouteArgs': serializer, './preparationModel': {} });
  navigation.openPreparationScale(args);
  assert.equal(route.pathname, '/android-gscale');
  assert.deepEqual(route.params, serializer.serializeGScaleModeArgs(args));
  assert.deepEqual(serializer.parseGScaleModeArgs(route.params), { ...args, order: { ...args.order, width_mm: null } });
});
