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
test('authorized Material home and Profile are the only drawer destinations', () => {
  const labels = { home: 'Bosh sahifa', profile: 'Profil' }, material = session(['raw_material.assign', 'gscale.print', 'inventory.movement.manage']);
  assert.deepEqual(nav.materialDrawerItems(material, labels).map(item => item.id), ['home', 'profile']);
  for (const platform of ['ios', 'android']) {
    assert.equal(nav.materialRoute('home', platform), `/${platform}-material`);
    assert.equal(nav.materialRoute('profile', platform), `/${platform}-material/profile`);
    for (const id of ['history', 'tasks', 'chat', 'scale', 'assignment', 'inventory']) assert.equal(nav.materialRoute(id, platform), null);
  }
  assert.deepEqual(nav.materialDrawerItems(session(['inventory.movement.manage']), labels), []);
  assert.deepEqual(nav.materialDrawerItems({ ...material, profile: { ...material.profile, role: 'admin' } }, labels), []);
  assert.deepEqual(nav.materialDrawerItems({ ...material, token: '' }, labels), []);
});

test('home target opens Material on both platforms without changing Worker or Preparation targets', () => {
  const material = session(['raw_material.assign']);
  assert.equal(routes.homeTarget(material, 'ios'), '/ios-material'); assert.equal(routes.homeTarget(material, 'android'), '/android-material');
  const worker = { token: 'x', profile: { role: 'aparatchi', ref: 'worker-1' }, capabilities: ['apparatus.queue.read'] };
  assert.equal(routes.homeTarget(worker, 'ios'), '/ios-worker'); assert.equal(routes.homeTarget(worker, 'android'), 'worker');
  const prep = { token: 'x', profile: { role: 'tayyorlov_masteri', ref: 'prep-1' }, capabilities: ['preparation.access'] };
  assert.equal(routes.homeTarget(prep, 'ios'), '/ios-preparation'); assert.equal(routes.homeTarget(prep, 'android'), '/android-preparation');
  assert.equal(routes.homeTarget(material, 'web'), null);
});

test('Expo Router exposes only guarded Material home and Profile entrypoints', () => {
  const walk = (directory, prefix = '.') => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(directory, entry.name), `${prefix}/${entry.name}`)
      : /\.[jt]sx?$/.test(entry.name) ? [`${prefix}/${entry.name}`] : []);
  const keys = walk(path.resolve(__dirname, '../src/app'));
  const context = () => ({ default: () => null }); context.keys = () => keys;
  for (const platform of ['ios', 'android']) {
    const root = getRoutes(context, { platform, skipGenerated: true, ignoreEntryPoints: true, ignoreRequireErrors: true });
    const nodes = [], collect = node => { if (node) { nodes.push(node); node.children?.forEach(collect); } };
    collect(root); const paths = nodes.map(node => node.contextKey).filter(key => typeof key === 'string');
    assert.ok(paths.includes('./index.tsx')); assert.ok(paths.some(key => key.startsWith('./android-preparation/')));
    for (const other of ['ios', 'android']) {
      assert.ok(paths.includes(`./${other}-material/_layout.tsx`)); assert.ok(paths.includes(`./${other}-material/profile.tsx`));
      assert.ok(paths.includes(other === 'ios' ? './ios-material/(home)/index.tsx' : './android-material/index.tsx'));
    }
    assert.equal(paths.some(key => /^\.\/(ios|android)-material\/.*(?:history|tasks|chat|gscale|assignment|inventory)/.test(key)), false);
  }
});
