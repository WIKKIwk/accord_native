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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}
const model = load('supplier/supplierScreenModel', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
  '../shared/searchNormalizer': load('shared/searchNormalizer'),
});
const item = (code, name, warehouse = '') => ({ code, name, warehouse, uom: 'kg', item_group: '', requires_dimensions: false,
  order_apparatus_options: {}, order_microns: [], customer_names: [] });
const record = (id, status, extra = {}) => ({ id, status, note: '', event_type: '', highlight: '', item_code: id,
  item_name: `Name ${id}`, uom: 'kg', sent_qty: 10, accepted_qty: 0, ...extra });

test('quantity parsing follows the pinned V2 oracle, including signed NaN and infinity', () => {
  for (const [value, expected] of [['.1', 0.1], ['1.', 1], ['01', 1], ['1e2', 100], ['\u0085 2\u0085', 2], ['Infinity', Infinity]]) {
    assert.equal(model.supplierQuantity(value), expected, value);
  }
  for (const value of ['NaN', '+NaN', '-NaN']) assert.ok(Number.isNaN(model.supplierQuantity(value)), value);
  for (const value of ['', '  ', '0x10', '1,5', '1_000', '0', '-1', '-Infinity', '12abc']) {
    assert.equal(model.supplierQuantity(value), null, value);
  }
  assert.equal(model.supplierInitialQuantity(12.4), '12');
  assert.equal(model.supplierInitialQuantity(0), '');
});

test('picker uses existing normalized search and confirmation preserves order and optional warehouse', () => {
  const rows = [item('AA', 'Olma'), item('BB', 'Paxta')];
  assert.deepEqual(model.supplierVisibleItems(rows, '\u0085').map(row => row.code), ['AA', 'BB']);
  assert.deepEqual(model.supplierVisibleItems(rows, 'paxta').map(row => row.code), ['BB']);
  assert.deepEqual(model.supplierConfirmationRows(item('I', 'Item', 'Main'), 12.5), [
    { label: 'Mahsulot', value: 'I' }, { label: 'Nomi', value: 'Item' },
    { label: 'Miqdor', value: '12.50 kg' }, { label: 'Ombor', value: 'Main' },
  ]);
  assert.equal(model.supplierConfirmationRows(item('I', 'Item', '\u0085'), 1).length, 3);
});

test('pending and accepted categories retain V2 event and note distinctions', () => {
  const rows = [record('a', 'pending'), record('b', 'draft', { event_type: 'werka_unannounced_pending' }),
    record('c', 'accepted'), record('d', 'accepted', { note: ' Aytilmagan mahsulot tasdiqlandi: ok' }),
    record('e', 'accepted', { event_type: 'werka_unannounced_approved' }), record('f', 'rejected')];
  assert.deepEqual(model.supplierPendingItems(rows).map(row => row.id), ['a', 'b']);
  assert.deepEqual(model.supplierCategoryItems(rows, 'pendingDispatches').map(row => row.id), ['a']);
  assert.deepEqual(model.supplierCategoryItems(rows, 'pendingUnannounced').map(row => row.id), ['b']);
  assert.deepEqual(model.supplierCategoryItems(rows, 'acceptedByWerka').map(row => row.id), ['c']);
  assert.deepEqual(model.supplierCategoryItems(rows, 'approvedUnannounced').map(row => row.id), ['d', 'e']);
  assert.deepEqual(['pending', 'submitted', 'returned'].map(model.supplierStatusTitleKey), ['pendingStatus', 'submittedStatus', 'returnedStatus']);
  assert.equal(model.supplierCategoryTitleKey('pendingUnannounced'), 'supplierPendingUnannouncedTitle');
  assert.equal(model.supplierCategoryTitleKey('approvedUnannounced'), 'supplierAcceptedUnannouncedTitle');
});

test('recent records prefill the product with no warehouse and notifications retain unread-first ordering', () => {
  const rows = [record('a', 'pending'), record('b', 'accepted', { highlight: ' Update ', accepted_qty: 7 }), record('c', 'partial')];
  assert.deepEqual(model.supplierRecentItem(rows[0]), item('a', 'Name a'));
  assert.deepEqual(model.supplierNotificationItems(rows, new Set(['c']), new Set(['b'])).map(row => row.id), ['b', 'a']);
  assert.equal(model.supplierNotificationSecondary(rows[1]), ' Update ');
  assert.equal(model.supplierNotificationSecondary(rows[0]), 'Name a');
  assert.equal(model.supplierNotificationMetric(rows[1]), '10 kg jo‘natildi • 7 kg qabul');
  assert.equal(model.supplierNotificationMetric(rows[0]), '10 kg jo‘natildi');
  assert.equal(model.supplierNotificationStatusIcon(rows[0]), 'clock');
  assert.equal(model.supplierNotificationStatusIcon(rows[1]), 'doneAll');
  assert.equal(model.supplierNotificationStatusIcon(rows[2]), 'check');
  assert.equal(model.supplierNotificationStatusIcon(record('d', 'pending', { note: 'Supplier tasdiqladi: yes' })), 'doneAll');
  assert.equal(model.supplierNotificationStatusIcon(record('e', 'rejected')), 'close');
  assert.equal(model.supplierNotificationStatusIcon(record('f', 'cancelled')), 'remove');
});
