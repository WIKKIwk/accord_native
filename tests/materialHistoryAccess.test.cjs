const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
async function setup(capabilities = ['raw_material.assign']) {
  const chunks = compile('chunkedStorage');
  const auth = compile('auth', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': chunks });
  const session = { token: 'normal', baseUrl: 'https://example.test', imageCacheScope: 'one',
    profile: { role: 'material_taminotchi', ref: 'one' }, capabilities,
    assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: ['one'], assigned_warehouses: [] };
  await auth.saveSession(session);
  const witness = auth.captureSessionWitness(session);
  const access = compile('material/materialHistoryAccess', { '../auth': auth,
    '../shared/appRoutes': compile('shared/appRoutes'), './materialTestSession': compile('material/materialTestSession') });
  return { auth, session, witness, current: () => access.materialHistoryCurrent(session, witness), access };
}

test('history uses the issued current Material witness and preserves token-only refresh', async () => {
  const h = await setup(); assert.equal(h.current(), true);
  h.session.token = 'refreshed'; await h.auth.saveSession(h.session); assert.equal(h.current(), true);
  assert.equal(h.access.materialHistoryCurrent(h.session, { ...h.witness }), false);
  assert.equal(h.access.materialHistoryCurrent({ ...h.session }, h.witness), false);
  assert.equal(h.access.materialHistoryCurrent(h.session, null), false);
});

for (const kind of ['role', 'capability', 'identity', 'apparatus', 'group', 'warehouse', 'server', 'token']) {
  test(`observed ${kind} loss cannot revive a history witness after the value returns`, async () => {
    const h = await setup(), restore = {
      role: () => { h.session.profile.role = 'material_taminotchi'; },
      capability: () => { h.session.capabilities = ['raw_material.assign']; },
      identity: () => { h.session.profile.ref = 'one'; },
      apparatus: () => { h.session.assigned_apparatus = []; },
      group: () => { h.session.assigned_item_groups = ['one']; },
      warehouse: () => { h.session.assigned_warehouses = []; },
      server: () => { h.session.baseUrl = 'https://example.test'; },
      token: () => { h.session.token = 'normal'; },
    };
    const change = {
      role: () => { h.session.profile.role = 'admin'; }, capability: () => { h.session.capabilities = []; },
      identity: () => { h.session.profile.ref = 'two'; }, apparatus: () => { h.session.assigned_apparatus = ['apparatus:default:press']; },
      group: () => { h.session.assigned_item_groups = ['two']; }, warehouse: () => { h.session.assigned_warehouses = ['two']; },
      server: () => { h.session.baseUrl = 'https://other.test'; },
      token: () => { h.session.token = ''; },
    };
    change[kind](); assert.equal(h.current(), false); restore[kind](); assert.equal(h.current(), false);
  });
}

test('tracked same-object scope save and account A to B to A leave the old history witness retired', async () => {
  const h = await setup(); h.session.assigned_item_groups = ['two']; await h.auth.saveSession(h.session);
  assert.equal(h.current(), false);
  h.session.assigned_item_groups = ['one']; await h.auth.saveSession(h.session); assert.equal(h.current(), false);
  const next = { ...h.session, profile: { ...h.session.profile, ref: 'two' } };
  const current = h.auth.captureSessionWitness(h.session); assert.equal(h.access.materialHistoryCurrent(h.session, current), true);
  await h.auth.saveSession(next); await h.auth.saveSession(h.session);
  assert.equal(h.access.materialHistoryCurrent(h.session, current), false);
});

test('history rejects the reserved test token and a Material session without its route capability', async () => {
  const h = await setup(); h.session.token = 'test-mode-token'; assert.equal(h.current(), false);
  const denied = await setup(['inventory.movement.manage']); assert.equal(denied.current(), false);
  const allowed = await setup(['gscale.print']); assert.equal(allowed.current(), true);
});
