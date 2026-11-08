const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaItemPicker.ts'), mod = new Module(file, module);
mod.filename = file; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { RezkaItemPickerController } = mod.exports;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
test('initial read and 220ms debounce request only 30 items; submit cancels timer', async () => {
  const requests = []; let timer;
  const c = new RezkaItemPickerController({ isCurrent: () => true,
    load: async (query, limit) => { requests.push([query, limit]); return [{ code: query }]; },
    schedule: (fn, ms) => { const task = { fn, ms, cancelled: false }; timer = task; return () => { task.cancelled = true; }; } });
  c.start(); c.start(); await flush(); assert.deepEqual(requests, [['', 30]]);
  c.setQuery('a'); const first = timer; c.setQuery('film'); assert.equal(first.cancelled, true); assert.equal(timer.ms, 220);
  timer.fn(); await flush(); assert.deepEqual(requests.at(-1), ['film', 30]);
  c.setQuery('ink'); const pending = timer; c.submit(); assert.equal(pending.cancelled, true); await flush(); assert.deepEqual(requests.at(-1), ['ink', 30]);
});
test('late old response after a newer load is ignored and failure is the V2 empty state', async () => {
  const pending = [];
  const c = new RezkaItemPickerController({ isCurrent: () => true, load: query => new Promise((resolve, reject) => pending.push({ query, resolve, reject })) });
  c.start(); c.setQuery('new'); c.submit();
  pending[1].resolve([{ code: 'new' }]); await flush(); pending[0].resolve([{ code: 'old' }]); await flush();
  assert.equal(c.getSnapshot().items[0].code, 'new');
  c.setQuery('fail'); c.submit(); pending[2].reject(new Error('offline')); await flush();
  assert.deepEqual(c.getSnapshot().items, []); assert.equal(c.getSnapshot().loading, false);
});
test('scope invalidation clears old-account items and ignores late results', async () => {
  let current = true, finish;
  const c = new RezkaItemPickerController({ isCurrent: () => current, load: () => new Promise(resolve => { finish = resolve; }) });
  c.start(); current = false; finish([{ code: 'private' }]); await flush();
  assert.deepEqual(c.getSnapshot(), { query: '', items: [], loading: false });
});
