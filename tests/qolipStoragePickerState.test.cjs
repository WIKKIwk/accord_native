const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.resolve(__dirname, '../src', name), mod = new Module(filename, module); cache.set(name, mod);
  mod.require = key => key === './qolipStorageApi' ? { qolipPaddonCodeFromQr: raw => /^qolip-paddon:QP-[0-9]{5,}$/.test(raw.trim()) ? raw.trim().slice(13) : null }
    : key.startsWith('.') ? load(`${path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { QolipStoragePickerState } = load('qolip/qolipStoragePickerState.ts');
const page = (items = [], next_offset = null) => ({ items, next_offset });
const mold = (code, extra = {}) => ({ code, available: true, warehouse: 'W', set_id: 'S', products: [{ code: 'ITEM', name: 'Product' }], ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(input = {}, read = async () => page()) {
  let current = true; const notices = [], calls = [];
  const owner = new QolipStoragePickerState(input.warehouse, input.paddonCode, input.scan ?? false, {
    current: () => current, read: async (query, guard) => { calls.push({ query, guard }); return read(query, guard); }, notice: (...args) => notices.push(args), confirmDiscard: async () => input.discard ?? true,
  });
  return { owner, notices, calls, expire: () => { current = false; } };
}
test('picker source query retires older page immediately and debounces 300ms', async () => {
  const pending = deferred(), h = fixture({}, input => input.query === 'next' ? page([mold('next')]) : pending.promise);
  const old = h.owner.load(); const guard = h.calls[0].guard; h.owner.setQuery(' next '); assert.equal(guard(), false);
  pending.resolve(page([mold('old')])); await old; assert.deepEqual(h.owner.molds, []);
  await new Promise(resolve => setTimeout(resolve, 330)); assert.equal(h.owner.molds[0].code, 'next'); assert.equal(h.calls[1].query.query, 'next'); h.owner.dispose();
});
test('group selection resolves all product pages and keeps only eligible warehouse molds', async () => {
  const h = fixture({ warehouse: 'W' }, input => input.offset === 100 ? page([mold('B'), mold('Wrong', { warehouse: 'Other' })]) : page([mold('A')], 100));
  await h.owner.load(); const group = h.owner.groups()[0]; await h.owner.toggleProduct(group);
  assert.deepEqual([...h.owner.selected.keys()], ['a', 'b']); assert.equal(h.owner.productSelection(group), true);
  await h.owner.toggleProduct(group); assert.equal(h.owner.selected.size, 0);
});
test('exact scans serialize requests, reject mismatched/ambiguous pages and duplicates', async () => {
  const pending = deferred(), order = []; const h = fixture({ paddonCode: 'QP-00001', scan: true }, async input => {
    order.push(input.code); if (input.code === 'A') return pending.promise;
    return input.code === 'B' ? page([mold('B')]) : page([mold('Other')]);
  });
  const a = h.owner.scan('A'), b = h.owner.scan('B'); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(order, ['A']);
  pending.resolve(page([mold('A')])); await Promise.all([a, b]); assert.deepEqual(order, ['A', 'B']); assert.deepEqual([...h.owner.selected.keys()], ['a', 'b']);
  await h.owner.scan('A'); assert.equal(order.length, 2); assert.equal(h.notices.at(-1)[0], 'duplicate');
  await h.owner.scan('missing'); assert.equal(h.owner.selected.size, 2); assert.equal(h.notices.at(-1)[0], 'not_found');
});
test('leaving or changing scan generation retires queued and late detections', async () => {
  const pending = deferred(), h = fixture({ scan: true }, () => pending.promise);
  const operation = h.owner.scan('A'); await new Promise(resolve => setImmediate(resolve)); h.owner.changeMode(false);
  pending.resolve(page([mold('A')])); await operation; assert.equal(h.owner.selected.size, 0); assert.equal(h.owner.pendingScans, 0);
});
test('product incomplete pagination fails without selecting a partial product', async () => {
  const h = fixture({}, () => page([mold('A')], 10000)); await h.owner.load();
  const group = h.owner.groups()[0]; await h.owner.toggleProduct(group);
  assert.equal(h.owner.selected.size, 0); assert.equal(h.owner.productErrors.get(group.key).code, 'qolip_product_load_limit');
});
test('new-account result cannot revive original picker or produce a confirmed selection', async () => {
  const pending = deferred(), h = fixture({ scan: true }, () => pending.promise); const operation = h.owner.scan('A');
  await new Promise(resolve => setImmediate(resolve)); h.expire(); pending.resolve(page([mold('A')])); await operation;
  assert.equal(h.owner.selected.size, 0); assert.equal(h.owner.finish(), null);
});
test('discard cancellation preserves selected molds and successful finish returns insertion order', async () => {
  const h = fixture({ scan: true, discard: false }); h.owner.toggle(mold('B')); h.owner.toggle(mold('A'));
  assert.equal(await h.owner.leave(), false); assert.deepEqual(h.owner.finish().map(row => row.code), ['B', 'A']); assert.equal(h.owner.current(), false);
});
