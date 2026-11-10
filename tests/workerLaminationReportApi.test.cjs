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
function api(fetch) { return load('workerLaminationReportApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// @v2-test test/laminatsiya_astatka_api_test.dart
for (const apparatus of ['apparatus:default:asset-007', 'apparatus:default:holodniy_kley']) for (const qty of [0, 2.5]) {
  const quantity = qty === 0 ? '0.0' : '2.5';
  test(`laminatsiya astatka preserves apparatus ${apparatus} and sends remainders and waste ${quantity}`, async () => {
    const stem = 'laminatsiya_astatka_api_test';
    const name = `laminatsiya astatka preserves apparatus ${apparatus} and sends remainders and waste ${quantity}`;
    const replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
    const report = await client.adminLaminatsiyaAstatkaReport(session, { apparatus, order_id: 'zakaz-laminatsiya-astatka',
      lamination_print_leftover_rolls: qty, lamination_film_leftover_rolls: qty, total_waste: qty });
    assert.equal(report.report_id, 'astatka-1');
    assert.equal(report.total_waste, qty);
    assert.equal(report.finished_goods_meter, null);
    assert.equal(report.finished_goods_kg, null);
    assert.equal(report.bobina_kg, null);
    replay.assertDone();
  });
}

test('lamination report validates all metrics and sends positive optional fields', async () => {
  const station = 'apparatus:default:asset-007';
  let calls = 0, sent;
  const client = api(async (_session, _url, init) => {
    calls++; sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ report: { ...sent, babina_kg: 4 } }), { status: 200 });
  });
  const valid = { apparatus: ` ${station} `, order_id: ' order ', lamination_print_leftover_rolls: 0,
    lamination_film_leftover_rolls: 1, total_waste: 2, finished_goods_meter: 3, description: ' text ' };
  for (const bad of [{ total_waste: -1 }, { lamination_film_leftover_rolls: null }, { finished_goods_kg: 0 }, { bobina_kg: Infinity }]) {
    await assert.rejects(client.adminLaminatsiyaAstatkaReport({}, { ...valid, ...bad }), error => error.code === 'laminatsiya_astatka_metrics_required');
  }
  assert.equal(calls, 0);
  const report = await client.adminLaminatsiyaAstatkaReport({}, valid);
  assert.equal(sent.apparatus, station);
  assert.equal(sent.order_id, 'order');
  assert.equal(sent.description, 'text');
  assert.equal(sent.finished_goods_meter, 3);
  assert.equal(report.bobina_kg, 4);
});

test('guarded glue report is stopped before transport and refuses stale responses', async () => {
  const input = { apparatus: 'apparatus:default:holodniy_kley', order_id: 'order', lamination_print_leftover_rolls: 0,
    lamination_film_leftover_rolls: 0, total_waste: 0 };
  let current = false, sends = 0;
  const client = api(async (_session, _url, _init, guard) => {
    guard(); sends++; current = false; return new Response(JSON.stringify({ report: { ...input, report_id: 'saved' } }), { status: 200 });
  });
  await assert.rejects(client.adminLaminatsiyaAstatkaReport({}, input, () => current), /scope/i); assert.equal(sends, 0);
  current = true; await assert.rejects(client.adminLaminatsiyaAstatkaReport({}, input, () => current), /scope/i); assert.equal(sends, 1);
});
