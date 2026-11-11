const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, clock } = require('./support/workerQueueTransport.cjs');
const { loadContract } = require('./support/contractFetch.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const fixture = () => JSON.parse(loadContract('worker_list_api_test').find(item => item.test.startsWith('worker HTTP and v2 socket')).responseBody.text);
const session = () => ({ token: 'token', baseUrl: 'https://example.test', profile: { ref: 'worker', role: 'aparatchi' }, capabilities: [],
  assigned_apparatus: ['apparatus:default:bosma_7'], assigned_apparatus_labels: ['Bosma'] });
function harness(fetch) {
  let epoch = 0;
  const load = loader({ './auth': { activeSessionToken: value => value.token }, './authorizedFetch': {
    authorizedFetch: fetch, currentQueueSnapshotReadEpoch: () => epoch, invalidateQueueSnapshotReads: () => epoch++,
  } });
  return { load, api: load('workerQueueReadApi'), invalidate: () => epoch++ };
}
const ok = value => ({ status: 200, json: async () => value });

test('worker snapshot shares only unfinished exact query/cursor reads and returns 304 baseline unchanged', async () => {
  const pending = deferred(), calls = [];
  const h = harness(async (_s, path) => { calls.push(path); return pending.promise; });
  const s = session(), baseline = fixture();
  const a = h.api.loadWorkerQueueSnapshot(s, ' old ', 10, { since: baseline, waitForChanges: true });
  const b = h.api.loadWorkerQueueSnapshot(s, 'old', 10, { since: baseline, waitForChanges: true });
  assert.equal(a, b);
  const url = new URL(calls[0], s.baseUrl);
  assert.equal(url.searchParams.get('projection'), 'worker_list_v1');
  assert.equal(url.searchParams.get('if_rev'), String(baseline.rev));
  assert.equal(url.searchParams.get('if_epoch'), baseline.epoch);
  assert.equal(url.searchParams.get('if_scope'), baseline.scope);
  assert.equal(url.searchParams.get('wait_ms'), '6000');
  pending.resolve({ status: 304 });
  assert.equal(await a, baseline);
  await h.api.loadWorkerQueueSnapshot(s, 'old', 10, { since: baseline, waitForChanges: true });
  assert.equal(calls.length, 2, 'settled reads never certify a new caller');
});

test('fresh and mutation epoch invalidate older queue reads; different windows never join', async () => {
  const calls = [], pending = [];
  const h = harness(async (_s, url) => { calls.push(url); const value = deferred(); pending.push(value); return value.promise; });
  const s = session(), baseline = fixture();
  const a = h.api.loadWorkerQueueSnapshot(s, '', 10);
  h.invalidate();
  const b = h.api.loadWorkerQueueSnapshot(s, '', 10);
  const c = h.api.loadWorkerQueueSnapshot(s, '', 20);
  const d = h.api.loadWorkerQueueSnapshot(s, 'new', 10);
  const fresh = h.api.loadWorkerQueueSnapshot(s, '', 10, { fresh: true, since: baseline, waitForChanges: true });
  assert.equal(calls.length, 5);
  assert.equal(new URL(calls[4], s.baseUrl).searchParams.has('if_rev'), false);
  assert.equal(new URL(calls[4], s.baseUrl).searchParams.has('wait_ms'), false);
  pending.forEach(item => item.resolve(ok(fixture())));
  await Promise.all([a, b, c, d, fresh]);
});

test('queue read exposes terminal status/code/diagnostics and rejects malformed snapshots', async () => {
  for (const status of [401, 403, 503]) {
    const h = harness(async () => ({ status, json: async () => ({ error: status === 503 ? 'unavailable' : 'forbidden', reason: 'test' }) }));
    const errors = h.load('workerQueueReadError');
    await assert.rejects(h.api.loadWorkerQueueSnapshot(session()), error => {
      assert.equal(error.name, 'MobileApiException'); assert.equal(error.statusCode, status);
      assert.equal(error.diagnostics.reason, 'test');
      assert.equal(errors.workerQueueReadCanRetry(error), status === 503);
      return true;
    });
  }
  const h = harness(async () => ok({ projection: 'worker_list_v1' }));
  await assert.rejects(h.api.loadWorkerQueueSnapshot(session()), { code: 'production_map_snapshot_contract_invalid' });
});

test('changed account cannot publish pending queue read; hung read expires at 10s', async () => {
  const pending = deferred(), h = harness(() => pending.promise), s = session();
  const read = h.api.loadWorkerQueueSnapshot(s);
  s.profile.ref = 'new-worker'; pending.resolve(ok(fixture()));
  await assert.rejects(read, /Session changed/);
  const timer = clock();
  try {
    const hang = harness(() => new Promise(() => {}));
    const read = hang.api.loadWorkerQueueSnapshot(session());
    const failure = assert.rejects(read, { name: 'TimeoutError' });
    timer.advance(10_000); await failure;
    assert.equal(timer.pending, 0);
  } finally { timer.restore(); }
});

test('baseline queue loads only catalog and snapshot, fails eagerly without awaiting hung sibling', async () => {
  const calls = [], s = session(), gate = deferred();
  const load = loader({ './auth': { activeSessionToken: value => value.token }, './authorizedFetch': {},
    './workerQueueReadApi': { loadWorkerQueueSnapshot: async () => { calls.push('snapshot'); throw new Error('offline'); } },
    './apparatusApi': { adminApparatus: () => { calls.push('catalog'); return gate.promise; } },
  });
  await assert.rejects(load('workerApi').loadWorkerQueueBaseline(s), /offline/);
  assert.deepEqual(calls, ['snapshot', 'catalog']);
  gate.resolve([]);
});

test('queue HTTP errors retain V2 message, diagnostic fields and header-first request ID', async () => {
  const payload = { error: 'merge_input_frame_count_mismatch', active_kadr_count: 7.9, scanned_kadr_count: 9.9,
    apparatus_options: [' A ', 'B'], blockers: [{ message: ' Blocked ' }], order_title: ' Order ', request_id: 'body' };
  const h = harness(async () => new Response(JSON.stringify(payload), { status: 409, headers: { 'x-request-id': 'header' } }));
  await assert.rejects(h.api.loadWorkerQueueSnapshot(session()), error => {
    assert.equal(error.message, 'Merge qilinmadi: joriy rulon 7 kadr, scan qilingan WIP 9 kadr. Bir xil kadrli WIPni scan qiling');
    assert.equal(error.requestId, 'header'); assert.equal(error.orderTitle, 'Order');
    assert.equal(error.activeKadrCount, 7); assert.equal(error.scannedKadrCount, 9);
    assert.deepEqual(error.apparatusOptions, ['A', 'B']); assert.deepEqual(error.details, ['Blocked']);
    assert.deepEqual(error.diagnostics, payload); return true;
  });
});

test('queue failures without a domain code use V2 operation text and remain terminal on authorization status', () => {
  const errors = harness(async () => {}).load('workerQueueReadError');
  for (const status of [401, 403, 503]) {
    const value = errors.workerQueueReadError(status, null);
    assert.equal(value.code, 'production_map_sequence');
    assert.equal(value.message, `Orderlar ketma-ketligi saqlanmadi${status >= 500
      ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.' : '. Oynani yangilang va qayta urinib ko‘ring.'}`);
    assert.equal(errors.workerQueueReadCanRetry(value), status === 503);
  }
  assert.equal(errors.workerQueueReadError(403, { error: 'forbidden' }).message, 'Bu amal sizning rolingiz uchun ruxsat etilmagan');
});

test('profile failure remains the source plain exception and live events retain their separate zero-status wording', () => {
  const errors = harness(async () => {}).load('workerQueueReadError');
  const profile = errors.workerQueueReadError(403, { error: 'forbidden' }, 'profile');
  assert.equal(profile.name, 'Error'); assert.equal(profile.message, 'Profile fetch failed'); assert.equal(profile.code, undefined);
  for (const [payload, code] of [[{}, ''], [{ error: '\u0085forbidden\u0085' }, 'forbidden'], [{ error: 42 }, '42']]) {
    const live = errors.workerQueueReadError(503, payload, 'live');
    assert.equal(live.code, code || 'production_map_live_failed');
    assert.equal(live.message, `Production map jonli holati olinmadi${code
      ? `. Server xato kodi: ${code} (HTTP 0). Oynani yangilang va qayta urinib ko‘ring.` : '. Oynani yangilang va qayta urinib ko‘ring.'}`);
    assert.equal(live.statusCode, null); assert.deepEqual(live.diagnostics, {});
  }
});
