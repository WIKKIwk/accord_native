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
function api(fetch) { return load('productionProgressReprintApi', { './authorizedFetch': { authorizedFetch: fetch } }); }
test('WIP reprint uses the saved production completion date', async () => {
  const stem = 'worker_wip_completion_print_test', name = 'WIP reprint uses the saved production completion date';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
  const result = await client.adminProgressQrReprint(session, { qr_payload: '400118DE52D377560B196C52', print_transport: 'bluetooth' });
  assert.equal(result.batch.completed_at_unix, 1792210320);
  assert.equal(result.print_job.completed_at_unix, 1792210320);
  assert.equal(result.print_status, 'prepared');
  replay.assertDone();
});
test('reprint validates identity and bounds printer options', async () => {
  let body;
  const client = api(async (_session, _path, init) => { body = JSON.parse(init.body); return { status: 200, json: async () => ({ ok: true, batch: { apparatus: 'apparatus:default:bosma_7' } }) }; });
  await assert.rejects(client.adminProgressQrReprint({}, { qr_payload: '  ' }), e => e.code === 'progress_batch_not_found');
  const result = await client.adminProgressQrReprint({}, { qr_payload: '', progress_batch_id: ' id ', driver_url: ' https://print/ ', printer: ' p ', print_mode: ' label ', print_count: 1000, automatic_rezka_labels: true });
  assert.deepEqual(body, { progress_batch_id: 'id', driver_url: 'https://print', printer: 'p', print_mode: 'label', print_count: 100, automatic_rezka_labels: true });
  assert.equal(result.print_job, null);
});
