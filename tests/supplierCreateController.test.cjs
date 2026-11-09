const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const detailModel = load('shared/notification/notificationDetailModel'), search = load('shared/searchNormalizer');
const screenModel = load('supplier/supplierScreenModel', { '../shared/notification/notificationDetailModel': detailModel,
  '../shared/searchNormalizer': search });
const { SupplierPickerController, SupplierConfirmController } = load('supplier/supplierCreateController', { './supplierScreenModel': screenModel });
const item = { code: 'I', name: 'Olma', uom: 'kg', warehouse: '', item_group: '', requires_dimensions: false,
  order_apparatus_options: {}, order_microns: [], customer_names: [] };
const wait = () => new Promise(resolve => setImmediate(resolve));

test('picker loads all assigned items, filters locally and ignores stale requests', async () => {
  const pending = [], session = {};
  const picker = new SupplierPickerController(session, actual => { assert.equal(actual, session); return new Promise(resolve => pending.push(resolve)); });
  picker.start(); await wait(); picker.setQuery('olma'); const next = picker.reload(); await wait();
  pending[1]([item, { ...item, code: 'B', name: 'Paxta' }]); await next;
  pending[0]([]); await wait();
  assert.deepEqual(picker.visibleItems.map(row => row.code), ['I']);
  picker.setQuery(''); assert.equal(picker.visibleItems.length, 2);
  picker.stop();
});

test('picker exposes an initial error and can retry', async () => {
  let attempts = 0;
  const picker = new SupplierPickerController({}, async () => { if (++attempts === 1) throw Error('offline'); return [item]; });
  picker.start(); await wait(); assert.match(String(picker.getSnapshot().error), /offline/);
  await picker.reload(); assert.equal(picker.getSnapshot().error, null); assert.equal(picker.visibleItems.length, 1); picker.stop();
});

// @v2-test test/supplier_confirm_screen_test.dart
test('confirmation ignores repeated taps and remains busy until success route returns', async () => {
  let finishCreate, finishRoute, calls = 0, mutations = 0;
  const result = { id: 'R' }, pending = new Promise(resolve => { finishCreate = resolve; });
  const route = new Promise(resolve => { finishRoute = resolve; });
  const controller = new SupplierConfirmController({}, item, 12, {
    create: async (_session, code, qty) => { calls++; assert.equal(code, 'I'); assert.equal(qty, 12); return pending; },
    recordCreatedPending: () => mutations++,
  }, { onSuccess: async record => { assert.equal(record, result); await route; }, onFailure: () => assert.fail('unexpected error') });
  controller.start(); const first = controller.submit(), second = controller.submit();
  assert.equal(calls, 1); assert.equal(controller.getSnapshot(), true);
  finishCreate(result); await wait(); assert.equal(mutations, 1); assert.equal(controller.getSnapshot(), true);
  finishRoute(); await Promise.all([first, second]); assert.equal(controller.getSnapshot(), false); controller.stop();
});

test('failed and unmounted confirmation never navigates; successful unmounted requests still record the pending delta', async () => {
  const messages = [];
  const failed = new SupplierConfirmController({}, item, 1, { create: async () => { throw Error('offline'); }, recordCreatedPending: () => assert.fail('unexpected mutation') },
    { onSuccess: async () => assert.fail('unexpected navigation'), onFailure: message => messages.push(message) });
  failed.start(); await failed.submit(); assert.deepEqual(messages, ['Jo‘natish saqlanmadi: Error: offline']); assert.equal(failed.getSnapshot(), false);
  let finish, mutations = 0;
  const deferred = new Promise(resolve => { finish = resolve; });
  const left = new SupplierConfirmController({}, item, 1, { create: async () => deferred, recordCreatedPending: () => mutations++ },
    { onSuccess: async () => assert.fail('unexpected navigation'), onFailure: () => assert.fail('unexpected error') });
  left.start(); const submission = left.submit(); left.stop(); finish({ id: 'R' }); await submission;
  assert.equal(mutations, 1);
});
