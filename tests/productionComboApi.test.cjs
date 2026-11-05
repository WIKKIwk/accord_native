const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('productionComboApi', { './authorizedFetch': { authorizedFetch: fetch },
  './auth': { activeSessionToken: session => session.active === false ? null : session.token } }); }

// @v2-test test/production_combo_test.dart
test('combo API uses explicit name, stable master id and exact revision catalog lookup', async () => {
  const stem = 'production_combo_test', name = 'combo API uses explicit name, stable master id and exact revision catalog lookup';
  const replay = contractFetch(stem, name, { onlyMethods: ['GET'] }), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  const entry = await client.adminProductionCombo(session, 'COMBO-1-R2');
  assert.deepEqual(entry.template.products.map(item => item.item_code), ['SKU-A', 'SKU-B']);
  assert.equal(entry.template.combo.revision, 2);
  replay.assertDone();
});

test('combo lookup rejects a changed account and mismatched catalog identity', async () => {
  let release;
  const session = { token: 'token', profile: { role: 'admin', ref: 'first' } };
  const client = api(async () => { await new Promise(resolve => { release = resolve; });
    return new Response('{"combo":{"item_code":"ITEM"},"template":{}}', { status: 200 }); });
  const pending = client.adminProductionCombo(session, 'ITEM');
  session.profile.ref = 'second';
  release();
  await assert.rejects(pending, /Combo account changed/);
  const mismatch = api(async () => new Response('{"combo":{"item_code":"OTHER"},"template":{}}', { status: 200 }));
  await assert.rejects(mismatch.adminProductionCombo({ token: 'token' }, 'ITEM'), /Incomplete combo catalog response/);
});
