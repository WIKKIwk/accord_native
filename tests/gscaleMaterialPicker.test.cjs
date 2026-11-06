const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/gscale', name);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => name === './gscaleCatalog' ? load('gscaleCatalog.ts') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { GScaleMaterialPicker } = load('gscaleMaterialPicker.ts');
const item = (code, name, microns, options = {}) => ({ code, name, order_microns: microns, order_apparatus_options: options });

test('material order expands micron choices, searches and caches the order catalog', async () => {
  const calls = [];
  const picker = new GScaleMaterialPicker(async (...args) => { calls.push(args); return [item('PET', 'Roll', [12, 20, 12])]; });
  assert.deepEqual((await picker.page('20', 0, 50, 'order-1', true)).map(value => value.micron), [20]);
  assert.equal((await picker.page('', 0, 50, 'order-1', true)).length, 2);
  assert.equal((await picker.singleOrderChoice('order-1')).micron, null);
  assert.deepEqual(calls, [['', 0, 200, 'order-1']]);
});

test('non-material order picker includes only products with apparatus options', async () => {
  const picker = new GScaleMaterialPicker(async () => [item('A', 'A', [12]), item('B', 'B', [20], { 'apparatus:1': 'One' })]);
  const result = await picker.page('', 0, 50, 'order-1', false);
  assert.deepEqual(result.map(value => [value.item.code, value.micron]), [['B', 20]]);
});

test('failed cached order read can be retried', async () => {
  let attempts = 0;
  const picker = new GScaleMaterialPicker(async () => { if (++attempts === 1) throw new Error('offline'); return [item('A', 'A', [12])]; });
  await assert.rejects(picker.orderChoices('o1'), /offline/);
  assert.equal((await picker.singleOrderChoice('o1')).micron, 12); assert.equal(attempts, 2);
});
