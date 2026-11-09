const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), mod = new Module(filename, module); cache.set(name, mod);
  mod.require = key => key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { QolipStorageReadState } = load('qolip/qolipStorageReadState.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const page = (items = [], next_offset = null) => ({ items, next_offset });
const entry = (id, kind = 'paddon') => ({ id, code: id, kind });
function harness(archive = true, supplied = {}) {
  let current = true; const listeners = new Set(), calls = [], frames = [];
  const owner = new QolipStorageReadState(archive, { current: () => current, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } }, {
    archive: async (input, guard) => { calls.push(['archive', input, guard]); return supplied.archive ? supplied.archive(input, guard) : page(); },
    paddons: async (input, guard) => { calls.push(['paddons', input, guard]); return supplied.paddons ? supplied.paddons(input, guard) : page(); },
    warehouses: async guard => { calls.push(['warehouses', guard]); return supplied.warehouses ? supplied.warehouses(guard) : ['One', 'Two']; },
    scheduleFrame: fn => frames.push(fn),
  });
  return { owner, calls, frames, listeners, activate: () => owner.activate(),
    frame: async () => { const ready = frames.splice(0); ready.forEach(fn => fn()); await tick(); },
    expire: () => { current = false; [...listeners].forEach(fn => fn()); }, revive: () => { current = true; } };
}
test('storage read construction and inactive events do not fetch', async () => {
  const h = harness(); await h.owner.load(); h.owner.setQuery('old'); await h.owner.chooseKind('qolip'); assert.equal(h.calls.length, 0);
  h.activate(); await h.owner.load(); assert.equal(h.calls.length, 1); assert.equal(h.owner.getSnapshot().loading, false); h.owner.suspend();
});
test('archive search invalidates an older page immediately, debounces 300ms and trims only the request', async () => {
  const pending = deferred(), h = harness(true, { archive: input => input.query === 'new' ? page([entry('new')]) : pending.promise });
  h.activate(); const old = h.owner.load(); const guard = h.calls[0][2]; h.owner.setQuery(' new ');
  assert.equal(guard(), false); assert.equal(h.owner.getSnapshot().searchPending, true); assert.equal(h.owner.getSnapshot().query, ' new ');
  pending.resolve(page([entry('late')])); await old; assert.deepEqual(h.owner.getSnapshot().archive, []);
  await new Promise(resolve => setTimeout(resolve, 330));
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1][1].query, 'new'); assert.deepEqual(h.owner.getSnapshot().archive.map(x => x.id), ['new']); h.owner.suspend();
});
test('paddon search preserves V2 older-read adoption during debounce without leaking across a role boundary', async () => {
  const pending = deferred(), h = harness(false, { paddons: () => pending.promise }); h.activate();
  const old = h.owner.load(); h.owner.setQuery('new'); pending.resolve(page([{ code: 'old' }])); await old;
  assert.equal(h.owner.getSnapshot().paddons[0].code, 'old'); h.expire(); assert.deepEqual(h.owner.getSnapshot().paddons, []); h.owner.suspend();
});
test('archive auto-pagination uses ready viewport dimensions and strict extentAfter < 240', async () => {
  const h = harness(true, { archive: input => page([entry(`row-${input.offset}`)], input.offset ? null : 25) }); h.activate();
  await h.owner.load(); h.owner.viewportChanged(0, false); await h.frame(); assert.equal(h.calls.length, 1);
  h.owner.viewportChanged(240); await h.frame(); assert.equal(h.calls.length, 1);
  h.owner.viewportChanged(239); await h.frame(); assert.equal(h.calls.length, 2);
  assert.deepEqual(h.owner.getSnapshot().archive.map(x => x.id), ['row-0', 'row-25']); h.owner.suspend();
});
test('empty client-filtered pages continue regardless of distance and a later failure stops automatic retries', async () => {
  let fail = true; const h = harness(true, { archive: input => {
    if (!input.offset) return page([entry('mold', 'qolip')], 1);
    if (fail) throw new Error('offline'); return page([entry('pallet')]);
  } }); h.activate(); h.owner.viewportChanged(1000); await h.owner.chooseKind('paddon'); await h.frame();
  assert.equal(h.calls.length, 2); assert.equal(h.owner.getSnapshot().moreFailure, true);
  await h.frame(); assert.equal(h.calls.length, 2); fail = false; await h.owner.load(true);
  assert.deepEqual(h.owner.getSnapshot().visibleArchive.map(x => x.id), ['pallet']); assert.equal(h.owner.getSnapshot().error, null); h.owner.suspend();
});
for (const invalid of [page([], 1), page([entry('bad')], 0)]) test('invalid archive continuation stops loading without looping', async () => {
  const h = harness(true, { archive: () => invalid }); h.activate(); h.owner.viewportChanged(0); await h.owner.load(); await h.frame();
  assert.equal(h.calls.length, 1); assert.equal(h.owner.getSnapshot().error.code, 'qolip_storage_invalid_page'); assert.equal(h.owner.getSnapshot().loading, false); h.owner.suspend();
});
test('archive kind/status/warehouse/dates preserve source query fields and clearing filters keeps history/search', async () => {
  const h = harness(); h.activate(); h.owner.setQuery(' Q '); await h.owner.chooseKind('qolip');
  await h.owner.setHistory(true); await h.owner.chooseWarehouse(' W ');
  const from = new Date(2026, 0, 1), to = new Date(2026, 0, 4); await h.owner.chooseDates({ from, to });
  let input = h.calls.at(-1)[1]; assert.equal(input.status, 'all'); assert.equal(input.view, 'molds'); assert.equal(input.warehouse, ' W '); assert.equal(input.query, 'Q');
  assert.equal(input.from.getTime(), from.getTime()); from.setFullYear(2000); assert.equal(h.owner.getSnapshot().dates.from.getFullYear(), 2026);
  const count = h.calls.length; await h.owner.chooseDates(null); assert.equal(h.calls.length, count);
  await h.owner.clearFilters(); input = h.calls.at(-1)[1]; assert.equal(input.status, 'all'); assert.equal(input.query, 'Q'); assert.equal(input.view, ''); assert.equal(input.warehouse, ''); assert.equal(input.from, undefined); h.owner.suspend();
});
test('saving locks the source history toggle while kind/warehouse filters retain their source behavior', async () => {
  const h = harness(); h.activate(); h.owner.setSaving(true); await h.owner.setHistory(true); assert.equal(h.calls.length, 0);
  await h.owner.chooseKind('paddon'); assert.equal(h.calls.length, 1); assert.equal(h.owner.getSnapshot().history, false); h.owner.suspend();
});
test('mold kind includes paddon_mold entries while a paddon kind excludes them', async () => {
  const rows = [entry('a', 'paddon'), entry('b', 'qolip'), entry('c', 'paddon_mold')], h = harness(true, { archive: () => page(rows) }); h.activate();
  await h.owner.chooseKind('qolip'); assert.deepEqual(h.owner.getSnapshot().visibleArchive.map(x => x.id), ['b', 'c']);
  await h.owner.chooseKind('paddon'); assert.deepEqual(h.owner.getSnapshot().visibleArchive.map(x => x.id), ['a']); h.owner.suspend();
});
test('duplicate pagination while loading is refused and paddons keep the explicit-more behavior', async () => {
  const pending = deferred(), h = harness(false, { paddons: input => input.offset ? pending.promise : page([{ code: 'A' }], 100) }); h.activate(); await h.owner.load();
  h.owner.viewportChanged(0); await h.frame(); assert.equal(h.calls.length, 1);
  const more = h.owner.load(true); await h.owner.load(true); assert.equal(h.calls.length, 2); pending.resolve(page([{ code: 'B' }])); await more;
  assert.deepEqual(h.owner.getSnapshot().paddons.map(x => x.code), ['A', 'B']); h.owner.suspend();
});
test('warehouse filters are exclusive, reuse pending fetch, and return source notice errors without inventing inline text', async () => {
  const pending = deferred(), h = harness(true, { warehouses: () => pending.promise }); h.activate(); h.owner.toggleKindFilter();
  const load = h.owner.toggleWarehouseFilter(); assert.equal(h.owner.getSnapshot().kindExpanded, false); assert.equal(h.owner.getSnapshot().warehouseLoading, true);
  await h.owner.toggleWarehouseFilter(); assert.equal(h.owner.getSnapshot().warehouseExpanded, false);
  await h.owner.toggleWarehouseFilter(); assert.equal(h.calls.length, 1); pending.resolve(['W']); await load;
  assert.deepEqual(h.owner.getSnapshot().warehouses, ['W']); h.owner.suspend();
  const failure = new Error('warehouse'), f = harness(true, { warehouses: () => { throw failure; } }); f.activate();
  assert.equal(await f.owner.toggleWarehouseFilter(), failure); assert.equal(f.owner.getSnapshot().warehouseLoading, false); f.owner.suspend();
});
test('expired original boundary clears data/timers, rejects pending success/error and never revives after ABA', async () => {
  for (const reject of [false, true]) {
    const pending = deferred(), h = harness(true, { archive: () => pending.promise }); h.activate(); const request = h.owner.load(); h.owner.setQuery('private');
    h.expire(); h.revive(); if (reject) pending.reject(new Error('late')); else pending.resolve(page([entry('private')])); await request;
    assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.owner.getSnapshot().query, ''); assert.deepEqual(h.owner.getSnapshot().archive, []);
    await h.owner.load(); assert.equal(h.calls.length, 1); assert.equal(h.listeners.size, 0); h.owner.suspend();
  }
});
test('suspension retires old read/filter/frame callbacks even if the same owner activates again', async () => {
  const pending = deferred(), h = harness(true, { archive: () => pending.promise, warehouses: () => pending.promise }); h.activate(); const a = h.owner.load(); const b = h.owner.toggleWarehouseFilter();
  h.owner.suspend(); h.activate(); pending.resolve(page([entry('old')], 1)); await Promise.all([a, b]); await h.frame();
  assert.deepEqual(h.owner.getSnapshot().archive, []); assert.deepEqual(h.owner.getSnapshot().warehouses, []); assert.equal(h.owner.getSnapshot().loading, false); h.owner.suspend();
});
test('subscriber failures do not suppress invalidation and invalidation during loading publication prevents dispatch', async () => {
  const h = harness(); h.activate(); const seen = [];
  h.owner.subscribe(() => { throw new Error('observer'); }); h.owner.subscribe(async () => { throw new Error('async observer'); });
  h.owner.subscribe(() => { seen.push(h.owner.getSnapshot().invalid); if (h.owner.getSnapshot().loading) h.expire(); });
  await h.owner.load(); await tick(); assert.equal(h.calls.length, 0); assert.equal(seen.at(-1), true); h.owner.suspend();
});
