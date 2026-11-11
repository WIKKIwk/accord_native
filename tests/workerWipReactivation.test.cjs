const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./support/workerQueueTransport.cjs');
const station = 'apparatus:default:laminate';
const p = (key, values) => values ? `${key}:${values.stage}` : key;
const map = () => ({ id: 'order', order_number: '0042', code: 'code', title: 'Product',
  nodes: [{ id: 'start', kind: 'start' }, { id: 'stage1', kind: 'apparatus', apparatus_id: station, title: 'First' },
    { id: 'stage2', kind: 'apparatus', apparatus_id: station, title: 'Second' }],
  edges: [{ from: 'start', to: 'stage1' }, { from: 'stage1', to: 'stage2' }] });
function harness(options = {}) {
  const calls = [], session = { token: 'fixture', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: ['apparatus.queue.manage'], assigned_apparatus: [station], assigned_apparatus_labels: ['Laminate'] };
  let current = true;
  const target = { apparatus: station, order_id: 'order', batch_id: 'batch', session_id: 'exact-session', stage_node_id: 'stage2', token: 'exact-token' };
  const load = loader({ './auth': { activeSessionToken: value => value === session ? value.token : null },
    './authorizedFetch': { authorizedFetch: async (_s, path, init, guard) => {
      guard?.(); const body = JSON.parse(init.body); calls.push({ path, method: init.method, body });
      if (path.endsWith('/preview')) {
        if (options.previewError) throw options.previewError;
        const response = options.preview ? await options.preview(body) : { available: true, target: { ...target, batch_id: body.batch_id ?? '' } };
        return new Response(JSON.stringify(response), { status: 200 });
      }
      if (options.write) return options.write();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } } });
  const api = load('workerWipReactivation');
  const input = { apparatus: { id: station, name: 'Lamination', operation: 'laminate' }, map: map(),
    batch: { batch_id: 'batch', qr_payload: 'QR-BATCH' }, workerMode: true, allowReactivation: true };
  return { api, input, session, calls, target, current: () => current, retire: () => { current = false; },
    prepare: () => api.prepareWorkerWipReactivation(session, input, p, () => current) };
}

test('WIP reactivation previews the exact batch and reviews its unique repeated occurrence', async () => {
  const x = harness(), review = await x.prepare();
  assert.equal(x.calls.length, 1); assert.equal(x.calls[0].method, 'POST');
  assert.equal(x.calls[0].path, '/v1/mobile/admin/production-maps/reactivation/preview');
  assert.deepEqual(x.calls[0].body, { apparatus: station, order_id: 'order', batch_id: 'batch' });
  assert.equal(review.target.stage_node_id, 'stage2'); assert.equal(review.stage, 'Second (2/2)');
  assert.equal(review.identity, '0042\nLamination\nworker.reactivate.stage:Second (2/2)\nQR-BATCH');
  assert.equal(review.actionKey, 'worker.reactivate.lamination_action');
  assert.equal(review.explanationKey, 'worker.reactivate.lamination_explanation');
  assert.equal(x.calls.filter(call => call.path.endsWith('/reactivation')).length, 0, 'preview never submits a write');
});

test('WIP reactivation gate follows workerMode, allow flag and physical operation', async () => {
  for (const patch of [{ workerMode: false }, { allowReactivation: false }, { apparatus: { id: station, name: 'Print', operation: 'print' } }]) {
    const x = harness(); Object.assign(x.input, patch); assert.equal(await x.prepare(), null); assert.equal(x.calls.length, 0);
  }
  for (const operation of ['glue', 'cut']) {
    const x = harness(); x.input.apparatus.operation = operation;
    const review = await x.prepare(); assert.ok(review.target);
    assert.equal(review.actionKey, operation === 'glue' ? 'worker.reactivate.lamination_action' : 'worker.reactivate.wip_action');
  }
});

