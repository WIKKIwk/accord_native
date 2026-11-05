const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  return load('apparatusApi', { './authorizedFetch': auth, './workerControlsApi': controls });
}
const station = 'apparatus:default:asset-005';
function projection(overrides = {}) {
  return { apparatus_id: station, source_revision: 7, source_aasx_sha256: 'a'.repeat(64),
    display: { display_name: 'Flexo pechat', catalog_order: 5 }, capabilities: { print: 3, training: 1 },
    execution_profile: { operation: 'print', technology: 'flexographic', color_station_count: 8,
      min_web_width_mm: 400, max_web_width_mm: 800 }, ...overrides };
}

test('apparatus catalog replays V2 GETs and returns the canonical projection', async () => {
  const stem = 'paddon_transfer_test', name = 'paddon list offers transfer only for a cutting worker: cut';
  const route = '/v1/mobile/admin/apparatus';
  const replay = contractFetch(stem, name, { onlyPaths: [route], onlyMethods: ['GET'] });
  const session = recordedSession(stem, name);
  const records = loadContract(stem).filter(item => item.test === name && item.method === 'GET' && new URL(item.url).pathname === route);
  const api = apiWith((s, p, init) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  for (const _record of records) {
    const rows = await api.adminApparatus(session, { limit: 10000 });
    assert.equal(rows[0].id, 'apparatus:default:asset-010');
    assert.equal(rows[0].operation, 'cut');
    assert.equal(rows[0].family, 'rezka');
    assert.equal(rows[0].kind, 'rezka');
  }
  replay.assertDone();
});

test('canonical apparatus model normalizes V2 metadata and rejects display-only payloads', () => {
  const api = apiWith(async () => { throw new Error('unexpected request'); });
  const result = api.apparatusFromJson({ runtime_projection: projection({ worker_material_assignment_allowed: true }) });
  assert.equal(result.id, station);
  assert.equal(result.family, 'pechat');
  assert.equal(result.kind, 'flexo');
  assert.equal(result.color_stations, 8);
  assert.equal(result.min_web_width_mm, 400);
  assert.equal(result.worker_material_assignment_allowed, true);
  assert.deepEqual(result.capabilities, ['print', 'training']);
  assert.equal(api.apparatusFromJson(api.apparatusToJson(result)).worker_material_assignment_allowed, true);
  assert.equal(api.copyApparatus(result, { worker_material_assignment_allowed: false }).worker_material_assignment_allowed, false);
  assert.equal(api.apparatusUsesLaminationWorkflow(' GLUE '), true);
  assert.equal(api.apparatusUsesLaminationWorkflow('print'), false);
  assert.throws(() => api.apparatusFromJson({ id: station, name: 'Flexo' }), /Canonical apparatus/);
  assert.throws(() => api.apparatusFromJson(projection({ source_aasx_sha256: 'A'.repeat(64) })), /Canonical apparatus/);
  assert.throws(() => api.apparatusFromJson(projection({ execution_profile: { operation: 'print' } })), /execution profile/);
});

test('apparatus catalog omits optional query fields and reports malformed rows', async () => {
  let sent, body = [projection()];
  const api = apiWith(async (_session, url) => { sent = url; return new Response(JSON.stringify(body), { status: 200 }); });
  await api.adminApparatus({}, { query: ' Flexo ', limit: 0 });
  assert.deepEqual(Object.fromEntries(new URL(sent, 'https://example.test').searchParams), { q: 'Flexo' });
  body = [projection(), { name: 'legacy' }];
  await assert.rejects(api.adminApparatus({}, {}), error => error.code === 'apparatus_projection_invalid' &&
    error.message.includes('2-qator') && error.details[0] === 'item_index=2');
});

test('apparatus reads retry only when requested and only for transient failures', async () => {
  let attempts = 0;
  const api = apiWith(async () => {
    attempts++;
    return attempts === 1 ? new Response('{"error":"unavailable"}', { status: 503 }) : new Response(JSON.stringify([projection()]), { status: 200 });
  });
  await assert.rejects(api.adminApparatus({}, {}), error => error.code === 'unavailable' && error.statusCode === 503);
  assert.equal(attempts, 1);
  attempts = 0;
  assert.equal((await api.adminApparatus({}, { retryTransient: true })).length, 1);
  assert.equal(attempts, 2);
});

test('transient read retries HTML, but does not retry authorization errors', async () => {
  let attempts = 0, forbidden = false;
  const api = apiWith(async () => {
    attempts++;
    if (forbidden) return new Response('{"error":"forbidden"}', { status: 403 });
    return attempts === 1 ? new Response('<html>temporary</html>', { status: 200, headers: { 'content-type': 'text/html' } })
      : new Response(JSON.stringify([projection()]), { status: 200 });
  });
  assert.equal((await api.adminApparatus({}, { retryTransient: true })).length, 1);
  assert.equal(attempts, 2);
  attempts = 0; forbidden = true;
  await assert.rejects(api.adminApparatus({}, { retryTransient: true }), error => error.code === 'forbidden');
  assert.equal(attempts, 1);
});
