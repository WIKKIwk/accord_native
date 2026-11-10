const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/workerRezkaAstatkaWorkflow.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const api = loaded.exports;
const context = { apparatus: 'apparatus:default:asset-010', orderId: 'order' };
const snapshot = () => ({ session_id: 'session', stage_node_id: 'cut-stage', request_result: null });
const control = { stage: 'cut-stage', totalWasteOnly: false };
const values = { total: '1,5', print: '0', lamination: '1', edge: '0,5', note: '  Izoh  ' };
function harness(options = {}) {
  const h = { current: true, saved: options.saved ?? null, events: [], writes: [], reads: [], commits: 0, attempts: 0, controls: 0 };
  h.read = async () => options.snapshot ?? snapshot(); h.save = async () => ({});
  h.store = { get: async () => h.saved, set: async (_key, value, expectedId) => {
    h.events.push(value ? 'persist' : ['clear', expectedId]); if (value || h.saved?.request_id === expectedId) h.saved = value;
  } };
  h.workflow = new api.WorkerRezkaAstatkaWorkflow({ context, key: 'account:machine:order', current: () => h.current, newRequestId: () => 'request-original',
    store: h.store, read: id => { h.reads.push(id); return h.read(id); }, control: async () => { h.controls++; return options.control ?? control; },
    save: (request, current) => { assert(current()); h.events.push('post'); h.writes.push(request); return h.save(request); },
    attempted: () => h.attempts++, committed: () => h.commits++ });
  h.fill = () => { for (const [key, value] of Object.entries(values)) h.workflow.change(key, value); };
  return h;
}

