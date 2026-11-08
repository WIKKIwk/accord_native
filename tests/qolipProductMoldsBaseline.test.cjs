const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const stem = 'f11910bb/qolip_product_molds_api_test';
function harness(name) {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const fetch = { authorizedFetch: (value, target, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${value.token}`);
    return replay(new URL(target, value.baseUrl), { ...init, headers });
  } };
  const workerControls = load('workerControlsApi.ts', { './authorizedFetch': fetch, './sessionReadScope': {} });
  const api = load('qolipCatalogApi.ts', { './auth': { activeSessionToken: value => value.token },
    './authorizedFetch': fetch, './workerControlsApi': workerControls });
  return { api, replay, session };
}

test('product molds recording belongs to the selected f119 source', () => {
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(data.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(data.records.length, 3);
});

// @v2-test test/qolip_product_molds_api_test.dart
test('product molds sends the exact code and keeps all 150 recorded molds', async () => {
  const { api, replay, session } = harness('product molds sends the exact code and keeps every returned mold');
  const products = await api.qolipProductMolds(session, ' Zizi ');
  assert.equal(products.length, 150);
  assert.ok(products.every(product => product.code === 'Zizi'));
  replay.assertDone();
});

for (const [code, status, message] of [
  ['product_not_found', 404, 'Mahsulot topilmadi. Mahsulot kodini tekshiring.'],
  ['qolip_store_failed', 500, 'Qoliplarni yuklashda server xatosi. Qayta urinib ko‘ring.'],
]) {
  test(`product molds preserves ${code} and its recorded server message`, async () => {
    const { api, replay, session } = harness(`product molds preserves ${code} and its server message`);
    await assert.rejects(api.qolipProductMolds(session, 'Zizi'), error =>
      error.code === code && error.statusCode === status && error.message === message);
    replay.assertDone();
  });
}