test('the same helper supports print order-only preview without a fabricated empty batch field', async () => {
  const x = harness(); delete x.input.batch; x.input.apparatus.operation = 'print';
  const review = await x.prepare();
  assert.deepEqual(x.calls[0].body, { apparatus: station, order_id: 'order' });
  assert.equal(review.actionKey, 'worker.reactivate.order_action');
  assert.equal(review.identity.endsWith('QR-BATCH'), false);
  await x.api.runWorkerWipReactivation(x.session, review, x.current);
  assert.equal(Object.hasOwn(x.calls[1].body, 'batch_id'), false);
});

test('denied, unavailable and stale-map previews remain visible but cannot submit a write', async () => {
  for (const options of [{ preview: async () => ({ available: false, denial_reason: 'source_not_free' }) }, { previewError: Error('Old server') }]) {
    const x = harness(options), review = await x.prepare();
    assert.equal(review.target, null); assert.ok(review.reason);
    assert.deepEqual(await x.api.runWorkerWipReactivation(x.session, review, x.current), { attempted: false, succeeded: false, reason: '' });
    assert.equal(x.calls.length, 1);
  }
  for (const edit of [x => { x.input.map.nodes.pop(); }, x => { x.input.map.nodes.push({ ...x.input.map.nodes[2] }); }]) {
    const x = harness(); edit(x); const review = await x.prepare();
    assert.equal(review.target, null); assert.equal(review.reason, 'stale_target');
  }
  const missing = harness(); missing.input.map = { id: 'order', code: '0042', title: 'Product' };
  const review = await missing.prepare(); assert.equal(review.reason, 'unavailable'); assert.equal(missing.calls.length, 0);
});

test('one explicit confirmation submits the exact token once, and duplicate callbacks do not replay it', async () => {
  const x = harness(), review = await x.prepare();
  const first = x.api.runWorkerWipReactivation(x.session, review, x.current);
  const duplicate = x.api.runWorkerWipReactivation(x.session, review, x.current);
  assert.equal(first, duplicate);
  assert.deepEqual(await first, { attempted: true, succeeded: true, reason: '' });
  await x.api.runWorkerWipReactivation(x.session, review, x.current);
  assert.equal(x.calls.length, 2);
  assert.deepEqual(x.calls[1].body, x.target);
});

test('uncertain writes are attempted outcomes for reconciliation and are never retried automatically', async () => {
  for (const write of [async () => { throw Error('Lost response'); }, async () => new Response('{"error":"reactivation_source_not_free"}', { status: 409 }),
    async () => new Response('{"ok":false}', { status: 200 })]) {
    const x = harness({ write }), review = await x.prepare();
    const first = await x.api.runWorkerWipReactivation(x.session, review, x.current);
    assert.equal(first.attempted, true); assert.equal(first.succeeded, false);
    const again = await x.api.runWorkerWipReactivation(x.session, review, x.current);
    assert.deepEqual(again, first); assert.equal(x.calls.length, 2);
  }
});

test('scope change, retired UI, substituted target/map and forged reviews cannot submit', async () => {
  for (const edit of [x => { x.session.profile.ref = 'other'; }, x => x.retire(),
    (_x, review) => { review.target.token = 'substituted'; }, x => { x.input.map.nodes[2].title = 'Changed'; }]) {
    const x = harness(), review = await x.prepare(); edit(x, review);
    assert.equal((await x.api.runWorkerWipReactivation(x.session, review, x.current)).attempted, false);
    assert.equal(x.calls.length, 1);
  }
  const x = harness(), review = await x.prepare();
  assert.equal((await x.api.runWorkerWipReactivation(x.session, { ...review }, x.current)).attempted, false);
  assert.equal(x.calls.length, 1);
});

test('a preview returning after scope or owner expiry is ignored without showing executable authority', async () => {
  let release; const x = harness({ preview: () => new Promise(resolve => { release = resolve; }) });
  const read = x.prepare(); await Promise.resolve(); await Promise.resolve();
  x.retire(); release({ available: true, target: x.target });
  assert.equal(await read, null); assert.equal(x.calls.length, 1);
});

test('denial localization accepts only the source reasons', () => {
  const x = harness();
  assert.equal(x.api.workerReactivationDenialKey('source_not_free'), 'worker.reactivate.reason.source_not_free');
  assert.equal(x.api.workerReactivationDenialKey('unknown'), 'worker.reactivate.reason.unavailable');
});
