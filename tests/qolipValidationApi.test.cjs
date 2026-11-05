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
test('automatic qolip validation preserves physical readiness', async () => {
  const stem = 'qolip_start_settings_api_test', name = 'requirements explicitly opt in and retain physical readiness';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('qolipValidationApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const result = await client.adminValidateProductionMapQolipDetails(session, { apparatus: 'apparatus:default:bosma_7', order_id: 'zakaz-scan-bootstrap', qolip_code: '', automatic_confirmation: true });
  assert.equal(result.policy_revision, 3);
  assert.equal(result.required_qolips.length, 2);
  replay.assertDone();
});
test('missing qolip returns the requested code in nonautomatic mode', async () => {
  let body;
  const client = load('qolipValidationApi', { './authorizedFetch': { authorizedFetch: async (_s, _p, init) => { body = JSON.parse(init.body); return { status: 200, json: async () => ({ ok: true }) }; } } });
  const result = await client.adminValidateProductionMapQolipDetails({}, { apparatus: 'apparatus:default:bosma_7', order_id: ' order ', qolip_code: ' MOLD1 ' });
  assert.deepEqual(body, { apparatus: 'apparatus:default:bosma_7', order_id: 'order', qolip_code: 'MOLD1' });
  assert.equal(result.qolip_code, 'MOLD1');
});
