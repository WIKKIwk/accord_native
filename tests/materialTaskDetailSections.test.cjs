// Source-derived cases for f11910bb non-worker Material detail; no HTTP recording is claimed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name === '../shared/dartApparatus' ? dart : name.startsWith('.') ? {} : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const isCanonicalApparatusId = value => /^apparatus:[^\s:]+:[^\s:]+$/.test(value);
const dart = load('shared/dartApparatus.ts', { '../workerControlsApi': { isCanonicalApparatusId } });
const model = load('material/materialTaskMapModel.ts', { '../shared/dartApparatus': dart,
  '../workerControlsApi': { isCanonicalApparatusId }, '../workerApi': load('workerApi.ts') });
const sections = load('material/materialTaskDetailSections.ts');
const node = (id, apparatus = '', extra = {}) => ({ id, kind: apparatus ? 'apparatus' : id === 'start' ? 'start' : 'end',
  apparatus_id: apparatus, title: id, alternative_group_id: '', alternative_assigned_apparatus_id: '', alternative_assigned_title: '', ...extra });
const map = (nodes, pairs) => ({ id: 'order', nodes, edges: pairs.map(([from, to, branch = '']) => ({ from, to, branch })) });

test('detail unlink preserves consumption and stock-status locks, and mold list preserves first case-insensitive identity', () => {
  for (const stock_status of ['', ' available ']) assert.equal(sections.materialDetailCanUnlink({ stock_status, consumed_qty: 0 }), true);
  for (const stock_status of ['consumed', 'in_use', 'reserved']) assert.equal(sections.materialDetailCanUnlink({ stock_status, consumed_qty: 0 }), false);
  assert.equal(sections.materialDetailCanUnlink({ stock_status: 'available', consumed_qty: 0.01 }), false);
  const a = { qolip_code: ' B ' }, duplicate = { qolip_code: ' b ' }, first = { qolip_code: 'a' };
  assert.deepEqual(sections.materialDetailMolds([a, duplicate, first, null, { qolip_code: ' ' }]), [a, first]);
  assert.equal(sections.materialMoldHexColor(' #aBc123 '), '#aBc123');
  assert.equal(sections.materialMoldHexColor('\u0085#aBc123\u0085'), '#aBc123');
  for (const value of ['red', 'abc123', '#abc', '#FFaBc123']) assert.equal(sections.materialMoldHexColor(value), null);
});

test('material detail reads all assignments for this order and attached order molds with original guard', async () => {
  let current = true; const guard = () => { if (!current) throw Error('stale'); }, calls = [];
  const order = { map: { id: 'order', product_code: 'PET' } };
  const api = load('material/materialTaskDetailSections.ts', {
    '../workerRawMaterials': { adminRawMaterialAssignments: async (...args) => { calls.push(['materials', ...args]); return [{ barcode: 'R' }]; } },
    '../qolipOrderProductsApi': { qolipOrderProducts: async (...args) => { calls.push(['molds', ...args]); return { order: { qolip_code: 'Q' } }; } },
  });
  assert.deepEqual(await api.materialDetailAssignments({}, order, guard), [{ barcode: 'R' }]);
  assert.equal(calls[0][2], 'order'); assert.equal(calls[0][3], ''); assert.equal(calls[0][4], undefined);
  assert.equal(calls[0][5].beforeSend, guard);
  assert.deepEqual(await api.materialDetailAttachedMolds({}, order, guard), [{ qolip_code: 'Q' }]);
  assert.deepEqual(calls[1][2], ['order']); assert.equal(calls[1][3], undefined); assert.equal(calls[1][4].beforeSend, guard);
  assert.deepEqual(await api.materialDetailAttachedMolds({}, { map: { id: 'order', product_code: '' } }, guard), []);
  assert.equal(calls.length, 2); current = false;
  assert.throws(calls[0][5].beforeSend, /stale/); assert.throws(calls[1][4].beforeSend, /stale/);
  await assert.rejects(api.materialDetailAssignments({}, order, guard), /stale/);
  await assert.rejects(api.materialDetailAttachedMolds({}, order, guard), /stale/);
  assert.equal(calls.length, 2);
});

