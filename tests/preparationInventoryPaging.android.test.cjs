const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('inventory pages keep live leases, append by offset and reset on query change', () => {
  const slots = [], effects = [], acquired = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i];
      if (!old || deps.some((value, n) => value !== old.deps[n])) effects.push(() => {
        old?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      }); },
  };
  const mocks = { react, 'expo-router': {}, 'react-native': {}, '../appPreferences': {}, '../auth': {}, '../inventoryReadApi': {}, '../sessionReadScope': {},
    './preparationInventory': {}, './preparationInventoryTransfers': {} };
  const filename = path.resolve(__dirname, '../src/preparation/usePreparationInventory.android.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  const source = fs.readFileSync(filename, 'utf8') + '\nexport { usePagedWindow };\n';
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const acquire = offset => { const lease = { rows: offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ id: i })) : [{ id: 100 }],
    loading: false, error: null, addListener() {}, removeListener() {}, dispose() { lease.disposed = true; }, refresh: async () => {} };
    acquired.push([offset, lease]); return lease; };
  const identity = row => String(row.id);
  const render = key => { cursor = 0; const result = mod.exports.usePagedWindow(key, acquire, identity, true);
    while (effects.length) effects.shift()(); return result; };
  render('first'); let current = render('first');
  assert.equal(current.rows.length, 100); assert.equal(current.hasMore, true);
  current.loadMore(); current.loadMore();
  render('first'); current = render('first');
  assert.deepEqual(acquired.map(([offset]) => offset), [0, 100]);
  assert.equal(acquired[0][1].disposed, undefined);
  assert.equal(current.rows.length, 101); assert.equal(current.hasMore, false);
  render('second'); current = render('second');
  assert.equal(acquired[0][1].disposed, true); assert.equal(acquired[1][1].disposed, true);
  assert.deepEqual(acquired.map(([offset]) => offset), [0, 100, 0]);
  assert.equal(current.rows.length, 100);
});
