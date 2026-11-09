const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString');
const inputModel = load('admin/openingWipInput', { './dartJsonString': dart });
const workerBatch = load('workerOpeningWip', { './workerControlsApi': controls });
const workerRecord = load('workerOpeningWipRecordsApi', { './authorizedFetch': {}, './workerControlsApi': controls, './workerOpeningWip': workerBatch });
const session = { token: 'mock' }, batch = { quantity_basis: 'measured', finished_goods_meter: 125, finished_goods_kg: 12, bobina_kg: 1 };
const input = { idempotency_key: ' key ', order_id: ' order ', source_apparatus: ' apparatus:default:a ',
  source_stage_node_id: ' stage ', batches: [batch] };
const record = { intake: { intake_id: 'i', actor: { role: 'admin', ref_: 'a', display_name: 'Admin' } },
  batches: [{ batch_id: 'b', quantity_basis: 'estimated', quantity: 2.5 }] };
function fixture() {
  let response = new Response('{}', { status: 200 }), onSend; const calls = [];
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': { authorizedFetch: async (account, url, init, guard) => {
    calls.push({ account, url, init, guard }); guard?.(); if (onSend) await onSend(guard); return response;
  } }, '../workerControlsApi': controls, '../shared/mobileApiException': exception });
  const api = load('admin/openingWipApi', { './adminProductionRequest': request, '../shared/mobileApiException': exception,
    '../workerOpeningWipRecordsApi': workerRecord, './dartJsonString': dart, './openingWipInput': inputModel });
  return { ...api, calls, setResponse: value => { response = value; }, onSend: value => { onSend = value; } };
}
// Tests below follow f119 source; the separate Flutter oracle is blocked by the recorded SQLite hash mismatch.
test('opening WIP input preserves ordered rolls, optional diameter and Dart-trimmed note', () => {
  assert.deepEqual(inputModel.openingWipBatchInputToJson(batch), batch);
  const value = inputModel.openingWipCreateInputToJson({ ...input, idempotency_key: '\u0085 key \u0085', note: '\u0085 note \u0085',
    batches: [batch, { ...batch, quantity_basis: 'unknown', diameter: 0, finished_goods_meter: -1 }] });
  assert.deepEqual(value, { idempotency_key: 'key', order_id: 'order', source_apparatus: 'apparatus:default:a', source_stage_node_id: 'stage',
    note: 'note', batches: [batch, { ...batch, quantity_basis: 'unknown', diameter: 0, finished_goods_meter: -1 }] });
  assert.equal(Object.hasOwn(inputModel.openingWipCreateInputToJson({ ...input, note: ' \u0085 ' }), 'note'), false);
  for (const key of ['finished_goods_meter', 'finished_goods_kg', 'bobina_kg', 'diameter'])
    assert.throws(() => inputModel.openingWipBatchInputToJson({ ...batch, [key]: Infinity }), TypeError);
});
test('create sends source-shaped body and reuses existing Worker record parser', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify({ record }), { status: 200 }));
  const result = await f.adminCreateOpeningWip(session, input);
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/opening-wip'); assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), inputModel.openingWipCreateInputToJson(input));
  assert.equal(result.intake.intake_id, 'i'); assert.equal(result.intake.actor_ref, 'a'); assert.equal(result.batches[0].quantity_basis, 'estimated');
  const before = f.calls.length;
  await assert.rejects(f.adminCreateOpeningWip(session, { ...input, batches: [{ ...batch, bobina_kg: NaN }] }), TypeError);
  assert.equal(f.calls.length, before);
});
test('create retains source missing-record error and non-200 shared-parser limitations', async () => {
  const f = fixture(); f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminCreateOpeningWip(session, input), error => error instanceof exception.MobileApiException &&
    error.code === 'opening_wip_create' && error.message === 'Opening WIP yaratilmadi');
  f.setResponse(new Response(JSON.stringify({ error: 'opening_wip_conflict' }), { status: 409 }));
  await assert.rejects(f.adminCreateOpeningWip(session, input), error => error.code === 'opening_wip_conflict' && error.statusCode === 409);
});
test('QR report rejects an empty Dart-trimmed value, sends a trimmed payload and preserves missing-record text', async () => {
  const f = fixture(); await assert.rejects(f.adminOpeningWipQrReport(session, '\u0085  \u0085'), error => error.code === 'opening_wip_qr_not_found');
  assert.equal(f.calls.length, 0); f.setResponse(new Response(JSON.stringify({ record }), { status: 200 }));
  const result = await f.adminOpeningWipQrReport(session, '\u0085 QR:1 \u0085');
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/opening-wip/qr/report');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { qr_payload: 'QR:1' }); assert.equal(result.batches[0].batch_id, 'b');
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminOpeningWipQrReport(session, 'QR'), error => error.code === 'opening_wip_qr_not_found' && error.message === 'Opening WIP QR topilmadi');
});
test('guard invalidation after response or body failures cannot publish an old-session result', async () => {
  const f = fixture(); let allowed = true; const guard = () => { if (!allowed) throw new Error('scope changed'); };
  f.onSend(async () => { allowed = false; });
  await assert.rejects(f.adminCreateOpeningWip(session, input, guard), /scope changed/);
  allowed = true; f.onSend(null); f.setResponse({ status: 200, async json() { allowed = false; return { record }; } });
  await assert.rejects(f.adminOpeningWipQrReport(session, 'QR', guard), /scope changed/);
  allowed = true; f.setResponse({ status: 200, async json() { allowed = false; throw new Error('malformed old body'); } });
  await assert.rejects(f.adminCreateOpeningWip(session, input, guard), /scope changed/);
});


test('a stale guard wins before local validation and no request is prepared', async () => {
  const f = fixture(), guard = () => { throw new Error('scope changed'); };
  await assert.rejects(f.adminCreateOpeningWip(session, { ...input, batches: [{ ...batch, bobina_kg: NaN }] }, guard), /scope changed/);
  await assert.rejects(f.adminOpeningWipQrReport(session, '', guard), /scope changed/); assert.equal(f.calls.length, 0);
});
