const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === './workerControlsApi' ? { isCanonicalApparatusId: value => value.startsWith('apparatus:'), WorkerControlException: class extends Error {} }
    : id === './workerProgressBatch' ? { progressBatchFromJson: value => value } : id.startsWith('./') ? load(id.slice(2)) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const api = load('workerLaminationWorkflow');
const context = { apparatus: 'apparatus:default:laminate', orderId: 'order', stage: 'stage', complete: false, fullReport: true };
const source = (source_kind, source_id, revision = 3) => ({ source_kind, source_id, session_id: 's', revision, source_net_kg: 100, source_meter: 1000, is_current_roll: true });
const snapshot = () => ({ session_id: 's', session_status: 'active', allow_empty_sources: false, supports_remainder_weights: true,
  sources: [source('progress_batch', 'wip'), source('raw_material', 'film', 4)], request_result: null });
const receipt = () => ({ action: 'pause', session_status: 'paused', label_settings: { print_wip_remainder_labels: true, print_film_remainder_labels: false },
  progress_batches: [{ qr_payload: 'OUT', batch_id: 'b' }], remainders: [{ source_kind: 'progress_batch', remaining_net_kg: 5, qr_payload: 'WIP' },
    { source_kind: 'raw_material', remaining_net_kg: 6, qr_payload: 'FILM' }], prints: [{ ok: true, qr_payload: 'OUT', epc: 'OUT' }, { ok: true, qr_payload: 'WIP', epc: 'WIP' }] });
const values = { meter: '100', kg: '50', bobina: '5', wip: '10', film: '20', waste: '0', note: '' };
test('only live laminate astatka or full completion uses the atomic workflow; safe stop remains stable while busy', () => {
  const input = { operation: 'laminate', action: 'astatka', training: false, testMode: false, freezeRequested: false, fullReport: true };
  assert.equal(api.usesIntegratedLaminationReport(input), true);
  assert.equal(api.usesIntegratedLaminationReport({ ...input, action: 'complete' }), true);
  for (const change of [{ operation: 'print' }, { operation: 'glue' }, { operation: 'cut' }, { action: 'pause' }, { training: true }, { testMode: true }, { freezeRequested: true }, { action: 'complete', fullReport: false }])
    assert.equal(api.usesIntegratedLaminationReport({ ...input, ...change }), false);
});
function harness(options = {}) {
  const h = { current: true, saved: options.saved ?? null, snapshots: [], writes: [], events: [], commits: 0, attempts: 0, freezes: [] };
  h.read = async () => options.snapshot ?? snapshot(); h.save = async () => receipt();
  h.store = { get: async () => h.saved, set: async (_key, value) => { h.events.push(value ? 'persist' : 'clear'); h.saved = value; } };
  h.workflow = new api.WorkerLaminationWorkflow({ context: options.context ?? context, key: 'actor:machine:order', current: () => h.current,
    newRequestId: () => 'request-0001', store: h.store, read: id => { h.snapshots.push(id); return h.read(id); },
    save: (request, current) => { assert(current()); h.events.push('post'); h.writes.push(request); return h.save(request); },
    freeze: async note => { h.freezes.push(note); return {}; }, attempted: () => h.attempts++, committed: () => h.commits++ });
  h.fill = () => { for (const [key, value] of Object.entries(values)) h.workflow.change(key, value); };
  return h;
}

// @v2-test test/lamination_layer_remainder_api_test.dart
test('atomic request binds both input revisions and keeps layer returns separate from output', () => {
  const request = api.laminationReportInput(context, snapshot(), values, 'request-1');
  assert.equal(request.session_id, 's'); assert.equal(request.finished_goods_meter, 100); assert.equal(request.finished_goods_kg, 50);
  assert.deepEqual(request.layer_remainder_weights, { wip_net_kg: 10, film_net_kg: 20, wip_source_id: 'wip', film_source_id: 'film', expected_sources: [
    { source_kind: 'progress_batch', source_id: 'wip', expected_revision: 3 }, { source_kind: 'raw_material', source_id: 'film', expected_revision: 4 }] });
  assert.equal(request.print_transport, 'offline'); assert.equal(request.print_count, 1);
  assert.equal(request.lamination_print_leftover_rolls, 10); assert.equal(request.lamination_film_leftover_rolls, 20);
});

test('active zero-output astatka and paused astatka do not invent a new production output', () => {
  const empty = api.laminationReportInput(context, snapshot(), { ...values, meter: '0', kg: '0', bobina: '' }, 'request-1');
  assert.equal(empty.finished_goods_meter, 0); assert.equal(empty.finished_goods_kg, 0); assert.equal(empty.bobina_kg, undefined);
  const paused = api.laminationReportInput(context, { ...snapshot(), session_status: 'paused' }, values, 'request-2');
  assert.equal(paused.finished_goods_kg, undefined); assert.equal(paused.finished_goods_meter, undefined);
  for (const change of [{ wip: '' }, { film: '-1' }, { waste: 'NaN' }, { kg: '5' }, { bobina: '-1' }])
    assert.throws(() => api.laminationReportInput(context, snapshot(), { ...values, ...change }, 'r'));
});