test('late assignment and mold reads are discarded after their original guard retires', async () => {
  let current = true, resolve;
  const pending = new Promise(done => { resolve = done; }), guard = () => { if (!current) throw Error('stale'); };
  const api = load('material/materialTaskDetailSections.ts', {
    '../workerRawMaterials': { adminRawMaterialAssignments: () => pending },
    '../qolipOrderProductsApi': { qolipOrderProducts: () => pending },
  });
  const order = { map: { id: 'order', product_code: 'PET' } };
  const a = api.materialDetailAssignments({}, order, guard), b = api.materialDetailAttachedMolds({}, order, guard);
  current = false; resolve([]); await assert.rejects(a, /stale/); await assert.rejects(b, /stale/);
});

test('WIP facts pin repeated apparatus occurrences rather than showing production on every occurrence', () => {
  const a = 'apparatus:print:a', b = 'apparatus:cut:b';
  const first = node('a1', a), second = node('a2', a), next = node('b', b);
  const data = map([node('start'), first, next, second, node('end')], [['start', 'a1'], ['a1', 'b'], ['b', 'a2'], ['a2', 'end']]);
  assert.deepEqual(model.materialMapWipConsumers(data, a, '', 'a1'), []);
  const batches = [
    { batch_id: 'one', order_id: 'order', apparatus: a, next_apparatus: b, wip_status: 'waiting', payload_json: { stage_node_id: 'a1', next_stage_node_id: 'b' } },
    { batch_id: 'two', order_id: 'order', apparatus: a, next_apparatus: b, wip_status: 'in_use', payload_json: { stage_node_id: 'a1', next_stage_node_id: 'b' } },
    { batch_id: 'two', order_id: 'order', apparatus: a, next_apparatus: b, wip_status: 'processed', payload_json: { stage_node_id: 'a1', next_stage_node_id: 'b' } },
    { batch_id: 'void', order_id: 'order', apparatus: a, next_apparatus: b, wip_status: 'void', payload_json: { stage_node_id: 'a1' } },
  ];
  assert.deepEqual(model.materialMapStageFacts(data, first, batches), { produced: 2, waitingInput: 0, inUseInput: 0, processedInput: 0 });
  assert.deepEqual(model.materialMapStageFacts(data, second, batches), { produced: 0, waitingInput: 0, inUseInput: 0, processedInput: 0 });
  assert.deepEqual(model.materialMapStageFacts(data, next, batches), { produced: 0, waitingInput: 1, inUseInput: 1, processedInput: 0 });
  const rows = model.materialTaskMapRows({ map: data }, batches);
  assert.equal(rows.find(row => row.node.id === 'a1').status, 'wip_produced');
  assert.equal(rows.find(row => row.node.id === 'b').status, 'wip_received');
  assert.ok(rows.every(row => row.status !== 'completed'));
});

test('alternative apparatus consumers remain occurrence scoped and opening WIP advances only to one next stage', () => {
  const a = 'apparatus:print:a', alternative = 'apparatus:print:alt', b = 'apparatus:cut:b';
  const first = node('a', a, { alternative_group_id: 'g' }), other = node('alt', alternative, { alternative_group_id: 'g' }), next = node('b', b);
  const data = map([node('start'), first, other, next, node('end')], [['start', 'a'], ['start', 'alt'], ['a', 'b'], ['alt', 'b'], ['b', 'end']]);
  assert.deepEqual(model.materialMapWipConsumers(data, alternative, 'a', 'alt'), [a, alternative]);
  assert.deepEqual(model.materialMapNextStages(data, 'a'), [{ nodeId: 'b', apparatusId: b }]);
  const batch = { batch_id: 'opening', order_id: 'order', qr_payload: 'QR', wip_status: 'waiting', used_by_apparatus: '', processed_by_apparatus: '' };
  const records = [{ intake: { order_id: 'order', source_apparatus: a, entry_apparatus: '', resume_stage_node_id: 'a' }, batches: [batch] }];
  const result = model.materialMapOpeningBatches({ map: data }, records);
  assert.equal(result[0].next_apparatus, b); assert.equal(result[0].payload_json.stage_node_id, 'a');
  assert.deepEqual(model.materialMapOpeningBatches({ map: { ...data, id: 'different' } }, records), []);
});

