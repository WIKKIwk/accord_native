const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(name, mocks) {
  const filename = path.resolve(__dirname, '../src', `${name}.ts`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const station = 'apparatus:default:lamination', tick = () => new Promise(setImmediate);
function setup() {
  const h = { epoch: 1, scope: 'scope', mounted: true, log: [], valid: true };
  h.queue = { epoch: 'server', revision: 8, scope: 'read-scope', maps: [{ map: { id: 'order' } }] };
  h.aggregate = { control_state: { epoch: 'server', rev: 8 }, queue_context: h.queue };
  h.actor = { assigned_apparatus: [station] };
  h.progress = { order_id: 'order', batch_id: 'batch' };
  const { workerFabQrReads } = compile('workerFabQrReads', {
    './auth': { captureSessionWitness: () => h.epoch, isSessionWitnessCurrent: witness => witness === h.epoch },
    './sessionReadScope': { sessionReadScope: () => h.scope },
    './workerOrderLogic': { validOrderControl: data => h.valid && data?.control_state.rev >= (h.live?.rev ?? 0) },
    './workerFabQr': { workerFabChanged: () => Object.assign(Error('changed'), { code: 'worker_qr_sync' }), workerFabControl: queue => ({ control_state: { epoch: queue.epoch, rev: queue.revision } }) },
    './workerScanBootstrap': { adminOrderScanBootstrap: async (_session, input) => { assert(input.current()); h.log.push(['bootstrap', input]); if (h.gate) await h.gate; return h.aggregate; } },
    './productionMapQueueSnapshotApi': { adminProductionMapQueueSnapshot: async (_session, input) => { assert(input.current()); h.log.push(['sequence', input]); return h.queue; } },
    './workerProgressApi': { adminProgressQrLookup: async (_session, qr, options) => { assert(options.current()); h.log.push(['progress', qr, options]); if (h.progressError) throw h.progressError; return h.progress; } },
    './admin/openingWipApi': { adminOpeningWipQrReport: async (_session, qr, check) => { check(); h.log.push(['opening-report', qr]); if (h.openingError) throw h.openingError; return h.opening; } },
    './workerOpeningWip': { adminLookupOpeningWip: async (_session, input) => { assert(input.current()); h.log.push(['opening-lookup', input]); return h.opening.batches[0]; } },
  });
  h.reads = workerFabQrReads(h.actor, station, () => h.live ?? null, () => h.mounted); return h;
}
// @v2-test test/admin_production_map_worker_fab_latency_test_part.dart
test('aggregate context keeps the scoped proof request and avoids a second sequence read', async () => {
  const h = setup(); assert.equal((await h.reads.context('order', 'QR')).snapshot, h.queue);
  assert.deepEqual(h.log.map(row => row[0]), ['bootstrap']);
  const input = h.log[0][1]; assert.equal(input.includeContext, true); assert.equal(input.automaticQolipConfirmation, true); assert.equal(input.qrPayload, 'QR');
});
test('older missing context uses a fresh scoped sequence and matching control read; positively unsupported aggregate uses sequence authority', async () => {
  const h = setup(); delete h.aggregate.queue_context; await h.reads.context('order', 'QR');
  assert.deepEqual(h.log.map(row => row[0]), ['bootstrap', 'sequence', 'bootstrap']); assert.equal(h.log[1][1].apparatus, station); assert.equal(h.log[1][1].order_id, 'order'); assert.equal(h.log[1][1].fresh, true); assert.equal(h.log[2][1].includeSections, false);
  const old = setup(); old.aggregate = null; assert.equal((await old.reads.context('order', '')).bootstrap.control_state.rev, 8); assert.deepEqual(old.log.map(row => row[0]), ['bootstrap', 'sequence']);
});
test('mixed or older revisions retry at most twice and never use a stale context', async () => {
  const h = setup(); h.aggregate.control_state.rev = 7; await assert.rejects(() => h.reads.context('order', ''), /changed/); assert.equal(h.log.length, 2);
  const live = setup(); live.live = { rev: 9 }; await assert.rejects(() => live.reads.context('order', ''), /changed/); assert.equal(live.log.length, 2);
});
test('identity, assignment and route lifetimes are captured once, including an away-and-back account transition', async () => {
  for (const change of [h => { h.epoch++; }, h => { h.scope = 'new'; }, h => { h.actor.assigned_apparatus = []; }, h => { h.mounted = false; }]) {
    const h = setup(); let release; h.gate = new Promise(resolve => { release = resolve; }); const pending = h.reads.context('order', '');
    change(h); release(); await assert.rejects(pending, /changed/); assert.equal(h.log.length, 1);
    await assert.rejects(() => h.reads.identify('QR'), /changed/); assert.equal(h.log.length, 1);
  }
});
test('only explicit progress-not-found falls back to a confirmed matching opening record', async () => {
  const h = setup(); h.progressError = { code: 'progress_qr_not_found' }; h.opening = { intake: { order_id: 'order', status: 'confirmed' }, batches: [{ order_id: 'order', batch_id: 'batch', qr_payload: 'QR', wip_status: 'waiting' }] };
  const wip = await h.reads.identify('qr'); assert.equal(wip.opening, h.opening); assert.equal(wip.batch.batch_id, 'batch');
  await h.reads.validate(wip, 'qr', 'order'); assert.equal(h.log.at(-1)[0], 'opening-lookup');
  for (const value of ['pending', 'unconfirmed']) { h.opening.intake.status = value; await assert.rejects(() => h.reads.identify('qr'), /changed/); }
  const denied = setup(); denied.progressError = { code: 'forbidden' }; await assert.rejects(() => denied.reads.identify('QR'), error => error.code === 'forbidden'); assert.equal(denied.log.length, 1);
});
test('unknown opening QR stays not-found, and a server failure is never treated as an empty record', async () => {
  const h = setup(); h.progressError = { code: 'progress_batch_not_found' }; h.openingError = { statusCode: 404 }; assert.equal(await h.reads.identify('QR'), null);
  h.openingError = { statusCode: 500 }; await assert.rejects(() => h.reads.identify('QR'), error => error.statusCode === 500); await tick();
});
