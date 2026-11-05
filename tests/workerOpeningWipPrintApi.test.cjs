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
function api(fetch) { return load('workerOpeningWipPrintApi', { './authorizedFetch': { authorizedFetch: fetch },
  './workerOpeningWip': { openingWipBatch: row => row } }); }

// V2 tests this method only in test mode; live request and response follow the baseline source.
test('opening WIP print prepares a local label with bounded copies', async () => {
  let request;
  const client = api(async (_session, url, init) => { request = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ ok: true, batch: { batch_id: 'b' },
      print: { status: ' prepared ', epc: 'qr', label_kind: 'progress', gross_qty: 15 } }), { status: 200 }); });
  const result = await client.adminPrintOpeningWip({}, { batch_id: ' b ', qr_payload: ' qr ', driver_url: ' usb://local/// ',
    printer: ' godex ', print_mode: ' label ', print_count: 200, print_transport: 'bluetooth' });
  assert.deepEqual(request, { url: '/v1/mobile/admin/production-maps/opening-wip/print', body: {
    batch_id: 'b', qr_payload: 'qr', driver_url: 'usb://local', printer: 'godex', print_mode: 'label', print_count: 100, print_transport: 'offline' } });
  assert.equal(result.batch.batch_id, 'b');
  assert.equal(result.print_job.epc, 'qr');
  assert.equal(result.print_status, 'prepared');
});

test('opening WIP print requires a returned batch', async () => {
  const client = api(async () => new Response('{"ok":true}', { status: 200 }));
  await assert.rejects(client.adminPrintOpeningWip({}, { batch_id: 'b' }), error => error.code === 'opening_wip_print');
});
