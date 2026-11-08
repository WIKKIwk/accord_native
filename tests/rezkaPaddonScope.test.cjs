// Source-derived from f11910bb: aparatchi_paddon_scope.dart, canonical_apparatus_groups.dart,
// aparatchi_navigation_drawer.dart, aparatchi_paddons_screen.dart and paddon_apparatus_scope_test.dart.
// These are not an executed Dart oracle, backend call, device test, or Paddon route test.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/rezka', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const model = load('rezkaPaddonScope.ts');
const { RezkaPaddonApparatusController } = load('rezkaPaddonApparatusController.ts', { './rezkaPaddonScope': model });
const row = (id, name, operation = 'cut', order = 10000, lifecycle = 'active') =>
  ({ id, name, operation, sort_order: order, lifecycle_state: lifecycle });
const paddon = (code, apparatus, itemCount, containsPeremotka = false) =>
  ({ code, apparatus_id: apparatus, item_count: itemCount, contains_peremotka: containsPeremotka });

test('selected V2 assignment example includes assigned cut, excluding assigned laminate', () => {
  const catalog = [row('rezka', 'Rezka'), row('rezka2', 'Rezka 2'), row('laminate', 'Laminatsiya', 'laminate')];
  assert.deepEqual(model.assignedPaddonApparatus(catalog, ['rezka2', 'laminate']).map(a => a.id), ['rezka2']);
});
test('only active normalized cut operations match exact trimmed assignments; source is not mutated', () => {
  const catalog = [row('z', 'Zed', ' cut ', 4), row('A', 'Alpha', 'CUT', 3), row('a', 'alpha', 'cut', 3),
    row('dead', 'Old', 'cut', 1, 'retired'), row('mixedState', 'Inactive spelling', 'cut', 1, 'Active'),
    row('other', 'Lamination', 'laminate', 1), row('notAssigned', 'Other', 'cut', 1)];
  const before = [...catalog];
  assert.deepEqual(model.assignedPaddonApparatus(catalog, [' z ', 'A', 'a', 'dead', 'mixedState', 'other', 'A'])
    .map(a => a.id), ['A', 'a', 'z']);
  assert.deepEqual(catalog, before); assert.deepEqual(model.assignedPaddonApparatus(catalog, [' A ']).map(a => a.id), ['A']);
  assert.deepEqual(model.assignedPaddonApparatus(catalog, [' A  ']).map(a => a.id), ['A']);
  assert.deepEqual(model.assignedPaddonApparatus(catalog, ['a ']).map(a => a.id), ['a']);
  assert.deepEqual(model.assignedPaddonApparatus([row(' padded ', 'Not normalized')], ['padded']), []);
});
test('cut entries sort by order then lowercased name, without using assignment or response order', () => {
  const rows = [row('last', 'Amber', 'cut', 2), row('bravo', 'bravo', 'cut', 1), row('alpha', 'ALPHA', 'cut', 1)];
  assert.deepEqual(model.assignedPaddonApparatus(rows, ['last', 'bravo', 'alpha']).map(a => a.id), ['alpha', 'bravo', 'last']);
});
test('unscoped page auto-selects one machine, but needs a choice for zero or many', () => {
  const a = row('a', 'First'), b = row('b', 'Second');
  assert.deepEqual(model.resolveRezkaPaddonScope([]), { apparatusId: '', apparatusName: '', needsApparatus: true });
  assert.deepEqual(model.resolveRezkaPaddonScope([a]), { apparatusId: 'a', apparatusName: 'First', needsApparatus: false });
  assert.deepEqual(model.resolveRezkaPaddonScope([a, b]), { apparatusId: '', apparatusName: '', needsApparatus: true });
  assert.deepEqual(model.resolveRezkaPaddonScope([a, b], ' b ', ' '), { apparatusId: 'b', apparatusName: 'Second', needsApparatus: false });
  assert.deepEqual(model.resolveRezkaPaddonScope([a, b], ' b ', ' Supplied '), { apparatusId: 'b', apparatusName: 'Supplied', needsApparatus: false });
  // As in V2 this is display resolution only, not an authorization decision for the unknown ID.
  assert.deepEqual(model.resolveRezkaPaddonScope([a], 'unknown'), { apparatusId: 'unknown', apparatusName: '', needsApparatus: false });
  assert.deepEqual(model.resolveRezkaPaddonScope([a, row('a', 'Last')], 'a'), { apparatusId: 'a', apparatusName: 'Last', needsApparatus: false });
});
test('scoped list filters exact apparatus again and computes displayed Paddon and WIP totals', () => {
  const rows = [paddon('0011', 'first', 2), paddon('4234', 'second', 3, true), paddon('0012', 'first', 4)];
  const scoped = model.rezkaPaddonList(rows, 'first');
  assert.deepEqual(scoped.paddons.map(p => p.code), ['0011', '0012']);
  assert.equal(scoped.paddonCount, 2); assert.equal(scoped.wipCount, 6);
  assert.deepEqual(model.rezkaPaddonList(rows, 'missing'), { paddons: [], paddonCount: 0, wipCount: 0 });
  assert.equal(model.rezkaPaddonList(rows, '').wipCount, 9); assert.equal(rows[1].contains_peremotka, true);
});
test('drawer skips an empty assignment catalog read; nonempty assignments share one read over suspend/resume', async () => {
  let calls = 0;
  const empty = new RezkaPaddonApparatusController({ assigned: [], isCurrent: () => true, load: async () => { calls++; return []; } });
  empty.resume(); await empty.start(); assert.equal(calls, 0); assert.deepEqual(empty.getSnapshot(), { phase: 'ready', apparatus: [] });
  let finish; const c = new RezkaPaddonApparatusController({ assigned: ['cut'], isCurrent: () => true,
    load: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  await c.start(); assert.equal(calls, 0); c.resume(); const pending = c.start(); c.suspend(); c.resume();
  assert.equal(c.start(), pending); finish([row('cut', 'Cut'), row('other', 'Other')]); await pending;
  assert.equal(calls, 1); assert.deepEqual(c.getSnapshot().apparatus.map(a => a.id), ['cut']);
  await c.start(); assert.equal(calls, 1); c.dispose(); empty.dispose();
});
test('drawer catalog failure or unassigned machine yields the same empty entries as V2 FutureBuilder', async () => {
  for (const load of [async () => { throw new Error('offline'); }, async () => [row('other', 'Other')]]) {
    const c = new RezkaPaddonApparatusController({ assigned: ['mine'], isCurrent: () => true, load });
    c.resume(); await c.start(); assert.deepEqual(c.getSnapshot(), { phase: 'ready', apparatus: [] }); c.dispose();
  }
});
test('sync rejection cannot reenter and duplicate the catalog request', async () => {
  let calls = 0; const c = new RezkaPaddonApparatusController({ assigned: ['mine'], isCurrent: () => true,
    load: () => { calls++; throw new Error('stale'); } });
  const unsubscribe = c.subscribe(() => { void c.start(); }); c.resume(); await c.start();
  assert.equal(calls, 1); assert.equal(c.getSnapshot().phase, 'ready'); unsubscribe(); c.dispose();
});
test('late results are redacted after scope loss, reset or disposal and never trigger a new read', async () => {
  for (const reason of ['scope', 'reset', 'dispose']) {
    let current = true, finish, calls = 0;
    const c = new RezkaPaddonApparatusController({ assigned: ['mine'], isCurrent: () => current,
      load: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
    c.resume(); const pending = c.start();
    if (reason === 'scope') current = false; else if (reason === 'reset') c.invalidate(); else c.dispose();
    finish([row('mine', 'Mine')]); await pending; current = true; c.resume(); await c.start();
    assert.deepEqual(c.getSnapshot(), { phase: 'invalid', apparatus: [] }, reason); assert.equal(calls, 1);
  }
});
test('a suspended result is published only if the same owner resumes while valid', async () => {
  let finish; const c = new RezkaPaddonApparatusController({ assigned: ['mine'], isCurrent: () => true,
    load: () => new Promise(resolve => { finish = resolve; }) });
  c.resume(); const pending = c.start(); c.suspend(); finish([row('mine', 'Mine')]); await pending;
  assert.equal(c.getSnapshot().phase, 'loading'); c.resume(); assert.equal(c.getSnapshot().phase, 'ready'); c.dispose();
});
test('scope lost between resume and start retires without sending a request', async () => {
  let current = true, calls = 0;
  const c = new RezkaPaddonApparatusController({ assigned: ['mine'], isCurrent: () => current,
    load: async () => { calls++; return [row('mine', 'Mine')]; } });
  c.resume(); current = false; await c.start();
  assert.equal(calls, 0); assert.deepEqual(c.getSnapshot(), { phase: 'invalid', apparatus: [] }); c.dispose();
});
