const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/supplier/supplierFlowStore.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { SupplierFlowStore } = mod.exports;

test('role-local flow preserves V2 item, optional prefill, quantity and returned record', () => {
  const flow = new SupplierFlowStore(), item = { code: 'A' }, record = { id: 'R' };
  let updates = 0; const unsubscribe = flow.subscribe(() => updates++);
  flow.choose(item, 12); flow.setQuantity(12.5); flow.setRecord(record);
  assert.deepEqual(flow.getSnapshot(), { item, initialQty: 12, qty: 12.5, record });
  flow.choose({ code: 'B' });
  assert.deepEqual(flow.getSnapshot(), { item: { code: 'B' }, initialQty: undefined, qty: null, record: null });
  flow.setQuantity(NaN); assert.ok(Number.isNaN(flow.getSnapshot().qty));
  flow.clear(); assert.deepEqual(flow.getSnapshot(), { item: null, initialQty: undefined, qty: null, record: null });
  unsubscribe(); flow.clear(); assert.equal(updates, 6);
});