test('canonical queue snapshot pins active state to its occurrence and preserves completed work while frozen', () => {
  const a = 'apparatus:print:a', b = 'apparatus:cut:b';
  const first = node('a1', a), second = node('a2', a), next = node('b', b);
  const data = map([node('start'), first, next, second, node('end')], [['start', 'a1'], ['a1', 'b'], ['b', 'a2'], ['a2', 'end']]);
  const snapshot = { queue_states: { [a]: { order: 'in_progress' } }, stage_states: { order: { a1: 'completed', a2: 'pending' } },
    queue_action_controls: { [a]: { order: { state: 'in_progress', stage_node_id: 'a2', allowed_actions: ['pause'], interaction: { mode: 'in_progress' } } } } };
  let rows = model.materialTaskMapRows({ map: data }, [], snapshot);
  assert.equal(rows.find(row => row.node.id === 'a1').status, 'completed');
  assert.equal(rows.find(row => row.node.id === 'a2').status, 'in_progress');
  assert.equal(rows.filter(row => row.completed).length, 2, 'intro and first apparatus are completed');
  snapshot.order_controls = { order: 'frozen' }; rows = model.materialTaskMapRows({ map: data }, [], snapshot);
  assert.equal(rows.find(row => row.node.id === 'a1').status, 'completed');
  assert.equal(rows.find(row => row.node.id === 'a2').status, 'frozen');
  delete snapshot.stage_states; delete snapshot.queue_action_controls;
  assert.equal(model.materialMapQueueState(data, first, snapshot), null);
  assert.equal(model.materialMapQueueState(data, second, snapshot), null);
});

test('live alternative peer is selected by work state and pending interaction uses server input contract', () => {
  const a = 'apparatus:print:a', b = 'apparatus:print:b';
  const first = node('a', a, { alternative_group_id: 'g', alternative_assigned_apparatus_id: b }), other = node('b', b, { alternative_group_id: 'g' });
  const data = map([node('start'), first, other, node('end')], [['start', 'a'], ['start', 'b'], ['a', 'end'], ['b', 'end']]);
  const control = { state: 'pending', stage_node_id: 'b', allowed_actions: ['start'], interaction: { mode: 'fresh_start', previous_wip_mode: 'scan_required' } };
  const snapshot = { queue_states: { [a]: { order: 'pending' }, [b]: { order: 'in_progress' } }, queue_action_controls: { [b]: { order: {
    state: 'in_progress', stage_node_id: 'b', allowed_actions: ['pause'], interaction: { mode: 'in_progress' } } } } };
  let rows = model.materialTaskMapRows({ map: data }, [], snapshot);
  assert.equal(rows.find(row => row.apparatus)?.node.id, 'b'); assert.equal(model.materialMapStation(first), a);
  snapshot.queue_states[b].order = 'pending'; snapshot.queue_action_controls[b].order = control;
  rows = model.materialTaskMapRows({ map: data }, [], snapshot);
  assert.equal(rows.find(row => row.apparatus)?.status, 'wip_ready', 'assigned display candidate retains its input contract');
  const single = map([node('start'), other, node('end')], [['start', 'b'], ['b', 'end']]);
  assert.equal(model.materialTaskMapRows({ map: single }, [], snapshot).find(row => row.apparatus).status, 'wip_ready');
  control.allowed_actions = [];
  assert.equal(model.materialTaskMapRows({ map: single }, [], snapshot).find(row => row.apparatus).status, 'wip_waiting');
  control.interaction.previous_wip_mode = 'waiting';
  assert.equal(model.materialTaskMapRows({ map: single }, [], snapshot).find(row => row.apparatus).status, 'waiting_wip');
});
