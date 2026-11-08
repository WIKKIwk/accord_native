const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const routes = load('shared/appRoutes'), nav = load('material/materialNavigation', { '../shared/appRoutes': routes });
const session = caps => ({ token: 'x', profile: { role: 'material_taminotchi', ref: 'material-1' }, capabilities: caps });
test('material drawer and every role destination remain disabled until reviewed', () => {
  const items = nav.materialDrawerItems(session(['raw_material.assign', 'gscale.print', 'inventory.movement.manage']), { home: 'Bosh sahifa', profile: 'Profil' });
  assert.deepEqual(items, []);
  for (const platform of ['ios', 'android']) for (const destination of ['home', 'history', 'profile', 'chat', 'scale']) {
    assert.equal(nav.materialRoute(destination, platform), null);
  }
  assert.deepEqual(nav.materialDrawerItems(session(['inventory.movement.manage']), { home: 'Home', profile: 'Profile' }), []);
});

test('no Material Expo entrypoint exists for either platform or deep link', () => {
  for (const platform of ['ios', 'android']) {
    assert.equal(fs.existsSync(path.resolve(__dirname, `../src/app/${platform}-material`)), false);
  }
});

test('Expo Router manifests contain no Material role entrypoint on iOS or Android', () => {
  const walk = (directory, prefix = '.') => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(directory, entry.name), `${prefix}/${entry.name}`)
      : /\.[jt]sx?$/.test(entry.name) ? [`${prefix}/${entry.name}`] : []);
  const keys = walk(path.resolve(__dirname, '../src/app'));
  const context = () => ({ default: () => null }); context.keys = () => keys;
  for (const platform of ['ios', 'android']) {
    const root = getRoutes(context, { platform, skipGenerated: true, ignoreEntryPoints: true, ignoreRequireErrors: true });
    const nodes = [], collect = node => { if (node) { nodes.push(node); node.children?.forEach(collect); } };
    collect(root); assert.ok(nodes.some(node => node.contextKey === './index.tsx'));
    assert.ok(nodes.some(node => typeof node.contextKey === 'string' && node.contextKey.startsWith('./android-preparation/')));
    assert.equal(nodes.some(node => typeof node.contextKey === 'string' && /^\.\/(ios|android)-material\//.test(node.contextKey)), false);
    assert.equal(nodes.some(node => typeof node.route === 'string' && /^(ios|android)-material(?:\/|$)/.test(node.route)), false);
  }
});
