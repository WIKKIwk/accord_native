const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/qolip/qolipMileageState.ts'), m = new Module(filename, module);
m.require = key => key === './qolipReworkApi' ? {} : require(key);
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { QolipMileageState } = m.exports;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const mileage = { qolip_code: 'Q', tracking_enabled: true, current_meter: 0, cycles: [] };

test('mileage loads real data and never fabricates a zero for an error', async () => {
  let reads = 0; const state = new QolipMileageState(async () => { if (++reads === 1) throw new Error('offline'); return mileage; });
  await assert.rejects(state.load(), /offline/); assert.equal(state.getSnapshot().mileage, null); assert.ok(state.getSnapshot().error);
  await state.load(); assert.equal(state.getSnapshot().mileage, mileage); assert.equal(state.getSnapshot().error, false);
});
test('latest mileage request wins and a disposed sheet ignores late data', async () => {
  const a = deferred(), b = deferred(); let reads = 0; const state = new QolipMileageState(() => ++reads === 1 ? a.promise : b.promise);
  const first = state.load(), second = state.load(); b.resolve(mileage); await second; a.resolve({ ...mileage, qolip_code: 'old' }); await first;
  assert.equal(state.getSnapshot().mileage.qolip_code, 'Q'); const c = deferred(), next = new QolipMileageState(() => c.promise);
  const pending = next.load(); next.dispose(); c.resolve(mileage); await pending; assert.equal(next.getSnapshot().mileage, null);
});


test('even a null rejection displays the error state rather than a fabricated empty result', async () => {
  const state = new QolipMileageState(async () => { throw null; });
  await assert.rejects(state.load(), error => error === null);
  assert.equal(state.getSnapshot().error, true); assert.equal(state.getSnapshot().mileage, null);
});
