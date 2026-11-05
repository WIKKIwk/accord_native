const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('preparation order materials retain estimates from the V2 response', async () => {
  const stem = 'preparation_formula_estimates_test', name = 'order 0278 shows its own kg beside shared recipe percentages';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/preparation/order-materials'] }), session = recordedSession(stem, name);
  session.profile = { role: 'tayyorlov_masteri', ref: 'worker' }; session.capabilities = ['preparation.access'];
  const client = load('preparationReadApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } });
  const rows = await client.preparationOrderMaterials(session, ' 0278 ');
  assert.equal(rows[1].estimated_kg, '824.964000'); replay.assertDone();
});
test('preparation scope requires the appropriate role and capability', async () => {
  const client = load('preparationReadApi', { './authorizedFetch': { authorizedFetch: () => { throw Error('unexpected'); } } });
  await assert.rejects(client.preparationOrderMaterials({ profile: { role: 'aparatchi', ref: 'x' }, capabilities: [] }, 'order'), e => e.code === 'forbidden');
});
test('preparation snapshot reads scoped orders and warehouse lists', async () => {
  const stem = 'preparation_formula_estimates_test', name = 'order 0278 shows its own kg beside shared recipe percentages';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/preparation/snapshot'] }), session = recordedSession(stem, name);
  session.profile = { role: 'tayyorlov_masteri', ref: 'worker' }; session.capabilities = ['preparation.access'];
  const client = load('preparationReadApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } });
  const snapshot = await client.preparationSnapshot(session);
  assert.equal(snapshot.orders[0].id, '0278'); assert.equal(snapshot.orders[0].kg, '1000.000000'); replay.assertDone();
});