test('complete report requires output and all three nonnegative remainder/waste values', () => {
  const complete = { ...context, complete: true };
  const request = api.laminationReportInput(complete, snapshot(), values, 'r');
  assert.equal(request.action, 'complete'); assert.equal(request.full_completion_report_required, true);
  assert.throws(() => api.laminationReportInput(complete, snapshot(), { ...values, bobina: '0' }, 'r'));
  assert.throws(() => api.laminationReportInput(complete, snapshot(), { ...values, kg: '0', meter: '0' }, 'r'));
});

test('persist before one POST, lock repeat taps, and clear only after acknowledged commit', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); let resolve; h.save = () => new Promise(done => { resolve = done; });
  const pending = h.workflow.submit(); await Promise.resolve(); await h.workflow.submit();
  assert.deepEqual(h.events, ['persist', 'post']); assert.equal(h.workflow.getSnapshot().phase, 'saving');
  resolve(receipt()); await pending;
  assert.deepEqual(h.events, ['persist', 'post', 'clear']); assert.equal(h.writes.length, 1); assert.equal(h.commits, 1);
  assert.equal(h.workflow.getSnapshot().phase, 'receipt');
});

test('lost response retains exact payload; reopening reconciles by saved request ID without another POST', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); h.save = async () => { throw new Error('lost response'); }; await h.workflow.submit();
  const saved = h.saved; assert.equal(saved.request_id, 'request-0001'); assert.equal(h.writes.length, 1);
  h.read = async () => ({ ...snapshot(), request_result: receipt() }); await h.workflow.load();
  assert.deepEqual(h.snapshots, ['', 'request-0001']); assert.equal(h.saved, null); assert.equal(h.writes.length, 1);
  assert.equal(h.workflow.getSnapshot().phase, 'receipt');
});

test('explicit pending retry replays original business payload and request ID', async () => {
  const saved = api.laminationReportInput(context, snapshot(), values, 'original-id');
  const h = harness({ saved }); await h.workflow.load(); assert.equal(h.workflow.getSnapshot().phase, 'pending');
  h.workflow.change('meter', '999'); await h.workflow.submit();
  assert.equal(h.writes[0].finished_goods_meter, 100); assert.equal(h.writes[0].request_id, 'original-id');
});

test('storage failure blocks POST; malformed/cross-order pending data is never sent', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); h.store.set = async () => { throw new Error('disk'); }; await h.workflow.submit();
  assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().phase, 'edit');
  const foreign = harness({ saved: { apparatus: context.apparatus, order_id: 'other', request_id: 'r' } });
  await foreign.workflow.load(); await foreign.workflow.submit(); assert.equal(foreign.snapshots.length, 0); assert.equal(foreign.writes.length, 0);
});

test('scope change discards late data and does not replay after account ABA', async () => {
  const h = harness(); let resolve; h.read = () => new Promise(done => { resolve = done; }); const pending = h.workflow.load(); await Promise.resolve();
  h.workflow.invalidate(); h.current = true; resolve(snapshot()); await pending; await h.workflow.load();
  assert.equal(h.workflow.getSnapshot().snapshot, null); assert.equal(h.snapshots.length, 1);
});

test('unsupported backend and missing mounted sources stop recording; paused empty source shows resume guidance', async () => {
  for (const change of [{ supports_remainder_weights: false }, { sources: [] }]) {
    const h = harness({ snapshot: { ...snapshot(), ...change } }); await h.workflow.load(); await h.workflow.submit(); assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().phase, 'error');
  }
  const paused = harness({ snapshot: { ...snapshot(), session_status: 'paused', sources: [] } }); await paused.workflow.load();
  assert.equal(paused.workflow.getSnapshot().phase, 'receipt'); assert.equal(paused.workflow.getSnapshot().resumeGuidance, true);
});

test('completion reason retains V2 issue/freeze flow and creates neither output nor layer returns', async () => {
  const h = harness({ context: { ...context, complete: true } }); await h.workflow.load(); h.workflow.change('note', ' damaged '); await h.workflow.submit();
  assert.deepEqual(h.freezes, ['damaged']); assert.equal(h.saved, null); assert.equal(h.writes.length, 0);
  assert.equal(h.workflow.getSnapshot().issueNotice, 'worker.notice.action_sent');
});

test('print labels follow server switches and validate QR identity, duplicates and missing jobs before hardware', () => {
  assert.deepEqual(api.laminationReceiptJobs(receipt()).map(job => job.epc), ['OUT', 'WIP']);
  const disabled = receipt(); disabled.progress_batches = []; disabled.remainders = [{ source_kind: 'raw_material', remaining_net_kg: 3, qr_payload: 'FILM' }]; disabled.prints = [];
  assert.deepEqual(api.laminationReceiptJobs(disabled), []);
  for (const prints of [[{ ok: true, qr_payload: 'OUT', epc: 'wrong' }], [receipt().prints[0], receipt().prints[0]], [receipt().prints[0]], [{ ok: true, qr_payload: 'FOREIGN' }]])
    assert.throws(() => api.laminationReceiptJobs({ ...receipt(), prints }));
});

test('receipt is retained if removing the persisted request fails after a successful save', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); const original = h.store.set;
  h.store.set = async (key, value) => { if (!value) throw new Error('disk'); return original(key, value); };
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'receipt'); assert(h.workflow.getSnapshot().receipt); assert.equal(h.writes.length, 1);
});
