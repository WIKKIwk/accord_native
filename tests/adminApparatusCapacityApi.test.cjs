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
const model = load('admin/apparatusCapacityModel', { '../workerControlsApi': controls, '../shared/mobileApiException': exception, './dartJsonString': dart });
const id = 'apparatus:default:print_1', session = { token: 'mock' };
function fixture() {
  let response = new Response('{}', { status: 200 }), onSend; const calls = [];
  const api = load('admin/apparatusCapacityApi', { '../authorizedFetch': { authorizedFetch: async (account, url, init, guard) => {
    calls.push({ account, url, init, guard }); guard?.(); if (onSend) await onSend(guard); return response;
  } }, '../workerControlsApi': controls, '../shared/mobileApiException': exception, './apparatusCapacityModel': model });
  return { ...api, calls, setResponse: value => { response = value; }, onSend: value => { onSend = value; } };
}
// Mock-only source audit: the f119 Flutter capacity oracle did not run due the documented native-asset hash mismatch.
test('live capacity response reads profiles only, filters non-maps and retains empty other groups', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify({ capacity: [null, 2, { apparatus_id: id, capacity_slots: 4 }],
    downtimes: [{ apparatus_id: id }], reservations: [{ apparatus_id: id }] }), { status: 200 }));
  const result = await f.adminApparatusCapacitySnapshot(session);
  assert.equal(f.calls[0].account, session); assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/capacity');
  assert.equal(f.calls[0].init, undefined); assert.equal(result.profiles.length, 1); assert.equal(result.profiles[0].capacity_slots, 4);
  assert.deepEqual(result.downtimes, []); assert.deepEqual(result.reservations, []);
});
test('invalid root and missing capacity use their source error behavior', async () => {
  const f = fixture(); f.setResponse(new Response('[]', { status: 200 }));
  await assert.rejects(f.adminApparatusCapacitySnapshot(session), TypeError);
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminApparatusCapacitySnapshot(session), error => error instanceof exception.MobileApiException &&
    error.code === 'apparatus_capacity_invalid_response' && error.message === 'Aparat quvvati olinmadi');
  f.setResponse(new Response(JSON.stringify({ capacity: [{ apparatus_id: 'bad' }] }), { status: 200 }));
  await assert.rejects(f.adminApparatusCapacitySnapshot(session), error => error.code === 'apparatus_id_invalid');
});
test('non-200 responses retain code, HTTP status and shared-worker parser behavior', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify({ error: 'capacity_profile_invalid', request_id: 'request-1' }), { status: 409 }));
  await assert.rejects(f.adminApparatusCapacitySnapshot(session), error => error instanceof exception.MobileApiException &&
    error.code === 'capacity_profile_invalid' && error.statusCode === 409 && error.diagnostics.request_id === 'request-1');
  f.setResponse(new Response('bad json', { status: 500 }));
  await assert.rejects(f.adminApparatusCapacitySnapshot(session), error => error.code === 'apparatus_capacity' && error.statusCode === 500);
});
test('optional guard reaches the transport and rejects account/scope changes after response or body parsing', async () => {
  const f = fixture(); let allowed = true, checks = 0; const guard = () => { checks++; if (!allowed) throw new Error('scope changed'); };
  f.setResponse(new Response(JSON.stringify({ capacity: [] }), { status: 200 }));
  await f.adminApparatusCapacitySnapshot(session, guard); assert.equal(f.calls[0].guard, guard); assert.equal(checks, 3);
  f.onSend(async () => { allowed = false; });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
  allowed = true; f.onSend(null); f.setResponse({ status: 200, async json() { allowed = false; return { capacity: [] }; } });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
  allowed = true; f.setResponse({ status: 503, async json() { allowed = false; return {}; } });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
  allowed = true; f.setResponse({ status: 200, async json() { allowed = false; throw new Error('malformed old response'); } });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
  allowed = true; f.onSend(async () => { allowed = false; throw new Error('old network error'); });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
  allowed = true; f.onSend(async retryGuard => { allowed = false; retryGuard(); });
  await assert.rejects(f.adminApparatusCapacitySnapshot(session, guard), /scope changed/);
});