// @v2-test test/rezka_astatka_api_test.dart
test('cut astatka is waste-only, binds the authoritative session/stage and accepts zero categories', () => {
  const request = api.rezkaAstatkaInput(context, snapshot(), control, values, 'request-original');
  assert.deepEqual(request, { apparatus: context.apparatus, order_id: context.orderId, session_id: 'session', stage_node_id: 'cut-stage', request_id: 'request-original',
    total_waste_only: false, total_waste: 1.5, rezka_bosma_waste: 0, rezka_lamination_waste: 1, rezka_edge_waste: 0.5, description: 'Izoh' });
  const totalOnly = api.rezkaAstatkaInput(context, snapshot(), { ...control, totalWasteOnly: true }, { total: '0', print: '', lamination: '', edge: '', note: '' }, 'request-total');
  assert.equal(totalOnly.total_waste, 0); assert.equal(totalOnly.rezka_bosma_waste, undefined);
  for (const key of ['finished_goods_meter', 'finished_goods_kg', 'bobina_kg', 'returned_paint_items']) assert.equal(totalOnly[key], undefined);
});
test('missing, negative and nonfinite required waste values are rejected', () => {
  for (const change of [{ total: '' }, { total: 'Infinity' }, { print: '-1' }, { lamination: 'NaN' }, { edge: '' }])
    assert.throws(() => api.rezkaAstatkaInput(context, snapshot(), control, { ...values, ...change }, 'request-original'), /invalid_number/);
});
test('changed stage or missing session stops new reports before POST', async () => {
  for (const options of [{ control: { ...control, stage: 'new-stage' } }, { snapshot: { ...snapshot(), session_id: '' } }]) {
    const h = harness(options); await h.workflow.load(); h.fill(); await h.workflow.submit();
    assert.equal(h.workflow.getSnapshot().phase, 'error'); assert.equal(h.writes.length, 0); assert.equal(h.saved, null);
  }
});
test('persists before one POST and prevents repeat taps during save', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); let resolve;
  h.save = () => new Promise(done => { resolve = done; }); const pending = h.workflow.submit(); await Promise.resolve(); await h.workflow.submit();
  assert.deepEqual(h.events, ['persist', 'post']); assert.equal(h.attempts, 1);
  resolve({}); await pending; assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.commits, 1);
  assert.deepEqual(h.events, ['persist', 'post', ['clear', 'request-original']]); assert.equal(h.saved, null);
  await h.workflow.submit(); await h.workflow.load(); assert.equal(h.writes.length, 1);
});
test('lost response retains exact payload; receipt reconciliation never POSTs it again', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); h.save = async () => { throw new Error('response lost'); }; await h.workflow.submit();
  assert.equal(h.saved.request_id, 'request-original'); assert.equal(h.workflow.getSnapshot().phase, 'error');
  h.read = async () => ({ ...snapshot(), request_result: { report_id: 'acknowledged' } }); await h.workflow.load();
  assert.deepEqual(h.reads, ['', 'request-original']); assert.equal(h.writes.length, 1); assert.equal(h.saved, null); assert.equal(h.commits, 1);
  assert.equal(h.workflow.getSnapshot().phase, 'done');
});
test('pending payload waits for explicit retry and preserves original metrics and identities', async () => {
  const saved = api.rezkaAstatkaInput(context, snapshot(), control, values, 'saved-original');
  const h = harness({ saved, snapshot: { ...snapshot(), session_id: 'new-session', stage_node_id: 'new-stage' } });
  await h.workflow.load(); assert.equal(h.workflow.getSnapshot().phase, 'pending'); assert.equal(h.controls, 0); assert.equal(h.writes.length, 0);
  h.workflow.change('total', '999'); await h.workflow.submit(); assert.deepEqual(h.writes[0], saved);
});
test('only a confirmed stale-session rejection removes uncertain pending data', async () => {
  for (const [statusCode, code, clear] of [[400, 'invalid', false], [403, 'forbidden', false], [404, 'not_found', false],
    [409, 'payload_conflict', false], [500, 'queue_action_not_allowed', false], [409, 'queue_action_not_allowed', true]]) {
    const h = harness(); await h.workflow.load(); h.fill();
    h.save = async () => { throw Object.assign(new Error('rejected'), { statusCode, code }); }; await h.workflow.submit();
    assert.equal(h.saved === null, clear, `${statusCode} ${code}`); assert.equal(h.commits, 0); assert.equal(h.workflow.getSnapshot().phase, 'error');
  }
});
test('storage failure blocks the write and preserves the editable draft', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); h.store.set = async () => { throw new Error('disk full'); }; await h.workflow.submit();
  assert.equal(h.writes.length, 0); assert.equal(h.attempts, 0); assert.equal(h.workflow.getSnapshot().phase, 'edit');
  assert.deepEqual(h.workflow.getSnapshot().values, values);
});
test('receipt stays acknowledged if deleting local pending data fails', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); const set = h.store.set;
  h.store.set = async (...args) => { if (args[1] === null) throw new Error('disk full'); return set(...args); }; await h.workflow.submit();
  assert.equal(h.commits, 1); assert.equal(h.workflow.getSnapshot().phase, 'done'); await h.workflow.submit(); assert.equal(h.writes.length, 1);
});
test('foreign or invalid pending scope is never read from the server or POSTed', async () => {
  const saved = api.rezkaAstatkaInput(context, snapshot(), control, values, 'saved-original');
  for (const change of [{ apparatus: 'other' }, { order_id: 'other' }, { request_id: 'short' }, { session_id: '' }, { stage_node_id: '' }]) {
    const h = harness({ saved: { ...saved, ...change } }); await h.workflow.load(); await h.workflow.submit();
    assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().phase, 'error');
  }
});
test('account switch during pending storage prevents POST and leaves payload available for reconciliation', async () => {
  const h = harness(); await h.workflow.load(); h.fill(); let resolve;
  const set = h.store.set; h.store.set = async (...args) => { await set(...args); await new Promise(done => { resolve = done; }); };
  const pending = h.workflow.submit(); await Promise.resolve(); await Promise.resolve(); h.current = false; resolve(); await pending;
  assert.equal(h.writes.length, 0); assert.equal(h.saved.request_id, 'request-original');
});
test('invalidated owner cannot accept late read or mutate again after account ABA', async () => {
  const h = harness(); let resolve; h.read = () => new Promise(done => { resolve = done; });
  const pending = h.workflow.load(); await Promise.resolve(); h.workflow.invalidate(); h.current = true; resolve(snapshot()); await pending;
  await h.workflow.load(); h.fill(); await h.workflow.submit(); assert.equal(h.controls, 0); assert.equal(h.writes.length, 0); assert.equal(h.reads.length, 1);
});
