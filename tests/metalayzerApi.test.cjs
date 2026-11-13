const assert = require('node:assert/strict');
const fs = require('node:fs'); const Module = require('node:module'); const path = require('node:path');
const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths; loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup() {
  const session = { baseUrl: 'https://example.com', token: 'valid', profile: { role: 'metalayzer', ref: 'worker' },
    capabilities: ['metalayzer.access'], assigned_apparatus: [] };
  let current = session, response = { barcode: 'ABC', item_name: 'Film', qty: 12.5, is_metalayzer: false }, status = 200;
  const requests = [];
  const api = load('metalayzer/metalayzerApi', {
    '../auth': { currentSession: () => current, captureSessionWitness: session => ({ session }), isSessionWitnessCurrent: w => w && w.session === current },
    '../sessionReadScope': { sessionReadScope: s => JSON.stringify([s.baseUrl, s.profile, s.capabilities]) },
    '../shared/mobileApiException': load('shared/mobileApiException'),
    '../authorizedFetch': { authorizedFetch: async (s, url, init, guard) => { guard(); requests.push({ url, init });
      return { status, json: async () => response }; } },
  });
  return { api, session, requests, change: value => { current = value; }, reply: (value, code = 200) => { response = value; status = code; } };
}
test('Metalayzer login profile is accepted', () => {
  const { profileFromLogin } = load('authenticateAccount', { 'expo/fetch': {}, './workerControlsApi': { isCanonicalApparatusId: () => true } });
  assert.equal(profileFromLogin({ profile: { role: 'metalayzer', ref: 'worker' }, capabilities: ['metalayzer.access'] }).role, 'metalayzer');
});
test('lookup and completion use the V2 requests and validate returned state', async () => {
  const h = setup();
  const result = await h.api.metalayzerMaterial(h.session, ' ABC ');
  assert.equal(result.itemName, 'Film'); assert.equal(result.isMetalayzer, false);
  assert.equal(h.requests[0].url, '/v1/mobile/metalayzer/material?barcode=ABC');
  h.reply({ barcode: 'abc', qty: 12.5, is_metalayzer: true });
  assert.equal((await h.api.metalayzerComplete(h.session, 'ABC')).isMetalayzer, true);
  assert.equal(h.requests[1].url, '/v1/mobile/metalayzer/complete');
  assert.deepEqual(JSON.parse(h.requests[1].init.body), { barcode: 'ABC' });
  h.reply({ barcode: 'ABC', qty: 12.5, is_metalayzer: false });
  await assert.rejects(h.api.metalayzerComplete(h.session, 'ABC'), /tasdiqlanmadi/);
  h.reply({ barcode: 'different', qty: 12.5, is_metalayzer: true });
  await assert.rejects(h.api.metalayzerMaterial(h.session, 'ABC'), /tasdiqlanmadi/);
});
test('invalid data, denied scope and account switching are rejected', async () => {
  const h = setup();
  for (const invalid of [{}, { barcode: 'ABC', qty: 0, is_metalayzer: false }, { barcode: 'ABC', qty: 1, is_metalayzer: 'false' }]) {
    assert.throws(() => h.api.parseMetalayzerMaterial(invalid));
  }
  h.reply({ code: 'not_found', error: 'Topilmadi' }, 404);
  await assert.rejects(h.api.metalayzerMaterial(h.session, 'ABC'), error => error.code === 'not_found' && error.message === 'Topilmadi');
  h.change({ ...h.session }); await assert.rejects(h.api.metalayzerMaterial(h.session, 'ABC'), /huquqi kerak/);
  assert.equal(h.api.formatMetalayzerQuantity(12.3456, ' kg '), '12.3456 kg');
});
test('warehouse assignments still load when a Metalayzer user is assigned', async () => {
  const assignments = [{ warehouse: 'test', principal_role: 'metalayzer', principal_ref: 'worker', display_name: 'Worker' }];
  const catalog = load('shared/catalogApi', { '../authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => assignments }) },
    './mobileApiException': load('shared/mobileApiException'), '../appPreferences': { appPreferences: {} },
    './searchActivityStore': { SearchActivityStore: class {} } });
  assert.deepEqual(await catalog.adminWarehouseAssignments({}), assignments);
});
test('marked material list requests pages and validates the response', async () => {
  const h = setup(), witness = { session: h.session };
  h.reply({ items: [{ barcode: 'ABC', item_name: 'Film', warehouse: 'test', qty: 0, is_metalayzer: true }], next_cursor: 'raw:a' });
  const first = await h.api.metalayzerMaterials(h.session, null, witness, () => true);
  assert.equal(first.items[0].qty, 0);
  assert.equal(first.nextCursor, 'raw:a');
  assert.equal(h.requests[0].url, '/v1/mobile/metalayzer/materials?limit=50');
  h.reply({ items: [], next_cursor: null });
  const last = await h.api.metalayzerMaterials(h.session, first.nextCursor, witness, () => true);
  assert.deepEqual(last, { items: [], nextCursor: null });
  assert.equal(h.requests[1].url, '/v1/mobile/metalayzer/materials?limit=50&cursor=raw%3Aa');
  h.reply({ items: [{ barcode: 'ABC', qty: 12, is_metalayzer: false }], next_cursor: null });
  await assert.rejects(h.api.metalayzerMaterials(h.session, null, witness, () => true), /tasdiqlanmadi/);
  h.reply({ items: [], next_cursor: 'raw:a' });
  await assert.rejects(h.api.metalayzerMaterials(h.session, 'raw:a', witness, () => true), /tasdiqlanmadi/);
  await assert.rejects(h.api.metalayzerMaterials(h.session, null, witness, () => false), /o‘zgargan/);
});
