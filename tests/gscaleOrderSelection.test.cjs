const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => name === '../shared/searchNormalizer' ? load('shared/searchNormalizer.ts') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { GScaleOrderSelectionStore } = load('gscale/gscaleOrderSelection.ts');
const order = (id, saved = false) => ({ id, code: id.toUpperCase(), title: 'Zakaz', order_kg: '10', saved, width_mm: 500 });

test('order loaded while locked is published only after unlocking', async () => {
  const published = [], selected = order('o1');
  const store = new GScaleOrderSelectionStore(selected, true, async () => [selected, order('o2', true)], value => published.push(value));
  await store.load();
  assert.deepEqual(published, []); assert.equal(store.getSnapshot().orders.length, 1);
  store.setDisabled(false); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, [selected]); assert.equal(store.widthLabel, 'Order eni: 500 mm');
  store.dispose();
});

test('an initial order absent from the refreshed list is cleared and published', async () => {
  const published = [], store = new GScaleOrderSelectionStore(order('old'), false, async () => [order('new')], value => published.push(value));
  await store.load();
  assert.equal(store.getSnapshot().selectedId, null); assert.deepEqual(published, [null]);
  assert.deepEqual(store.page('new', 0, 50).map(value => value.id), ['new']);
  store.dispose();
});

test('a disabled picker cannot change the order', async () => {
  const published = [], selected = order('o1');
  const store = new GScaleOrderSelectionStore(null, false, async () => [selected], value => published.push(value));
  await store.load(); store.setDisabled(true); store.select(selected);
  assert.equal(store.getSnapshot().selectedId, null); assert.deepEqual(published, [null]);
  store.dispose();
});
