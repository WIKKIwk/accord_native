const assert = require('node:assert/strict');
const test = require('node:test');
const { apiFixture, entry } = require('./adminWorkerDetailSupport.cjs');
test('material catalog converts Dart values, filters invalid microns, preserves active semantics and skips corrupt items', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture();
  const payload = { materials: [null, { id: ' \u0085 one ', name: 12, active: null, density_g_cm3: '1.5', variants: [{ micron: '20', coefficient: '2.4', actual_gsm: 'bad' }, { micron: 12.8 }, { micron: 0 }, 5] },
    { id: 'bad', variants: 'not-list' }, { id: 'off', active: false }] };
  global.fetch = async () => new Response(JSON.stringify(payload)); const items = await f.assignments.adminWorkerDetailMaterials(f.session, f.guard, f.witness);
  assert.equal(items.length, 2); assert.equal(items[0].id, 'one'); assert.equal(items[0].name, '12'); assert.equal(items[0].active, true); assert.equal(items[0].density_g_cm3, 1.5);
  assert.deepEqual(items[0].variants.map(value => value.micron), [20, 12]); assert.equal(items[0].variants[0].coefficient, 2.4); assert.equal(items[0].variants[0].actual_gsm, null); assert.equal(items[1].active, false);
});
test('warehouses adapter retains parser and source limit500; assigned warehouse adapter retains captured guard/witness', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let requested;
  global.fetch = async url => { requested = url; return new Response('[{"warehouse":"Storage","is_group":true,"parent":"Root"}]'); };
  const rows = await f.assignments.adminWorkerDetailWarehouses(f.session, f.guard, f.witness); assert.equal(rows[0].is_group, true); assert.equal(rows[0].parent_warehouse, 'Root');
  assert.equal(requested, 'https://server.example/v1/mobile/admin/warehouses?limit=500');
  assert.deepEqual(await f.assignments.adminWorkerDetailAssignedWarehouses(f.session, entry('metalayzer', 'metalayzer'), f.guard, f.witness), []);
  assert.equal(f.legacy[0][0], f.session); assert.equal(f.legacy[0][1], ''); assert.equal(f.legacy[0][3], f.witness);
  f.retire(); assert.throws(() => f.legacy[0][2](), /expired/);
});
test('preparation adapters preserve GET/POST/DELETE paths, Dart trims and post assignment constructor field selection', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(), calls = [];
  global.fetch = async (url, init) => { calls.push([url, init.method ?? 'GET', init.body ? JSON.parse(init.body) : null]);
    return new Response(JSON.stringify(init.method === 'POST' ? { material_id: '\u0085 id ', material_name: ' Material ', estimated_kg: 99 } : { materials: [null, { material_id: '\u0085 id ', material_name: ' Material ', estimated_kg: '1.2' }] })); };
  const read = await f.assignments.adminWorkerDetailResponsibilities(f.session, '\u0085 ref ', f.guard, f.witness);
  assert.deepEqual(read, [{ material_id: 'id', material_name: 'Material', estimated_kg: '1.2' }]);
  const saved = await f.assignments.adminWorkerDetailAssignResponsibility(f.session, '\u0085 ref ', ' id \u0085', f.guard); assert.deepEqual(saved, { material_id: 'id', material_name: 'Material', estimated_kg: null });
  await f.assignments.adminWorkerDetailUnassignResponsibility(f.session, ' ref ', ' id ', f.guard);
  assert.deepEqual(calls, [['https://server.example/v1/mobile/admin/preparation/responsibilities?principal_ref=ref', 'GET', null],
    ['https://server.example/v1/mobile/admin/preparation/responsibilities', 'POST', { principal_ref: 'ref', material_id: 'id' }],
    ['https://server.example/v1/mobile/admin/preparation/responsibilities?principal_ref=ref&material_id=id', 'DELETE', null]]);
});
test('preparation read alone validates empty ref; non-list materials settle empty; corrupt response maps source fallback without HTTP suffix', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('{"materials":{}}'); };
  await assert.rejects(f.assignments.adminWorkerDetailResponsibilities(f.session, '\u0085 '), error => error.code === 'preparation_invalid' && error.message === 'Foydalanuvchi topilmadi'); assert.equal(sends, 0);
  assert.deepEqual(await f.assignments.adminWorkerDetailResponsibilities(f.session, 'ref'), []);
  global.fetch = async () => new Response('broken'); await assert.rejects(f.assignments.adminWorkerDetailResponsibilities(f.session, 'ref'), error => error.code === 'preparation_request_failed' && error.message === 'Tayyorlov ma’lumotlari olinmadi. Qayta urinib ko‘ring');
  global.fetch = async () => new Response('{"error":"source message"}', { status: 403 }); await assert.rejects(f.assignments.adminWorkerDetailAssignResponsibility(f.session, '', ''), error => error.code === 'preparation_request_failed' && error.message === 'source message');
});
test('calculate materials failure uses source error/detail fallback and warehouse failure keeps Exception wording', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture();
  global.fetch = async () => new Response('{"error":" code ","detail":" explanation "}', { status: 400 });
  await assert.rejects(f.assignments.adminWorkerDetailMaterials(f.session), error => error.code === 'code' && error.message === 'explanation');
  await assert.rejects(f.assignments.adminWorkerDetailWarehouses(f.session), error => String(error) === 'Exception: Admin warehouses failed');
});
for (const name of ['warehouses', 'materials', 'responsibilities', 'assign', 'unassign']) test(`${name} guards initial dispatch and asynchronous response body completion`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  const request = () => name === 'warehouses' ? f.assignments.adminWorkerDetailWarehouses(f.session, f.guard, f.witness) : name === 'materials' ? f.assignments.adminWorkerDetailMaterials(f.session, f.guard, f.witness) :
    name === 'responsibilities' ? f.assignments.adminWorkerDetailResponsibilities(f.session, 'ref', f.guard, f.witness) : name === 'assign' ? f.assignments.adminWorkerDetailAssignResponsibility(f.session, 'ref', 'material', f.guard) : f.assignments.adminWorkerDetailUnassignResponsibility(f.session, 'ref', 'material', f.guard);
  global.fetch = async () => { sends++; const response = new Response('{}'); response.json = async () => { f.retire(); return {}; }; return response; };
  await assert.rejects(request()); await assert.rejects(request()); assert.equal(sends, 1);
});
for (const status of [302, 401]) test(`responsibility read original witness blocks stale ${status} before redirect/refresh`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = apiFixture(); let sends = 0;
  global.fetch = async () => { sends++; f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} }); };
  await assert.rejects(f.assignments.adminWorkerDetailResponsibilities(f.session, 'ref', f.guard, f.witness)); assert.equal(sends, 1); assert.deepEqual(f.counts(), { refreshes: 0, joins: 0 });
});
