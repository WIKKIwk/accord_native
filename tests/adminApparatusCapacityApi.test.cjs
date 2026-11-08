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
  } }, '../workerControlsApi': controls, '../shared/mobileApiException': exception, './apparatusCapacityModel': model, './dartJsonString': dart });
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


test('downtime mutation validates first and sends the complete V2-shaped body without changing ID spelling', async () => {
  const f = fixture(), downtime = model.apparatusDowntimeFromJson({ id: 'd', apparatus_id: id, apparatus: 'Machine', starts_at_unix: 10,
    ends_at_unix: 20, reason: ' reason ', active: false, actor: { role: 'admin', ref: 'u', display_name: 'User' }, created_at_unix: 5 });
  const invalid = { ...downtime, apparatus_id: 'bad' };
  await assert.rejects(f.adminSaveApparatusDowntime(session, invalid), e => e.code === 'apparatus_id_invalid'); assert.equal(f.calls.length, 0);
  f.setResponse(new Response(JSON.stringify({ downtime: { ...model.apparatusDowntimeToJson(downtime), apparatus_id: id } }), { status: 200 }));
  const saved = await f.adminSaveApparatusDowntime(session, { ...downtime, apparatus_id: ` ${id} ` });
  assert.equal(saved.apparatus_id, id); assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/capacity/downtime');
  assert.equal(f.calls[0].init.method, 'POST'); assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { ...model.apparatusDowntimeToJson(downtime), apparatus_id: ` ${id} ` });
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminSaveApparatusDowntime(session, downtime), e => e.code === 'apparatus_downtime_invalid_response' && e.message === 'Aparat downtime saqlanmadi');
});
test('schedule cancellation trims only the reservation ID and parses the returned reservation', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify({ reservation: { apparatus_id: id, reservation_id: 'r', status: 'cancelled' } }), { status: 200 }));
  const result = await f.adminCancelApparatusScheduleReservation(session, '\u0085 r \u0085', ' reason ');
  assert.equal(result.status, 'cancelled'); assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/schedule/cancel');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { reservation_id: 'r', reason: ' reason ' });
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminCancelApparatusScheduleReservation(session, ''), e => e.code === 'apparatus_schedule_invalid_response' && e.message === 'Jadval bandi bekor qilinmadi');
  assert.deepEqual(JSON.parse(f.calls.at(-1).init.body), { reservation_id: '', reason: '' });
});

test('mutation guard failures stop mocked sends or discard stale success without pretending it was not sent', async () => {
  const f = fixture(); let allowed = false; const guard = () => { if (!allowed) throw new Error('scope changed'); };
  await assert.rejects(f.adminCancelApparatusScheduleReservation(session, 'r', '', guard), /scope changed/);
  // The mock transport receives the request but invokes the guard before any network send.
  assert.equal(f.calls.length, 1);
  allowed = true; f.onSend(async () => { allowed = false; });
  f.setResponse(new Response(JSON.stringify({ reservation: { apparatus_id: id, reservation_id: 'r' } }), { status: 200 }));
  await assert.rejects(f.adminCancelApparatusScheduleReservation(session, 'r', '', guard), /scope changed/);
  assert.equal(f.calls.length, 2); // Post-send failure does not prove whether the server committed.
});

