const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/qolip/qolipStorageIntent.ts');
const mod = new Module(filename, module);
mod.require = id => id === './qolipReworkRequestId' ? { newQolipReworkRequestId: async () => { throw new Error('inject host entropy'); } } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { QolipStorageIntent } = mod.exports;
function fixture() { let count = 0; return { intent: new QolipStorageIntent(async () => `key-${++count}`), count: () => count }; }
// @v2-test test/qolip_storage_test.dart
test('f119 retry keys retain identical intent but change for revised contents and after complete', async () => {
  const { intent } = fixture(), body = { action: 'archive', code: 'QP-00012', expected_revision: 4 };
  const id = await intent.keyFor(body);
  assert.equal(await intent.keyFor({ ...body }), id);
  assert.notEqual(await intent.keyFor({ ...body, expected_revision: 5 }), id);
  intent.complete(); assert.notEqual(await intent.keyFor(body), id);
});
test('serialization and array order stay significant as in jsonEncode', async () => {
  const { intent } = fixture();
  const id = await intent.keyFor({ action: 'archive', qolip_codes: ['B', 'A'] });
  assert.notEqual(await intent.keyFor({ qolip_codes: ['B', 'A'], action: 'archive' }), id);
  const next = await intent.keyFor({ action: 'archive', qolip_codes: ['B', 'A'] });
  assert.notEqual(await intent.keyFor({ action: 'archive', qolip_codes: ['A', 'B'] }), next);
});
test('an unchanged concurrent intent shares the pending secure draw', async () => {
  let resolve, draws = 0;
  const intent = new QolipStorageIntent(() => { draws++; return new Promise(done => { resolve = done; }); });
  const a = intent.keyFor({ action: 'create' }), b = intent.keyFor({ action: 'create' });
  assert.equal(a, b); await Promise.resolve(); assert.equal(draws, 1);
  resolve('secure'); assert.equal(await a, 'secure'); assert.equal(await b, 'secure');
});
test('complete during a pending draw never repopulates the retained intent', async () => {
  const pending = []; const intent = new QolipStorageIntent(() => new Promise(done => pending.push(done)));
  const a = intent.keyFor({ action: 'create' }); await Promise.resolve(); intent.complete();
  pending[0]('old'); assert.equal(await a, 'old');
  const b = intent.keyFor({ action: 'create' }); await Promise.resolve(); pending[1]('new'); assert.equal(await b, 'new');
});
test('changing away and back starts a new operation even before the earlier draw settles', async () => {
  const pending = []; const intent = new QolipStorageIntent(() => new Promise(done => pending.push(done)));
  const a = intent.keyFor({ action: 'create' }), b = intent.keyFor({ action: 'archive' }), c = intent.keyFor({ action: 'create' });
  await Promise.resolve(); pending.forEach((resolve, index) => resolve(`key-${index}`));
  assert.deepEqual(await Promise.all([a, b, c]), ['key-0', 'key-1', 'key-2']);
  assert.equal(await intent.keyFor({ action: 'create' }), 'key-2');
});
test('native entropy failure leaves no usable key and cannot clear a later intent', async () => {
  let reject; const failure = new Error('native clock unavailable');
  let draws = 0; const intent = new QolipStorageIntent(() => ++draws === 1 ? new Promise((_, fail) => { reject = fail; }) : Promise.resolve('new'));
  const a = intent.keyFor({ action: 'create' }); await Promise.resolve();
  const b = intent.keyFor({ action: 'archive' }); reject(failure);
  await assert.rejects(a, error => error === failure); assert.equal(await b, 'new');
  assert.equal(await intent.keyFor({ action: 'archive' }), 'new'); assert.equal(draws, 2);
});
test('a failed native draw can be retried without reusing the previous action key', async () => {
  let draws = 0; const intent = new QolipStorageIntent(async () => { if (++draws === 2) throw new Error('entropy'); return `key-${draws}`; });
  assert.equal(await intent.keyFor({ action: 'create' }), 'key-1');
  await assert.rejects(intent.keyFor({ action: 'archive' }), /entropy/);
  assert.equal(await intent.keyFor({ action: 'archive' }), 'key-3');
});
test('the signature captures the body before awaiting entropy', async () => {
  const { intent } = fixture(), body = { action: 'archive', codes: ['A'] };
  const a = intent.keyFor(body); body.codes.push('B'); const b = intent.keyFor(body);
  assert.notEqual(await a, await b);
});
