const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminCustomerChildrenSupport.cjs');

test('apparatus assignment uses first trimmed case-sensitive identity; Aparatchi uses role ID and material keeps its original role/groups', () => {
  const wrongCase = s.role({ principal_ref: 'DTO REF' }), ordinary = s.role({ principal_role: 'customer', role_id: ' APARATCHI ' }), later = s.role({ assigned_apparatus: ['A'] });
  assert.equal(s.apparatusModel.adminCustomerApparatusAssignment([wrongCase, ordinary, later], ' dto ref ', false), ordinary);
  assert.equal(s.apparatusModel.adminCustomerApparatusVisible(ordinary, false), true); assert.equal(s.apparatusModel.adminCustomerApparatusVisible(s.role({ role_id: 'worker' }), false), false);
  assert.deepEqual(s.apparatusModel.adminCustomerApparatusUpsert(' raw ref ', false, ordinary, ['z', 'A']), { principal_role: 'aparatchi', principal_ref: 'raw ref', role_id: 'aparatchi', assigned_apparatus: ['A', 'z'], assigned_item_groups: [] });
  const material = s.role({ principal_role: 'material_taminotchi', role_id: ' Custom ', assigned_item_groups: [' Preserve ', 'dup', 'dup'] });
  assert.equal(s.apparatusModel.adminCustomerApparatusAssignment([ordinary, material], ' dto ref ', true), material);
  assert.deepEqual(s.apparatusModel.adminCustomerApparatusUpsert('ignored ref', true, material, ['B', 'A']), { principal_role: 'material_taminotchi', principal_ref: 'dto ref', role_id: 'Custom', assigned_apparatus: ['A', 'B'], assigned_item_groups: material.assigned_item_groups });
});
test('apparatus card starts both guarded source reads in parallel and retains catalog/selection order without default picking', async t => {
  const roles = s.deferred(), catalog = s.deferred(), calls = [], f = s.apparatusFixture(t, { assignments: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('roles'); return roles.promise; },
    apparatus: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('catalog'); return catalog.promise; } });
  f.controller.start(); assert.deepEqual(calls, ['roles', 'catalog']); roles.resolve([s.role({ assigned_apparatus: [' B ', 'B', 'B'] })]); catalog.resolve([s.machine('Z'), s.machine('A')]); await s.flush();
  assert.deepEqual(f.controller.getSnapshot().apparatus.map(item => item.id), ['Z', 'A']); assert.deepEqual(f.controller.getSnapshot().selected, [' B ', 'B']); assert.equal(f.controller.getSnapshot().loading, false);
});
test('apparatus save validates only source empty selection, sorts the captured selection, calls genuine change, shows saved then reloads', async t => {
  const pending = s.deferred(), f = s.apparatusFixture(t, { save: async (input, guard) => { guard(); f.calls.push(['save', input]); await pending.promise; } }); await f.start();
  f.controller.toggle('B', false); assert.equal(await f.controller.save(), false); assert.equal(f.controller.getSnapshot().notice.key, 'scope.select_required');
  f.controller.toggle('A', true); f.controller.toggle('B', true); const saving = f.controller.save(); assert.equal(f.controller.getSnapshot().saving, true);
  f.controller.toggle('A', false); assert.deepEqual(f.calls[2][1].assigned_apparatus, ['A', 'B'], 'editing while saving does not retarget the accepted payload'); assert.equal(f.changed, 0);
  pending.resolve(); assert.equal(await saving, true); assert.equal(f.changed, 1); assert.equal(f.controller.getSnapshot().notice.key, 'scope.saved'); assert.deepEqual(f.calls.slice(-2), ['roles', 'apparatus']);
  assert.deepEqual(f.controller.getSnapshot().selected, ['B']); assert.equal(f.controller.getSnapshot().saving, false);
});
test('material apparatus sheet captures its own list/selection, allows editing while saving and stays visible through reload before native dismissal', async t => {
  const pending = s.deferred(), refresh = s.deferred(); let reads = 0;
  const f = s.apparatusFixture(t, { material: true, assignments: async () => ++reads === 1 ? [s.role({ principal_role: 'material_taminotchi' })] : refresh.promise,
    save: async (input, guard) => { guard(); f.calls.push(['save', input]); await pending.promise; } }); await f.start(); f.controller.openSheet(); const sheet = f.controller.getSnapshot().sheet;
  f.controller.toggle('A', true, sheet.id); const saving = f.controller.save(sheet.id); f.controller.toggle('B', false, sheet.id); assert.equal(f.controller.getSnapshot().sheet.saving, true);
  assert.deepEqual(f.calls.at(-1)[1].assigned_apparatus, ['A', 'B']); pending.resolve(); await s.flush(); assert.equal(f.changed, 1); assert.equal(f.controller.getSnapshot().loading, true); assert.equal(f.controller.getSnapshot().sheet.id, sheet.id);
  refresh.resolve([s.role({ principal_role: 'material_taminotchi', assigned_apparatus: ['A', 'B'] })]); assert.equal(await saving, true); assert.equal(f.controller.getSnapshot().sheet.closing, true); assert.equal(f.controller.getSnapshot().sheet.saving, true);
  f.controller.dismissSheet(sheet.id); assert.equal(f.controller.getSnapshot().sheet, null);
});
test('material apparatus outside dismissal does not cancel its accepted parent save, and failure/empty keeps a still-owned sheet editable', async t => {
  const pending = s.deferred(), f = s.apparatusFixture(t, { material: true, assignments: async () => [s.role({ principal_role: 'material_taminotchi' })], save: async () => pending.promise }); await f.start();
  f.controller.openSheet(); const sheet = f.controller.getSnapshot().sheet; const saving = f.controller.save(sheet.id); f.controller.dismissSheet(sheet.id); pending.resolve(); assert.equal(await saving, true); assert.equal(f.controller.getSnapshot().sheet, null); assert.equal(f.changed, 1);
  f.controller.openSheet(); const next = f.controller.getSnapshot().sheet; f.controller.toggle('B', false, next.id); assert.equal(await f.controller.save(next.id), false); assert.equal(f.controller.getSnapshot().sheet.saving, false);
  f.controller.toggle('A', true, next.id); f.deps.save = async () => { throw Error('offline'); }; assert.equal(await f.controller.save(next.id), false); assert.equal(f.controller.getSnapshot().notice.key, 'scope.save_failed'); assert.equal(f.controller.getSnapshot().sheet.saving, false);
});
test('apparatus late reads/save acknowledgments and callbacks cannot cross owner cleanup or original auth retirement', async t => {
  const pending = s.deferred(), f = s.apparatusFixture(t, { save: async () => pending.promise }); await f.start(); const saving = f.controller.save(); f.controller.dispose(); f.controller.start(); await s.flush(); pending.resolve(); assert.equal(await saving, false); assert.equal(f.changed, 0);
  const read = s.deferred(), stale = s.apparatusFixture(t, { assignments: async () => read.promise }); stale.controller.start(); stale.retire(); read.resolve([s.role()]); await s.flush(); assert.equal(stale.controller.getSnapshot().valid, false); assert.deepEqual(stale.controller.getSnapshot().apparatus, []);
});
test('apparatus strict/reentrant guards stop requests on malformed authority and before a reentrant busy publication', async t => {
  const f = s.apparatusFixture(t); await f.start(); f.deps.isCurrent = () => { f.controller.dispose(); return true; }; const count = f.calls.length; assert.equal(await f.controller.save(), false); assert.equal(f.calls.length, count);
  const retired = s.apparatusFixture(t); await retired.start(); retired.controller.subscribe(() => { if (retired.controller.getSnapshot().saving) retired.retire(); }); assert.equal(await retired.controller.save(), false); assert.equal(retired.calls.filter(Array.isArray).length, 0);
  for (const predicate of [() => 'yes', async () => true, () => Promise.reject(Error('async'))]) { const invalid = s.apparatusFixture(t, { isCurrent: predicate }); invalid.controller.start(); await s.flush(); assert.equal(invalid.calls.length, 0); assert.equal(invalid.controller.getSnapshot().valid, false); }
});
test('apparatus successful write retains source saved result when the subsequent reload fails', async t => {
  const f = s.apparatusFixture(t); await f.start(); f.deps.apparatus = async () => { throw Error('reload offline'); }; assert.equal(await f.controller.save(), true);
  assert.equal(f.changed, 1); assert.equal(f.controller.getSnapshot().notice.key, 'scope.saved'); assert.equal(f.controller.getSnapshot().error.message, 'reload offline'); assert.equal(f.controller.getSnapshot().saving, false);
});
test('apparatus Future.wait keeps loading until both reads settle, preserves the first error and expires their original request witnesses', async t => {
  const roles = s.deferred(), catalog = s.deferred(), first = Error('catalog first'); let roleGuard, catalogWitness;
  const f = s.apparatusFixture(t, { assignments: async guard => { roleGuard = guard; return roles.promise; }, apparatus: async (_guard, witness) => { catalogWitness = witness; return catalog.promise; } });
  f.controller.start(); catalog.reject(first); await s.flush(); assert.equal(f.controller.getSnapshot().loading, true); roles.reject(Error('roles later')); await s.flush();
  assert.equal(f.controller.getSnapshot().loading, false); assert.equal(f.controller.getSnapshot().error, first); assert.throws(roleGuard, /read settled/); assert.throws(catalogWitness, /read settled/);
});
test('a material assignment missing after an open sheet read retains the source missing-assignment validation and cannot upsert another principal', async t => {
  const f = s.apparatusFixture(t, { material: true, assignments: async () => [s.role({ principal_role: 'material_taminotchi' })] }); await f.start(); f.controller.openSheet(); const id = f.controller.getSnapshot().sheet.id;
  f.deps.assignments = async () => []; await f.controller.load(); assert.equal(await f.controller.save(id), false); assert.equal(f.controller.getSnapshot().notice.key, 'scope.material_supplier_missing'); assert.equal(f.calls.filter(Array.isArray).length, 0);
});
test('a material sheet retains its independent local saving barrier through an empty-validation future', async t => {
  const f = s.apparatusFixture(t, { material: true, assignments: async () => [s.role({ principal_role: 'material_taminotchi' })] }); await f.start(); f.controller.openSheet(); const id = f.controller.getSnapshot().sheet.id;
  f.controller.toggle('B', false, id); const first = f.controller.save(id), notice = f.controller.getSnapshot().notice;
  assert.equal(f.controller.getSnapshot().sheet.saving, true); assert.equal(await f.controller.save(id), false); assert.equal(f.controller.getSnapshot().notice, notice); assert.equal(await first, false); assert.equal(f.controller.getSnapshot().sheet.saving, false);
});