test('capacity profile PUT uses one supplied V2-shaped key and canonical body, then reconstructs the committed profile', async () => {
  const f = fixture(); let generated = 0;
  const profile = model.apparatusCapacityProfileFromJson({ apparatus_id: id, apparatus: 'Machine', source_revision: 4, capacity_slots: 3,
    capabilities: ['print'], notes: 'local', working_windows: [{ weekday: 1, start_minute: 60, end_minute: 120 }] });
  f.setResponse(new Response(JSON.stringify({ revision: { aasx_sha256: ' hash ', revision: { apparatus_id: id,
    revision_metadata: { revision: 5 }, capacity: { capacity_slots: 6, apparatus: 'Server name',
      availability: { working_windows: [{ weekday: 2, start_minute: 10, end_minute: 30 }] } } } } }), { status: 200 }));
  const result = await f.adminSaveApparatusCapacityProfile(session, { ...profile, apparatus_id: ` ${id} ` },
    { capacity: () => { generated++; return 'mobile:canonical-apparatus:capacity:abc-1'; } });
  assert.equal(generated, 1); assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/capacity');
  assert.equal(f.calls[0].init.method, 'PUT'); assert.equal(f.calls[0].init.headers['idempotency-key'], 'mobile:canonical-apparatus:capacity:abc-1');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { apparatus_id: id, expected_revision: 4, capacity: model.apparatusCanonicalCapacityToJson(profile) });
  assert.equal(result.apparatus, 'Server name'); assert.equal(result.source_revision, 5); assert.equal(result.source_aasx_sha256, 'hash');
  assert.equal(result.capacity_slots, 6); assert.deepEqual(result.working_windows, [{ weekday: 2, start_minute: 10, end_minute: 30 }]);
  assert.deepEqual(result.capabilities, []); assert.equal(result.notes, '');
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminSaveApparatusCapacityProfile(session, profile, { capacity: () => 'mobile:canonical-apparatus:capacity:abc-2' }),
    error => error.code === 'apparatus_capacity_invalid_response' && error.message === 'Aparat profili saqlanmadi');
  const sends = f.calls.length;
  await assert.rejects(f.adminSaveApparatusCapacityProfile(session, profile, { capacity: () => 'bad' }), /idempotency key unavailable/);
  await assert.rejects(f.adminSaveApparatusCapacityProfile(session, { ...profile, apparatus_id: 'bad' }, { capacity: () => { throw new Error('must not run'); } }),
    error => error.code === 'apparatus_id_invalid');
  assert.equal(f.calls.length, sends);
});

test('schedule creation preserves explicit keys, validates candidates and fails closed when generation is unavailable', async () => {
  const f = fixture(), input = { order_id: ' order ', apparatus_id: ` ${id} `, apparatus: ' Machine ', earliest_start_unix: 10,
    duration_minutes: 30, capability_requirements: [{ code: ' PRINT ', min_level: 2 }],
    candidate_apparatuses: [{ apparatus_id: ` ${id} `, apparatus: ' Candidate ' }] };
  f.setResponse(new Response(JSON.stringify({ reservation: { apparatus_id: id, order_id: 'order' } }), { status: 200 }));
  await assert.rejects(f.adminScheduleApparatusOrder(session, input), /Schedule idempotency key unavailable/); assert.equal(f.calls.length, 0);
  await assert.rejects(f.adminScheduleApparatusOrder(session, { ...input, candidate_apparatuses: [{ apparatus_id: 'bad', apparatus: '' }] },
    { schedule: () => { throw new Error('must not run'); } }), error => error.code === 'apparatus_id_invalid'); assert.equal(f.calls.length, 0);
  let generated = 0; const keys = { schedule: order => { generated++; assert.equal(order, 'order'); return 'mobile-schedule:order:123456'; } };
  const result = await f.adminScheduleApparatusOrder(session, input, keys); assert.equal(result.order_id, 'order'); assert.equal(generated, 1);
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/schedule'); assert.deepEqual(JSON.parse(f.calls[0].init.body),
    { order_id: 'order', apparatus_id: id, apparatus: 'Machine', earliest_start_unix: 10, latest_end_unix: null, duration_minutes: 30,
      priority: 0, source: 'admin', reason: '', idempotency_key: 'mobile-schedule:order:123456',
      capability_requirements: [{ code: 'PRINT', min_level: 2 }], candidate_apparatuses: [{ apparatus_id: id, apparatus: 'Candidate' }] });
  f.setResponse(new Response(JSON.stringify({ reservation: { apparatus_id: id, order_id: 'order' } }), { status: 200 }));
  await f.adminScheduleApparatusOrder(session, { ...input, idempotency_key: '\u0085 caller-key \u0085' }, keys);
  assert.equal(generated, 1); assert.equal(JSON.parse(f.calls[1].init.body).idempotency_key, 'caller-key');
  await assert.rejects(f.adminScheduleApparatusOrder(session, input, { schedule: () => 'wrong-format' }), /Schedule idempotency key unavailable/);
  f.setResponse(new Response('{}', { status: 200 }));
  await assert.rejects(f.adminScheduleApparatusOrder(session, { ...input, idempotency_key: 'key' }),
    error => error.code === 'apparatus_schedule_invalid_response' && error.message === 'Aparat jadvali saqlanmadi');
});
