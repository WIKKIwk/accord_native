const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession, testNames } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch }, scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
  return load('workerProgressApi', { './authorizedFetch': auth, './sessionReadScope': scope,
    './workerControlsApi': controls, './workerProgressBatch': batch,
    './productionMapQueueSnapshotApi': { adminProductionMapQueueSnapshot: async (session, options) => {
      assert.equal(options.fresh, true);
      const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/sequence', {});
      const result = await response.json();
      return { maps: [], ...result };
    } } });
}

test('progress history uses the V2 worker query, bounded limit and typed batch', async () => {
  let query;
  const api = apiWith(async (_session, path) => {
    query = new URL(path, 'https://example.test').searchParams;
    return { status: 200, json: async () => ({ batches: [{ apparatus: 'apparatus:default:press', batch_id: 'roll' }] }) };
  });
  const rows = await api.adminProgressQrHistory({ profile: { role: 'aparatchi' } }, { limit: 300 });
  assert.deepEqual(Object.fromEntries(query), { limit: '200' });
  assert.equal(rows[0].batch_id, 'roll');
  assert.equal(rows[0].revision, 1);
});

test('only rezka team history follows cursors and uses local day bounds', async () => {
  const queries = [];
  const api = apiWith(async (_session, path) => {
    const query = new URL(path, 'https://example.test').searchParams;
    queries.push(query);
    return { status: 200, json: async () => ({ batches: [], next_before_batch_id: queries.length === 1 ? 'older' : null }) };
  });
  const day = new Date(2026, 10, 5, 13);
  await assert.rejects(api.adminProgressQrHistory({ profile: { role: 'aparatchi' } }, { rezkaTeamDay: day }), error => error.code === 'forbidden');
  await api.adminProgressQrHistory({ profile: { role: 'rezka_master' } }, { rezkaTeamDay: day, limit: 0 });
  assert.equal(queries[0].get('limit'), '1');
  assert.equal(queries[0].get('from_unix'), String(Math.trunc(new Date(2026, 10, 5).getTime() / 1000)));
  assert.equal(queries[0].get('until_unix'), String(Math.trunc(new Date(2026, 10, 6).getTime() / 1000)));
  assert.equal(queries[1].get('before_batch_id'), 'older');
});

test('a legacy QR response without active-order proof checks the global order control', async () => {
  const requests = [];
  let state = 'frozen';
  const station = 'apparatus:default:press';
  const api = apiWith(async (_session, path, init) => {
    requests.push({ path, body: init.body && JSON.parse(init.body) });
    return { status: 200, json: async () => init.method === 'POST' ? {
      validated_apparatus: station, validated_order_id: 'order',
      batch: { batch_id: 'roll', order_id: 'order', apparatus: station, wip_status: 'waiting', qr_payload: 'QR' },
    } : { sequences: {}, visible_order_ids: {}, queue_states: {}, queue_action_controls: {}, queue_policies: [],
      order_controls: { order: { state } } } };
  });
  const options = { apparatus: station, orderId: 'order', requireActiveOrder: true };
  await assert.rejects(api.adminProgressQrLookup({}, ' QR ', options), error => error.code === 'order_frozen');
  assert.equal(requests[1].path, '/v1/mobile/admin/production-maps/sequence');
  state = 'active';
  assert.equal((await api.adminProgressQrLookup({}, 'QR', options)).batch_id, 'roll');
});

for (const name of testNames('progress_qr_scoped_lookup_test')) {
  test(`QR lookup replays V2: ${name}`, async () => {
    const stem = 'progress_qr_scoped_lookup_test';
    const replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const record = loadContract(stem).find(item => item.test === name);
    const sent = JSON.parse(record.requestBody.text), response = JSON.parse(record.responseBody.text);
    const api = apiWith((s, p, init, guard) => {
      guard?.();
      return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
    });
    const action = () => api.adminProgressQrLookup(session, sent.qr_payload, { apparatus: sent.apparatus, orderId: sent.order_id });
    if (record.status !== 200) {
      await assert.rejects(action(), error => {
        assert.equal(error.code, response.error);
        if (response.error === 'progress_batch_already_used') assert.match(error.message, /allaqachon ishlatilgan/);
        if (response.error === 'progress_batch_in_use') assert.match(error.message, /ishlatilmoqda/);
        if (response.apparatus_name) assert.match(error.message, /Rezka 5 apparatida/);
        return true;
      });
    } else if (name.includes('wrong_apparatus') || name.includes('wrong_order') || name.includes('confirmation: missing')) {
      await assert.rejects(action(), error => error.code === 'progress_qr_validation_missing');
    } else if (name.includes('contradictory authoritative metadata')) {
      const expected = name.includes('route-error') ? 'wip_route_ambiguous' : name.includes('wrong-consumer')
        ? 'progress_batch_not_accepted' : 'wip_route_destination_unresolved';
      await assert.rejects(action(), error => error.code === expected);
    } else {
      const batch = await action();
      assert.equal(batch.batch_id, response.batch.batch_id);
      if (name.includes('lookup preserves authoritative route')) {
        const hasMetadata = Object.hasOwn(response, 'input_route') || Object.hasOwn(response, 'input_route_error');
        assert.equal(batch.has_input_route_metadata, hasMetadata);
        assert.equal(batch.input_route_error, response.input_route_error ?? (hasMetadata ? 'wip_route_destination_unresolved' : ''));
      }
      if (name.includes('route metadata preserves')) {
        assert.equal(batch.input_route.stage_node_id, 'apparatus_6');
        assert.equal(batch.input_route.remapped, true);
      }
    }
    replay.assertDone();
  });
}
