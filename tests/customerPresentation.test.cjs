const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const p = load('customerPresentation.ts', { './customerLogic': load('customerLogic.ts') });
const row = { item_name: 'A', item_code: 'X', sent_qty: 7.4, uom: 'kg', created_label: 'date', note: '', status: 'pending' };
test('Customer home status rows follow V2 order and counts', () => {
  assert.deepEqual(p.customerStatusRows({ pendingCount: 4, confirmedCount: 2, rejectedCount: 1 }), [
    { kind: 'pending', titleKey: 'pendingLabel', count: 4 }, { kind: 'confirmed', titleKey: 'confirmedStatus', count: 2 },
    { kind: 'rejected', titleKey: 'rejectedLabel', count: 1 }]);
  assert.equal(p.customerStatusTitleKey('rejected'), 'rejectedLabel');
});
test('shipment, status and notification row text keep V2 fields and fallback', () => {
  assert.deepEqual(p.customerHomeRecord(row), { name: 'A', code: 'X', quantity: '7 kg' });
  assert.deepEqual(p.customerStatusRecord({ ...row, note: '\u0085   \u0085' }), { name: 'A', created: 'date', quantity: '7 kg', note: '' });
  assert.equal(p.customerStatusRecord({ ...row, note: ' note ' }).note, ' note ');
  assert.deepEqual(p.customerNotificationRecord(row), { name: 'A', code: 'X', created: 'date', body: '7 kg jo‘natildi', icon: 'schedule' });
  assert.equal(p.customerNotificationRecord({ ...row, note: 'hello', status: 'accepted' }).body, 'hello');
  assert.equal(p.customerNotificationRecord({ ...row, status: 'rejected' }).icon, 'close');
  assert.equal(p.customerNotificationRecord({ ...row, status: 'partial' }).icon, 'schedule');
});
