const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), value = new Module(filename, module);
  value.require = target => target in dependencies ? dependencies[target] : require(target);
  value._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return value.exports;
}
const output = load('workerOutputProgress.ts', { './workerControlsApi': { isCanonicalApparatusId: id => id.startsWith('apparatus:') }, './workerWip': {} });
const facts = load('qolip/qolipOrderStageFacts.ts', { '../workerApi': {}, '../workerOutputProgress': output });
const molds = load('qolip/qolipSequenceMolds.ts');
const { QolipOrderDetailState } = load('qolip/qolipOrderDetailState.ts', { './qolipOrderStageFacts': facts, './qolipSequenceMolds': molds });
const station = id => `apparatus:default:${id}`;
const node = (id, kind = 'apparatus', apparatus = station(id), patch = {}) => ({ id, kind, apparatus_id: apparatus, alternative_group_id: '', alternative_assigned_apparatus_id: '', ...patch });
const order = { map: { id: 'order', product_code: 'ITEM', nodes: [node('start', 'start', ''), node('print'), node('cut'), node('end', 'end', '')],
  edges: [{ from: 'start', to: 'print' }, { from: 'print', to: 'cut' }, { from: 'cut', to: 'end' }] } };
const batch = (id, patch = {}) => ({ batch_id: id, order_id: 'order', apparatus: station('print'), next_apparatus: station('cut'), wip_status: 'waiting', qr_payload: id,
  payload_json: { stage_node_id: 'print', next_stage_node_id: 'cut' }, ...patch });
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function harness(patch = {}, initial = order) {
  let current = true, boundaryListener, revision;
  const calls = [], deps = { order: async guard => { calls.push('order'); assert.equal(guard(), true); return order; },
    materials: async () => { calls.push('materials'); return [{ barcode: 'R1' }]; }, molds: async () => { calls.push('molds'); return [{ qolip_code: 'Q1' }]; },
    stageBatches: async () => { calls.push('stage'); return [batch('one')]; }, openingBatches: async () => { calls.push('opening'); return []; },
    subscribeRevision: listener => { revision = listener; return () => {}; }, ...patch };
  const controller = new QolipOrderDetailState({ current: () => current, subscribe: listener => { boundaryListener = listener; return () => {}; } }, 'order', deps, initial);
  controller.activate();
  return { controller, calls, expire: () => { current = false; boundaryListener?.(); }, revision: () => revision?.() };
}
test('sequence molds keep first code spelling, discard empty codes, and use source lexicographic sorting', () => {
  const a = { qolip_code: 'Q10' }, b = { qolip_code: 'q2' }, duplicate = { qolip_code: ' q10 ' };
  assert.deepEqual(molds.qolipSequenceMolds([b, a, duplicate, { qolip_code: ' ' }]), [a, b]);
});
test('map facts separate producer proof from consumer status and ignore duplicate, foreign and void batches', () => {
  const rows = [batch('one'), batch('one'), batch('two', { wip_status: 'in_use' }), batch('three', { wip_status: 'processed' }), batch('void', { wip_status: 'void' }), batch('foreign', { order_id: 'other' })];
  assert.deepEqual(facts.qolipOrderStageFacts(order.map, order.map.nodes[1], rows), { produced: 3, waitingInput: 0, inUseInput: 0, processedInput: 0 });
  const consumer = facts.qolipOrderStageFacts(order.map, order.map.nodes[2], rows);
  assert.deepEqual(consumer, { produced: 0, waitingInput: 1, inUseInput: 1, processedInput: 1 });
  assert.equal(facts.qolipStageInformationStatus(consumer), 'wip_received');
  assert.equal(facts.qolipStageInformationStatus({ ...consumer, produced: 1 }), 'wip_produced');
});
test('repeated apparatus needs an occurrence ID before it can label a stage', () => {
  const map = { ...order.map, nodes: [...order.map.nodes.slice(0, 3), node('second-print', 'apparatus', station('print')), order.map.nodes[3]],
    edges: [{ from: 'start', to: 'print' }, { from: 'print', to: 'cut' }, { from: 'cut', to: 'second-print' }, { from: 'second-print', to: 'end' }] };
  assert.equal(facts.qolipOrderStageFacts(map, map.nodes[1], [batch('one', { payload_json: {} })]).produced, 0);
  assert.equal(facts.qolipOrderStageFacts(map, map.nodes[1], [batch('one')]).produced, 1);
  assert.equal(facts.qolipOrderStageFacts(map, map.nodes[3], [batch('one')]).produced, 0);
});
test('opening WIP keeps explicit consumer then sole next stage; canonical progress overwrites matching opening ID', () => {
  const record = { intake: { order_id: 'order', source_apparatus: station('print'), entry_apparatus: '', resume_stage_node_id: 'print' },
    batches: [{ batch_id: 'open', order_id: 'order', qr_payload: 'QR', wip_status: 'waiting', used_by_apparatus: '', processed_by_apparatus: '', created_at_unix: 1, updated_at_unix: 2 }] };
  const rows = facts.qolipOpeningStageBatches(order, [record]); assert.equal(rows[0].next_apparatus, station('cut'));
  record.batches[0].used_by_apparatus = station('other'); assert.equal(facts.qolipOpeningStageBatches(order, [record])[0].next_apparatus, station('other'));
  const canonical = batch('open'); assert.equal(facts.qolipMergedStageBatches([canonical], rows)[0], canonical);
});
test('readonly details load exact full order, materials and molds; material expansion refreshes without a loading flash', async () => {
  const h = harness(); await h.controller.load(); assert.deepEqual(h.calls, ['order', 'materials', 'molds']);
  const first = h.controller.getSnapshot(); assert.equal(first.pending, false); assert.equal(first.materialsExpanded, false); assert.equal(first.moldsExpanded, false);
  h.controller.toggleMaterials(); assert.equal(h.controller.getSnapshot().materialsExpanded, true); assert.equal(h.controller.getSnapshot().materialsLoading, false);
  await tick(); assert.equal(h.calls.filter(x => x === 'materials').length, 2);
  h.controller.toggleMolds(); assert.equal(h.controller.getSnapshot().moldsExpanded, true); assert.equal(h.calls.filter(x => x === 'molds').length, 1);
  h.controller.suspend();
});
test('map loads only when expanded, coalesces revisions, and keeps facts after collapse', async () => {
  let finish, runs = 0;
  const h = harness({ stageBatches: async () => { runs++; return runs === 1 ? new Promise(resolve => { finish = resolve; }) : [batch('next')]; } });
  await h.controller.load(); assert.equal(runs, 0); h.controller.toggleMap(); await tick(); assert.equal(runs, 1);
  h.revision(); h.revision(); finish([batch('one')]); await tick(); assert.equal(runs, 2);
  assert.equal(h.controller.getSnapshot().stageFacts.get('print').produced, 1);
  h.controller.toggleMap(); h.revision(); await tick(); assert.equal(runs, 2); assert.equal(h.controller.getSnapshot().stageLoaded, true);
  h.controller.suspend();
});
test('collapse invalidates pending map results; the original account boundary permanently clears detail data', async () => {
  let finish;
  const h = harness({ stageBatches: () => new Promise(resolve => { finish = resolve; }) }); await h.controller.load(); h.controller.toggleMap(); await tick();
  h.controller.toggleMap(); finish([batch('one')]); await tick(); assert.equal(h.controller.getSnapshot().stageLoaded, false);
  h.expire(); assert.equal(h.controller.getSnapshot().invalid, true); assert.equal(h.controller.getSnapshot().order, null); assert.deepEqual(h.controller.getSnapshot().materials, []);
  await h.controller.load(); assert.equal(h.calls.filter(x => x === 'order').length, 1); h.controller.suspend();
});
test('mismatched detail response is rejected and cannot start related reads', async () => {
  const h = harness({ order: async () => ({ map: { ...order.map, id: 'other' } }) }, undefined);
  await h.controller.load(); assert.equal(h.controller.getSnapshot().error.message, 'production_map_order_mismatch'); assert.equal(h.calls.length, 0); h.controller.suspend();
});
