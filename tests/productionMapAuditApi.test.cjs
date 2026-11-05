const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('productionMapAuditApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// V2 has no recorded audit HTTP request; this test follows its source.
test('workflow audit reads counts and trims violation fields', async () => {
  let url;
  const client = api(async (_session, requested) => { url = requested; return new Response(JSON.stringify({ ok: false, total_violations: 25,
    checked_order_count: 1000, checked_batch_count: 3, violations: [null, { code: ' issue ', order_id: ' order ', detail: ' text ' }] }), { status: 200 }); });
  const result = await client.adminProductionMapAudit({});
  assert.equal(url, '/v1/mobile/admin/production-maps/audit');
  assert.equal(result.checked_order_count, 1000);
  assert.equal(result.total_violations, 25);
  assert.deepEqual(result.violations, [{ code: 'issue', order_id: 'order', subject: '', detail: 'text' }]);
});

test('workflow audit rejects non-object responses', async () => {
  const client = api(async () => new Response('[]', { status: 200 }));
  await assert.rejects(client.adminProductionMapAudit({}), error => error.code === 'production_map_audit_invalid_response');
});
