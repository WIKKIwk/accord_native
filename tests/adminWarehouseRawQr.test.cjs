const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), exception = load('shared/mobileApiException');
const { AdminWarehouseRawQrController } = load('admin/adminWarehouseRawQrController', { '../shared/camera/synchronousGuard': sync, '../shared/mobileApiException': exception, './dartJsonString': strings });
const factory = require('qrcode-generator'), qr = load('admin/adminWarehouseRawQrModel', { 'qrcode-generator': factory, './dartJsonString': strings });
const stock = { barcode: ' 30aa ', source_receipt_id: ' receipt ', reserved_order_id: ' Default ', item_code: 'C', item_name: 'Name' };
const prepared = () => ({ reprint_id: ' id ', stock: { ...stock, barcode: '30AA' }, print_request: { epc: ' 30aA ' } });
function fixture(overrides = {}) {
  let account = true, parent = true; const calls = [], context = { isCurrent: () => parent, onChanged: async () => {} };
  const deps = { current: () => account, prepare: async (barcode, orderId, guard) => { guard(); calls.push(['prepare', barcode, orderId]); return prepared(); }, print: async (_job, guard) => { guard(); calls.push('print'); return true; },
    confirm: async (barcode, id, guard) => { guard(); calls.push(['confirm', barcode, id]); }, ...overrides };
  const controller = new AdminWarehouseRawQrController(deps); controller.start(); const closed = controller.open(stock, ' Order ', context), id = controller.getSnapshot().presentation.id;
  return { controller, deps, calls, context, id, closed, retire: () => { account = false; }, retireParent: () => { parent = false; } };
}
test('Warehouse source prepare→identity→offline print→confirm succeeds without changing stock or automatically closing QR', async () => {
  const f = fixture(); await f.controller.reprint(f.id); assert.deepEqual(f.calls, [['prepare', stock.barcode, ' Order '], 'print', ['confirm', '30AA', ' id ']]);
  const value = f.controller.getSnapshot().presentation; assert.equal(value.printing, false); assert.equal(value.error, null); assert.ok(value.notice); assert.equal(value.stock, stock);
  f.controller.close(f.id, true); assert.equal(f.controller.getSnapshot().presentation.closing, true, 'X requests native dismissal before completing the awaited child');
  f.controller.close(f.id); await f.closed;
});
for (const mismatch of ['id', 'barcode', 'receipt', 'epc']) test(`QR ${mismatch} identity mismatch never detects/prints/confirms`, async () => {
  const result = prepared(); if (mismatch === 'id') result.reprint_id = ' '; if (mismatch === 'barcode') result.stock.barcode = 'other'; if (mismatch === 'receipt') result.stock.source_receipt_id = 'OTHER'; if (mismatch === 'epc') result.print_request.epc = 'other';
  const f = fixture({ prepare: async () => result }); await f.controller.reprint(f.id); assert.deepEqual(f.calls, []); assert.deepEqual(f.controller.getSnapshot().presentation.error, { key: 'warehouse.qr_identity_mismatch' }); f.controller.dispose();
});
test('printer failure remains the source generic error; confirmation failure warns and still publishes source success notice', async () => {
  const failed = fixture({ print: async () => false }); await failed.controller.reprint(failed.id); assert.deepEqual(failed.controller.getSnapshot().presentation.error, { key: 'warehouse.qr_print_failed' }); assert.equal(failed.controller.getSnapshot().presentation.notice, null); assert.equal(failed.calls.some(row => Array.isArray(row) && row[0] === 'confirm'), false); failed.controller.dispose();
  const warning = fixture({ confirm: async () => { throw Error('server'); } }); await warning.controller.reprint(warning.id); assert.deepEqual(warning.controller.getSnapshot().presentation.error, { key: 'warehouse.qr_confirmation_failed' }); assert.ok(warning.controller.getSnapshot().presentation.notice); warning.controller.dispose();
});
test('duplicate reprint and busy X cannot duplicate commands; source outside/back still closes and suppresses later writes', async () => {
  const wait = deferred(), f = fixture({ prepare: async () => wait.promise }); const pending = f.controller.reprint(f.id); f.controller.close(f.id, true); assert.equal(f.controller.getSnapshot().presentation.closing, false);
  await f.controller.reprint(f.id); f.controller.close(f.id); await f.closed; wait.resolve(prepared()); await pending; assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().presentation, null);
});
for (const stage of ['prepare', 'print', 'confirm']) test(`original child/account retirement during ${stage} cannot authorize a following command or UI success`, async () => {
  const wait = deferred(), f = fixture(); let entered;
  f.deps[stage] = async (...args) => { const guard = args.at(-1); guard(); entered = true; await wait.promise; return stage === 'prepare' ? prepared() : stage === 'print' ? true : undefined; };
  const pending = f.controller.reprint(f.id); await tick(); assert.equal(entered, true); f.retireParent(); wait.resolve(); await pending; assert.equal(f.controller.getSnapshot().presentation, null);
  const before = f.calls.length; await f.controller.reprint(f.id); assert.equal(f.calls.length, before); f.controller.dispose(); await f.closed;
});
test('asynchronous original authority is consumed and StrictMode never revives an old QR ticket', async () => {
  const f = fixture(); f.controller.dispose(); await f.closed; f.controller.start(); const next = f.controller.open(stock, '', f.context), id = f.controller.getSnapshot().presentation.id;
  await f.controller.reprint(f.id); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().presentation.orderId, stock.reserved_order_id);
  f.controller.close(f.id); assert.equal(f.controller.getSnapshot().presentation.id, id); f.controller.close(id); await next;
  await f.controller.open(stock, '', { ...f.context, isCurrent: () => Promise.reject(Error('async current')) }); await tick(); assert.equal(f.controller.getSnapshot().presentation, null);
});
test('QR preview sanitizes/uppercases source payload, selects correct byte mode and restores any shared encoder', () => {
  const original = factory.stringToBytes, cases = ['30aa', ' ab\n^~  cd ', '1234567890', 'ёжик'];
  try {
    for (const value of cases) {
      factory.stringToBytes = text => Array.from(text, character => character.charCodeAt(0) & 255); const before = factory.stringToBytes, first = qr.adminWarehouseRawQrPreview(value); assert.equal(factory.stringToBytes, before);
      factory.stringToBytes = text => Array.from(new TextEncoder().encode(text)); const utf8 = factory.stringToBytes, second = qr.adminWarehouseRawQrPreview(value); assert.equal(factory.stringToBytes, utf8); assert.equal(first.uri, second.uri);
      assert.equal(first.payload, qr.adminWarehouseRawQrPayload(value)); assert.ok(first.drawnSize <= 208); assert.equal(first.drawnSize, (first.modules + 8) * first.cell); assert.match(first.uri, /^data:image\/gif;base64,/);
    }
    assert.equal(qr.adminWarehouseRawQrPayload(' ab\n^~  cd '), 'AB CD'); assert.throws(() => qr.adminWarehouseRawQrPreview(' ^~\n '), /empty/);
  } finally { factory.stringToBytes = original; }
});
test('reentrant open cannot replace the original QR child, and identity model side effects cannot publish an expired error', async () => {
  const f = fixture(); f.controller.close(f.id); await f.closed; const context = { ...f.context, isCurrent: () => { void f.controller.open(stock, 'Nested', f.context); return f.context.isCurrent(); } }, pending = f.controller.open(stock, 'Original', context);
  assert.equal(f.controller.getSnapshot().presentation.orderId, 'Original'); const value = prepared(); Object.defineProperty(value.stock, 'barcode', { get() { f.retireParent(); return 'mismatch'; } }); f.deps.prepare = async () => value;
  await f.controller.reprint(f.controller.getSnapshot().presentation.id); await pending; assert.equal(f.controller.getSnapshot().presentation, null); assert.equal(f.calls.includes('print'), false);
});
