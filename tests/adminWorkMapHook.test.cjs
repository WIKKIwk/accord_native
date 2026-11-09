const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
test('Work Map hook owns one default workspace and invalidates it on its original witness transition', async () => {
  let current = true, operation = true, onWitness, workspace, dependencies, profileRef, pageWitness, catalogWitness; const calls = [], cleanups = [];
  const session = { profile: { ref: 'me' } }, list = { rows: [] }, snapshot = { list, module: 'sequence' };
  class Workspace {
    constructor(deps) { dependencies = deps; workspace = this; this.window = {}; }
    getSnapshot = () => snapshot; subscribe = () => () => {};
    start() { calls.push('start'); } invalidate() { calls.push('invalidate'); } dispose() { calls.push('dispose'); }
  }
  class Selection { constructor(_storage, ref) { profileRef = ref; } }
  const filename = path.resolve(__dirname, '../src/admin/useAdminWorkMap.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const mocks = {
    react: { useMemo: fn => fn(), useSyncExternalStore: (_sub, read) => read(), useEffect: fn => cleanups.push(fn()) },
    '../auth': { subscribeSessionWitness: fn => { onWitness = fn; return () => calls.push('unsubscribe'); } },
    '../shared/adminSequenceApparatusStore': { AdminSequenceApparatusStore: Selection }, './adminWorkMapWorkspace': { AdminWorkMapWorkspace: Workspace },
    './adminWorkMapReader': { adminWorkMapReader: (_session, witness) => { pageWitness = witness; return request => request; },
      adminWorkMapCatalogReader: (_session, witness) => { catalogWitness = witness; return () => []; } },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const witness = () => current, result = mod.exports.useAdminWorkMap(session, witness);
  assert.equal(result.state, list); assert.equal(result.controller, workspace.window); assert.equal(result.workspaceState, snapshot);
  assert.equal(dependencies.isCurrent, witness);
  assert.deepEqual(dependencies.read({ view: 'orders' }, () => operation), { view: 'orders' });
  assert.deepEqual(dependencies.readCatalog(() => operation), []); assert.equal(pageWitness(), true); assert.equal(catalogWitness(), true);
  operation = false; assert.equal(pageWitness(), false); assert.equal(catalogWitness(), false); operation = true;
  assert.equal(profileRef(), 'me'); assert.deepEqual(calls, ['start']); current = false; assert.equal(pageWitness(), false); assert.equal(catalogWitness(), false); onWitness(); assert.deepEqual(calls, ['start', 'invalidate']);
  cleanups.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(calls, ['start', 'invalidate', 'unsubscribe', 'dispose']);
});
