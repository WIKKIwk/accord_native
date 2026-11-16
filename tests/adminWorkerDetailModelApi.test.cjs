const assert = require('node:assert/strict');
const test = require('node:test');
const { workerModel: m, detail, profile, entry, id, apiFixture } = require('./adminWorkerDetailSupport.cjs');
test('worker/system detail parsers keep strict source fields and preserve untrimmed detail phones', () => {
  assert.deepEqual(detail({ phone: ' \u0085 phone \u0085 ', code_locked: true, code_retry_after_sec: 4 }), {
    id: 'ref', name: 'Loaded name', phone: ' \u0085 phone \u0085 ', avatar_url: '', level: 'Level', code: '123', code_locked: true, code_retry_after_sec: 4 });
  assert.throws(() => detail({ code_retry_after_sec: 1.2 }), TypeError); assert.throws(() => detail({ phone: 5 }), TypeError);
  const system = m.adminWorkerDetailSystemFromJson({ id: 'sys', role: ' Metalayzer ', blocked: true, level: { ignored: true } });
  assert.equal(system.role, 'metalayzer'); assert.equal(system.blocked, true); assert.equal(Object.hasOwn(system, 'level'), false);
  assert.throws(() => m.adminWorkerDetailSystemFromJson({ role: 'unknown' }), /Unsupported/);
  assert.equal(m.adminWorkerDetailWorkerFromJson({ phone: '\u0085 phone \u0085' }).phone, 'phone');
});
test('full profile parses canonical groups/sessions, delegates shared log/batch parsers and deduplicates assigned IDs', () => {
  const value = profile({ assigned_apparatus: [id, ` ${id} `], assigned_groups: [{ apparatus_id: id, worker_ids: ['one', 3], workers: [{ id: 'one', phone: '\u0085 x ' }, null] }],
    active_sessions: [{ apparatus: id, session_id: 5, worker_ref: [1, null], started_at_unix: 2.9, payload_json: ['not-object'] }], recent_batches: [{ marker: 'batch' }], recent_logs: [{ marker: 'log' }] });
  assert.deepEqual(value.assigned_apparatus, [id]); assert.equal(value.assigned_groups[0].start_time, '08:00'); assert.deepEqual(value.assigned_groups[0].worker_ids, ['one']);
  assert.equal(value.assigned_groups[0].workers[0].phone, 'x'); assert.equal(value.active_sessions[0].session_id, '5'); assert.equal(value.active_sessions[0].worker_ref, '[1, null]');
  assert.equal(value.active_sessions[0].started_at_unix, 2); assert.deepEqual(value.active_sessions[0].payload_json, {});
  assert.deepEqual(value.recent_batches, [{ sharedBatch: { marker: 'batch' } }]); assert.deepEqual(value.recent_logs, [{ sharedLog: { marker: 'log' } }]);
  assert.throws(() => profile({ assigned_apparatus: ['legacy-machine'] })); assert.throws(() => profile({ assigned_groups: [{}] }));
  assert.deepEqual(m.adminWorkerDetailApparatusLabels(value, [{ id, name: ' Machine ' }]), ['Machine']);
});
test('current052 Metalayzer branches remain scoped to detail; readonly and mixed source-kind predicates match source', () => {
  assert.equal(m.adminWorkerDetailIsSystem(entry('metalayzer', 'metalayzer')), true);
  assert.equal(m.adminWorkerDetailWarehouseEnabled(entry('metalayzer', 'metalayzer'), false), true); assert.equal(m.adminWorkerDetailWarehouseRole(entry('metalayzer', 'metalayzer')), 'metalayzer');
  assert.equal(m.adminWorkerDetailWarehouseEnabled(entry('metalayzer', 'metalayzer'), true), false);
  assert.equal(m.adminWorkerDetailIsSystem(entry('worker', 'qolipchi')), false); assert.equal(m.adminWorkerDetailWarehouseEnabled(entry('worker', 'qolipchi'), false), true);
  assert.equal(m.adminWorkerDetailIsPreparation(entry('worker', 'tayyorlov_masteri')), true); assert.equal(m.adminWorkerDetailWarehouseEnabled(entry('worker', 'tayyorlov_masteri'), false), false);
  assert.deepEqual(m.adminWorkerDetailWarehouseNames([' Beta ', 'beta', '\u0085 Alpha ', '', 'alpha']), ['Alpha', 'Beta']);
});
test('API live paths preserve source IDs, raw phone payloads and separate normal/system regeneration', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(), calls = [];
  global.fetch = async (url, init) => { calls.push([url, init.method ?? 'GET', init.body ? JSON.parse(init.body) : null]);
    return new Response(JSON.stringify(url.includes('system-users') ? { id: 'sys', role: 'metalayzer' } : {})); };
  await f.api.adminWorkerDetail(f.session, ' raw id '); await f.api.adminWorkerDetailSystem(f.session, 'sys'); await f.api.adminWorkerDetailProfile(f.session, 'ref');
  await f.api.adminWorkerDetailUpdatePhone(f.session, ' raw ', ' raw phone ');
  await f.api.adminWorkerDetailUpdateSystemPhone(f.session, { id: 'sys', role: 'metalayzer', name: 'Name', phone: ' phone ' });
  await f.api.adminWorkerDetailRegenerateCode(f.session, 'ref'); await f.api.adminWorkerDetailRegenerateSystemCode(f.session, 'sys');
  assert.equal(calls[0][0], 'https://server.example/v1/mobile/admin/workers/detail?id=+raw+id+');
  assert.equal(calls[2][0], 'https://server.example/v1/mobile/admin/workers/profile-detail?id=ref');
  assert.deepEqual(calls[3], ['https://server.example/v1/mobile/admin/workers', 'PUT', { id: ' raw ', phone: ' raw phone ' }]);
  assert.deepEqual(calls[4][2], { id: 'sys', role: 'metalayzer', name: 'Name', phone: ' phone ' });
  assert.deepEqual(calls.slice(-2), [['https://server.example/v1/mobile/admin/workers/code/regenerate?id=ref', 'POST', null], ['https://server.example/v1/mobile/admin/system-users/code/regenerate?id=sys', 'POST', null]]);
});
test('normal phone API retains MobileApiException mapping while system and code errors keep Dart Exception wording', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); global.fetch = async () => new Response('{"error":"worker phone already exists"}', { status: 409 });
  await assert.rejects(f.api.adminWorkerDetailUpdatePhone(f.session, 'ref', 'phone'), error => error.code === 'worker phone already exists' && error.message === 'Bu telefon raqami boshqa ishchiga biriktirilgan');
  await assert.rejects(f.api.adminWorkerDetailUpdateSystemPhone(f.session, { id: 'sys', role: 'metalayzer', name: 'N', phone: 'p' }), error => String(error) === 'Exception: Admin system user phone update failed');
  await assert.rejects(f.api.adminWorkerDetailRegenerateCode(f.session, 'ref'), error => String(error) === 'Exception: Admin worker code regenerate failed');
});
test('Dart query encoding leaves tilde and escapes asterisk for raw worker identifiers', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let url;
  global.fetch = async value => { url = value; return new Response('{}'); }; await f.api.adminWorkerDetail(f.session, ' ref~* ');
  assert.equal(url, 'https://server.example/v1/mobile/admin/workers/detail?id=+ref~%2A+');
});
for (const status of [302, 401]) test(`original worker read witness blocks stale ${status} before continuation`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  global.fetch = async () => { sends++; f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/other' } : {} }); };
  await assert.rejects(f.api.adminWorkerDetail(f.session, 'ref', f.guard, f.witness)); assert.equal(sends, 1); assert.deepEqual(f.counts(), { refreshes: 0, joins: 0 });
});
for (const method of ['read', 'phone', 'code']) test(`worker ${method} original guard survives body parsing/rejection and blocks initial traffic when retired`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  const request = () => method === 'read' ? f.api.adminWorkerDetail(f.session, 'ref', f.guard, f.witness) : method === 'phone' ? f.api.adminWorkerDetailUpdatePhone(f.session, 'ref', 'phone', f.guard) : f.api.adminWorkerDetailRegenerateCode(f.session, 'ref', f.guard);
  global.fetch = async () => { sends++; const response = new Response('{}'); response.json = async () => { f.retire(); return {}; }; return response; };
  await assert.rejects(request(), /expired/); await assert.rejects(request(), /expired/); assert.equal(sends, 1);
});
test('worker read joins only independent refresh; mutating retry preserves legacy refresh entry but blocks second write after retirement', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  global.fetch = async () => ++sends === 1 ? new Response('', { status: 401 }) : new Response('{}'); await f.api.adminWorkerDetail(f.session, 'ref', f.guard, f.witness);
  assert.equal(sends, 2); assert.deepEqual(f.counts(), { refreshes: 0, joins: 1 });
  const g = apiFixture(); sends = 0; global.fetch = async () => { sends++; g.retire(); return new Response('', { status: 401 }); };
  await assert.rejects(g.api.adminWorkerDetailRegenerateCode(g.session, 'ref', g.guard)); assert.equal(sends, 1); assert.deepEqual(g.counts(), { refreshes: 1, joins: 0 });
});
