const assert = require('node:assert/strict');
const test = require('node:test');
const { editor: { AdminWorkerDetailEditorController }, scheduler, tick, deferred } = require('./adminWorkerDetailSupport.cjs');
const material = (id, name = id, active = true) => ({ id, name, active, density_kg_m3: null, variants: [] });
const responsibility = (id, name = id) => ({ material_id: id, material_name: name, estimated_kg: null });
function fixture(mode = 'warehouse', overrides = {}) {
  let valid = true, serial = 0, warehouses = ['Assigned'], materials = [responsibility('assigned')]; const calls = [], clock = scheduler();
  const deps = { mode, isCurrent: () => valid, nextId: () => ++serial, name: () => 'Latest name', assignedWarehouses: () => warehouses, assignedMaterials: () => materials,
    warehouses: async guard => { guard(); calls.push('catalog'); return [{ warehouse: 'Group', is_group: true }, { warehouse: ' Assigned ' }, { warehouse: ' b ' }, { warehouse: 'B' }, { warehouse: 'A' }]; },
    materials: async guard => { guard(); calls.push('catalog'); return [material('assigned'), material('inactive', '', false), material('m', 'Material')]; },
    assignWarehouse: async (name, display, guard) => { guard(); calls.push(['assign', name, display]); return { warehouse: name }; },
    unassignWarehouse: async (name, guard) => { guard(); calls.push(['unassign', name]); },
    reloadWarehouses: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('reread'); return ['A']; },
    assignMaterial: async (id, guard) => { guard(); calls.push(['assign', id]); return responsibility(id, 'Saved name'); },
    unassignMaterial: async (id, guard) => { guard(); calls.push(['unassign', id]); },
    reloadMaterials: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('reread'); return [responsibility('m')]; },
    changedWarehouses: values => { calls.push(['changed', values]); warehouses = values; }, changedMaterials: values => { calls.push(['changed', values]); materials = values; },
    text: key => key, notice: (key, values) => calls.push(['notice', key, values]), rawNotice: message => calls.push(['raw', message]), schedule: clock.set, cancel: clock.clear, ...overrides };
  const controller = new AdminWorkerDetailEditorController(deps); controller.start();
  return { controller, calls, deps, clock, retire: () => { valid = false; }, assignedWarehouses: value => { warehouses = value; }, assignedMaterials: value => { materials = value; } };
}
test('warehouse catalog reads latest assignment props, filters groups, normalizes/deduplicates first values and sorts', async () => {
  const pending = deferred(), f = fixture('warehouse', { warehouses: () => pending.promise }); const loading = f.controller.add();
  f.assignedWarehouses(['b']); pending.resolve([{ warehouse: 'Group', is_group: true }, { warehouse: 'b' }, { warehouse: ' A ' }, { warehouse: 'a' }, { warehouse: 'C' }]); await loading;
  assert.deepEqual(f.controller.visibleWarehouses(), ['A', 'C']); assert.equal(f.controller.getSnapshot().adding, true);
  const id = f.controller.getSnapshot().picker.id; f.controller.selectWarehouse(id, 'C'); f.controller.search(id, 'A'); assert.deepEqual(f.controller.visibleWarehouses(), ['A']);
  assert.equal(f.controller.getSnapshot().picker.selected, 'C', 'source selection survives being hidden by search');
  f.controller.dismissPicker(id); assert.equal(f.controller.getSnapshot().adding, false); assert.equal(f.controller.getSnapshot().picker, null);
});
test('warehouse radio selection requires explicit confirm, post-write acknowledgement membership and normalized changed list', async () => {
  const f = fixture(); await f.controller.add(); const id = f.controller.getSnapshot().picker.id;
  await f.controller.confirmWarehouse(id); assert.deepEqual(f.calls, ['catalog']); f.controller.selectWarehouse(id, 'A'); assert.deepEqual(f.calls, ['catalog']);
  await f.controller.confirmWarehouse(id); assert.deepEqual(f.calls.slice(1), [['assign', 'A', 'Latest name'], 'reread', ['changed', ['A']], ['notice', 'warehouse.assigned', { warehouse: 'A' }]]);
  assert.equal(f.controller.getSnapshot().adding, false);
});
for (const failure of ['assign', 'reread', 'unconfirmed']) test(`warehouse add ${failure} never publishes parent success and preserves original assigned list`, async () => {
  const f = fixture(); if (failure === 'assign') f.deps.assignWarehouse = async () => { throw Error('write'); };
  if (failure === 'reread') f.deps.reloadWarehouses = async () => { throw Error('read'); }; if (failure === 'unconfirmed') f.deps.reloadWarehouses = async () => ['B'];
  await f.controller.add(); const id = f.controller.getSnapshot().picker.id; f.controller.selectWarehouse(id, 'A'); await f.controller.confirmWarehouse(id);
  assert.equal(f.calls.some(call => call[0] === 'changed'), false); assert.deepEqual(f.deps.assignedWarehouses(), ['Assigned']);
  assert.equal(f.calls.at(-1)[1], 'warehouse.assign_failed'); if (failure === 'unconfirmed') assert.equal(f.calls.at(-1)[2].error.code, 'warehouse_assignment_not_confirmed');
});
test('source empty and catalog failure notices are mode-specific and settle adding flag', async () => {
  for (const mode of ['warehouse', 'material']) {
    const f = fixture(mode, { warehouses: async () => [], materials: async () => [] }); await f.controller.add();
    assert.deepEqual(f.calls, mode === 'warehouse' ? [['notice', 'warehouse.assignment_available_empty', undefined]] : [['raw', 'Barcha homashyolar allaqachon biriktirilgan']]);
    assert.equal(f.controller.getSnapshot().adding, false); const g = fixture(mode, { warehouses: async () => { throw Error('catalog'); }, materials: async () => { throw Error('catalog'); } }); await g.controller.add();
    assert.equal(g.calls.at(-1)[mode === 'warehouse' ? 1 : 0], mode === 'warehouse' ? 'warehouse.assign_failed' : 'raw');
    assert.equal(g.controller.getSnapshot().adding, false);
  }
});
test('warehouse add/remove busy flags remain independent and removal rereads absence before parent change', async () => {
  const waiting = deferred(), f = fixture('warehouse', { warehouses: () => waiting.promise, reloadWarehouses: async () => ['Remaining'] }); const add = f.controller.add();
  f.controller.requestRemove('Assigned'); const dialog = f.controller.getSnapshot().dialog;
  assert.equal(dialog.name, 'Latest name'); await f.controller.confirmRemove(dialog.id);
  assert.equal(f.controller.getSnapshot().adding, true); assert.equal(f.controller.getSnapshot().removing, null);
  assert.deepEqual(f.calls, [['unassign', 'Assigned'], ['changed', ['Remaining']], ['notice', 'warehouse.unassigned', { warehouse: 'Assigned' }]]);
  waiting.resolve([{ warehouse: 'New' }]); await add; assert.ok(f.controller.getSnapshot().picker);
});
for (const failure of ['unassign', 'reread', 'unconfirmed']) test(`warehouse remove ${failure} leaves original assignment and reports source failure`, async () => {
  const f = fixture(); if (failure === 'unassign') f.deps.unassignWarehouse = async () => { throw Error('write'); };
  if (failure === 'reread') f.deps.reloadWarehouses = async () => { throw Error('read'); }; if (failure === 'unconfirmed') f.deps.reloadWarehouses = async () => [' assigned '];
  f.controller.requestRemove('Assigned'); const id = f.controller.getSnapshot().dialog.id; await f.controller.confirmRemove(id);
  assert.equal(f.calls.some(call => call[0] === 'changed'), false); assert.equal(f.calls.at(-1)[1], 'warehouse.unassign_failed');
  if (failure === 'unconfirmed') assert.equal(f.calls.at(-1)[2].error.code, 'warehouse_unassignment_not_confirmed'); assert.equal(f.controller.getSnapshot().removing, null);
});
test('material picker filters active/unassigned, pages50 and waits220ms for name-only filtering; threshold240 loads next page', async () => {
  const f = fixture('material', { materials: async () => [material('assigned'), material('off', '', false), ...Array.from({ length: 101 }, (_, i) => material(`m${i}`, `Name ${i}`))] });
  await f.controller.add(); await tick(); const id = f.controller.getSnapshot().picker.id;
  assert.equal(f.controller.visibleMaterials().length, 50); assert.equal(f.controller.getSnapshot().picker.hasMore, true);
  f.controller.materialScroll(id, 241); await tick(); assert.equal(f.controller.visibleMaterials().length, 50);
  f.controller.materialScroll(id, 240); await tick(); assert.equal(f.controller.visibleMaterials().length, 100);
  f.controller.materialScroll(id, 0); await tick(); assert.equal(f.controller.visibleMaterials().length, 101); assert.equal(f.controller.getSnapshot().picker.hasMore, false);
  f.controller.search(id, 'Name 100'); assert.equal(f.clock.size(), 1); f.clock.advance(219); await tick(); assert.equal(f.controller.getSnapshot().picker.items.length, 101);
  f.clock.advance(1); await tick(); assert.deepEqual(f.controller.visibleMaterials().map(value => value.id), ['m100']);
  f.controller.search(id, 'mikron varianti'); f.clock.advance(220); await tick(); assert.deepEqual(f.controller.visibleMaterials(), [], 'subtitle relevance does not broaden source name-only filtering');
  f.controller.dismissPicker(id); assert.equal(f.clock.size(), 0);
});
test('material selection closes sheet immediately, assigns captured selected id, approves saved ack id then changes parent', async () => {
  const wait = deferred(), f = fixture('material', { assignMaterial: async (id, guard) => { guard(); f.calls.push(['assign', id]); return wait.promise; } });
  await f.controller.add(); await tick(); const id = f.controller.getSnapshot().picker.id, selected = f.controller.visibleMaterials()[0];
  const saving = f.controller.selectMaterial(id, selected); assert.equal(f.controller.getSnapshot().picker, null); assert.equal(f.controller.getSnapshot().adding, true);
  wait.resolve(responsibility('m', 'Acknowledged name')); await saving;
  assert.deepEqual(f.calls, ['catalog', ['assign', 'm'], 'reread', ['changed', [responsibility('m')]], ['raw', 'Biriktirildi: Acknowledged name']]);
  assert.equal(f.controller.getSnapshot().adding, false);
});
for (const failure of ['assign', 'reread', 'unconfirmed']) test(`material add ${failure} reports raw source failure and never changes parent`, async () => {
  const f = fixture('material'); if (failure === 'assign') f.deps.assignMaterial = async () => { throw Error('write'); };
  if (failure === 'reread') f.deps.reloadMaterials = async () => { throw Error('read'); }; if (failure === 'unconfirmed') f.deps.reloadMaterials = async () => [];
  await f.controller.add(); await tick(); const picker = f.controller.getSnapshot().picker; await f.controller.selectMaterial(picker.id, picker.items[0]);
  assert.equal(f.calls.some(call => call[0] === 'changed'), false); assert.equal(f.calls.at(-1)[0], 'raw'); assert.ok(f.calls.at(-1)[1].startsWith('Biriktirilmadi: '));
  if (failure === 'unconfirmed') assert.ok(f.calls.at(-1)[1].includes('Biriktirish tasdiqlanmadi'));
});
test('material remove captures original responsibility/name, confirms absence, and allows cancel without writes', async () => {
  const f = fixture('material', { reloadMaterials: async () => [] }), original = f.deps.assignedMaterials()[0]; f.controller.requestRemove(original);
  const canceled = f.controller.getSnapshot().dialog.id; f.controller.dismissDialog(canceled); await f.controller.confirmRemove(canceled); assert.deepEqual(f.calls, []);
  f.controller.requestRemove(original); const dialog = f.controller.getSnapshot().dialog; f.assignedMaterials([]); await f.controller.confirmRemove(dialog.id);
  assert.deepEqual(f.calls, [['unassign', 'assigned'], ['changed', []], ['raw', 'Olib tashlandi: assigned']]);
});
test('material unassignment retained in reread fails verification and never publishes changed result', async () => {
  const f = fixture('material', { reloadMaterials: async () => [responsibility(' ASSIGNED ')] }); f.controller.requestRemove(f.deps.assignedMaterials()[0]);
  await f.controller.confirmRemove(f.controller.getSnapshot().dialog.id); assert.equal(f.calls.some(call => call[0] === 'changed'), false);
  assert.ok(f.calls.at(-1)[1].includes('Olib tashlash tasdiqlanmadi')); assert.equal(f.controller.getSnapshot().removing, null);
});
for (const stage of ['catalog', 'assign', 'reread', 'unassign']) test(`original editor scope retirement during ${stage} forbids continuation, parent updates and success notices`, async () => {
  for (const mode of ['warehouse', 'material']) {
    const wait = deferred(), f = fixture(mode); let pending;
    if (stage === 'catalog') { f.deps[mode === 'warehouse' ? 'warehouses' : 'materials'] = () => wait.promise; pending = f.controller.add(); }
    else if (stage === 'unassign') { f.deps[mode === 'warehouse' ? 'unassignWarehouse' : 'unassignMaterial'] = () => wait.promise;
      f.controller.requestRemove(mode === 'warehouse' ? 'Assigned' : f.deps.assignedMaterials()[0]); pending = f.controller.confirmRemove(f.controller.getSnapshot().dialog.id); }
    else { await f.controller.add(); await tick(); const picker = f.controller.getSnapshot().picker;
      f.deps[stage === 'assign' ? mode === 'warehouse' ? 'assignWarehouse' : 'assignMaterial' : mode === 'warehouse' ? 'reloadWarehouses' : 'reloadMaterials'] = () => wait.promise;
      if (mode === 'warehouse') { f.controller.selectWarehouse(picker.id, 'A'); pending = f.controller.confirmWarehouse(picker.id); } else pending = f.controller.selectMaterial(picker.id, picker.items[0]); }
    f.retire(); wait.resolve(mode === 'warehouse' ? { warehouse: 'A' } : responsibility('m')); await pending;
    assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.calls.some(call => Array.isArray(call) && ['changed', 'notice', 'raw'].includes(call[0])), false);
  }
});
test('detach/restart invalidates old picker IDs and operations without sticky account retirement; original invalidation stays sticky', async () => {
  const waiting = deferred(), f = fixture('warehouse', { warehouses: () => waiting.promise }); const old = f.controller.add(), generation = f.controller.interactionGeneration;
  f.controller.dispose(); f.controller.start(); f.deps.warehouses = async () => [{ warehouse: 'Fresh' }]; await f.controller.add(); const id = f.controller.getSnapshot().picker.id;
  waiting.resolve([{ warehouse: 'Stale' }]); await old; assert.notEqual(f.controller.interactionGeneration, generation); assert.deepEqual(f.controller.visibleWarehouses(), ['Fresh']);
  f.controller.dismissPicker(id - 1); assert.ok(f.controller.getSnapshot().picker); f.retire(); assert.equal(f.controller.isCurrent(), false); f.controller.dispose(); f.controller.start(); assert.equal(f.controller.isCurrent(), false);
});
test('reentrant synchronous catalog publication cannot issue next page work or schedule search after retirement', async () => {
  const f = fixture('material'); f.controller.subscribe(() => { if (f.controller.getSnapshot().picker) f.retire(); }); await f.controller.add(); await tick();
  assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.clock.size(), 0);
  const g = fixture('material'); await g.controller.add(); await tick(); const id = g.controller.getSnapshot().picker.id;
  g.controller.subscribe(() => { if (g.controller.getSnapshot().picker?.query) g.retire(); }); g.controller.search(id, 'change'); assert.equal(g.clock.size(), 0); assert.equal(g.controller.getSnapshot().phase, 'invalidated');
});
