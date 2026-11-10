const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
// @v2-test test/admin_production_map_scanned_wip_test_part.dart
function load(name) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === './authorizedFetch' ? { authorizedFetch: () => { throw new Error('unexpected network'); } }
    : id.startsWith('./') ? load(id.slice(2)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const api = load('workerScannedWips');
const item = { session_id: 'session', batch_id: 'batch', qr_payload: 'WIP', source_apparatus: '', linked_at_unix: 5,
  worker_display_name: 'Worker', state: 'active', consume_state: 'unused', return_token: 'a'.repeat(64), blocked_reason: '' };
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let current = true, manage = true, rows = [item], reads = 0, writes = [], mutations = 0, write = async () => {};
  const controller = new api.WorkerScannedWipsController({ current: () => current, canManage: () => manage,
    read: async () => { reads++; return typeof rows === 'function' ? rows() : rows; },
    returnWip: async value => { writes.push(value); return write(); } });
  controller.setMutationListener(() => mutations++);
  return { controller, get reads() { return reads; }, writes, get mutations() { return mutations; },
    current: value => { current = value; }, manage: value => { manage = value; }, rows: value => { rows = value; }, write: value => { write = value; } };
}

test('scanned-WIP entry uses a confirmed or unique stage and assigned operator read permission', () => {
  assert.equal(api.scannedWipStage({ stage_node_id: ' confirmed ' }, {}, 'a'), 'confirmed');
  assert.equal(api.scannedWipStage({}, { nodes: [{ id: 'stage', apparatus_id: 'a' }] }, 'a'), 'stage');
  assert.equal(api.scannedWipStage({}, { nodes: [{ id: 'one', apparatus_id: 'a' }, { id: 'two', apparatus_id: 'a' }] }, 'a'), '');
  const session = { profile: { role: 'aparatchi' }, capabilities: ['apparatus.queue.read'], assigned_apparatus: ['a'] };
  for (const operation of ['laminate', 'glue', 'cut']) assert.equal(api.canReadScannedWips(session, 'a', operation, 'stage', false), true);
  assert.equal(api.canReadScannedWips(session, 'a', 'print', 'stage', false), false);
  assert.equal(api.canReadScannedWips(session, 'a', 'cut', 'stage', true), false);
  assert.equal(api.canReadScannedWips({ ...session, capabilities: [] }, 'a', 'cut', 'stage', false), false);
  assert.equal(api.canReadScannedWips(session, 'other', 'cut', 'stage', false), false);
});

test('opening, refresh, cancel and dismissal never withdraw production authority or write', async () => {
  const h = harness(); h.controller.activate(); await settle();
  assert.equal(h.controller.getSnapshot().phase, 'ready');
  h.controller.requestReturn(item); h.controller.cancelReturn(); await h.controller.confirmReturn();
  await h.controller.load(); h.controller.deactivate();
  assert.equal(h.reads, 2); assert.equal(h.mutations, 0); assert.deepEqual(h.writes, []);
});

test('confirmed return writes once, locks other actions and reconciles after acknowledgement', async () => {
  const h = harness(); let release; h.write(() => new Promise(resolve => { release = resolve; }));
  h.controller.activate(); await settle(); h.controller.requestReturn(item);
  const pending = h.controller.confirmReturn();
  assert.equal(h.controller.getSnapshot().writing, true); assert.equal(h.controller.canReturn(item), false);
  await h.controller.confirmReturn(); await h.controller.load(); assert.equal(h.reads, 1);
  h.rows([{ ...item, state: 'returned', return_token: null }]); release(); await pending;
  assert.deepEqual(h.writes, [item]); assert.equal(h.mutations, 1); assert.equal(h.reads, 2);
  assert.equal(h.controller.getSnapshot().notice, 'worker.scanned_wip.success'); assert.equal(h.controller.canReturn(item), false);
  h.controller.deactivate();
});

test('native alert dismissal before confirm retains the captured validated item', async () => {
  const h = harness(); h.controller.activate(); await settle(); h.controller.requestReturn(item);
  const confirmed = h.controller.getSnapshot().confirmation; h.controller.cancelReturn();
  await h.controller.confirmReturn(confirmed); assert.equal(h.writes.length, 1); assert.equal(h.mutations, 1); h.controller.deactivate();
});

test('lost response still withdraws authority and reloads, with no automatic retry', async () => {
  const h = harness(); h.write(async () => { throw new Error('lost response'); });
  h.controller.activate(); await settle(); h.controller.requestReturn(item); await h.controller.confirmReturn();
  assert.equal(h.writes.length, 1); assert.equal(h.mutations, 1); assert.equal(h.reads, 2);
  assert.equal(h.controller.getSnapshot().notice, 'worker.scanned_wip.failed'); h.controller.deactivate();
});

test('permission change, consumed WIP, refreshed token and stale account cannot return', async () => {
  const h = harness(); h.controller.activate(); await settle(); h.controller.requestReturn(item);
  h.manage(false); await h.controller.confirmReturn(); assert.equal(h.writes.length, 0);
  h.manage(true); h.rows([{ ...item, consume_state: 'consumed' }]); await h.controller.load();
  h.controller.requestReturn(h.controller.getSnapshot().items[0]); assert.equal(h.controller.getSnapshot().confirmation, null);
  h.rows([item]); await h.controller.load(); h.controller.requestReturn(item);
  await h.controller.load(); await h.controller.confirmReturn(); assert.equal(h.writes.length, 0);
  h.controller.requestReturn(item); h.current(false); await h.controller.confirmReturn(); assert.equal(h.writes.length, 0);
  h.controller.deactivate();
});

test('late reads cannot repopulate invalidated history or override a newer read', async () => {
  const h = harness(); let resolve; h.rows(() => new Promise(done => { resolve = done; }));
  h.controller.activate(); h.rows([]); await h.controller.load(); resolve([item]); await settle();
  assert.deepEqual(h.controller.getSnapshot().items, []);
  h.rows(() => new Promise(done => { resolve = done; })); const read = h.controller.load();
  h.current(false); h.controller.invalidate(); resolve([item]); await read;
  assert.equal(h.controller.getSnapshot().phase, 'invalid'); assert.deepEqual(h.controller.getSnapshot().items, []); h.controller.deactivate();
});

test('history failure is explicit and return state labels preserve unknown and blocked reasons', async () => {
  const h = harness(); h.rows(async () => { throw new Error('read'); }); h.controller.activate(); await settle();
  assert.equal(h.controller.getSnapshot().phase, 'error'); assert.equal(h.mutations, 0); h.controller.deactivate();
  assert.deepEqual(api.scannedWipLabels({ ...item, consume_state: 'unknown', blocked_reason: 'other_worker' }),
    { state: 'worker.scanned_wip.unknown', reason: 'worker.scanned_wip.other_worker' });
  assert.equal(api.scannedWipLabels({ ...item, state: 'returned', consume_state: 'unknown' }).state, 'worker.scanned_wip.returned');
});
