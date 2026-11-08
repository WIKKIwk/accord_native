// Source-derived from f11910bb aparatchi_paddon_display.dart and the five
// orderSummary assertions in test/aparatchi_paddons_test.dart. No Dart execution.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const display = load('rezka/rezkaPaddonDisplay.ts');
const { adminText } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const batch = (order_id, payload_json, label_item_name) => ({ order_id, payload_json, label_item_name });
const machine = (id, name, physical = '', work = '') => ({ id, name, physical_asset_id: physical, work_unit_id: work });

for (const item of [
  ['zakaz-0037', { order_title: 'Asl buyurtma nomi' }, 'Eski yorliq tayyor mahsulot, apparat: rezka, ish tugatildi', '0037 - Asl buyurtma nomi'],
  ['zakaz-0037', { order_number: '0042', order_title: 'Asl nom' }, 'Eski nom', '0042 - Asl nom'],
  ['zakaz-0007', {}, 'Shaffof paket yarim tayyor mahsulot, apparat: rezka, chiqarildi', '0007 - Shaffof paket'],
  ['0024', {}, 'Bosma paket tayyor mahsulot, apparat: rezka, ish tugatildi', '0024 - Bosma paket'],
  ['internal-order-id', {}, '', '— - —'],
]) test(`selected V2 order-summary assertion: ${item[3]}`, () => {
  assert.equal(display.rezkaPaddonOrderSummary(batch(item[0], item[1], item[2])), item[3]);
});
test('payload fields take precedence independently and trim without altering the batch', () => {
  const value = batch(' zakaz-0042 ', { order_number: '  0009 ', order_title: ' Asl ' }, 'Eski tayyor mahsulot');
  const before = JSON.stringify(value); assert.equal(display.rezkaPaddonOrderSummary(value), '0009 - Asl');
  assert.equal(JSON.stringify(value), before);
  assert.equal(display.rezkaPaddonOrderSummary(batch(' 42 ', { order_number: 0, order_title: false }, 'Fallback')), '0 - false');
  assert.equal(display.rezkaPaddonOrderSummary(batch('bad', { order_number: '  ', order_title: null }, 'Hello YARIM TAYYOR')), '— - Hello');
});
test('JSON collection values use Dart-like collection delimiters rather than JavaScript object strings', () => {
  assert.equal(display.rezkaPaddonOrderSummary(batch('bad', { order_number: [1, true, null], order_title: { name: 'X', tags: ['A', 'B'] } }, 'old')),
    '[1, true, null] - {name: X, tags: [A, B]}');
});
test('fallback parsing is anchored and strips the source suffix only at the end', () => {
  assert.equal(display.rezkaPaddonOrderSummary(batch('zakaz-21-extra', {}, 'Film tayyor mahsulot qolgan')), '— - Film tayyor mahsulot qolgan');
  assert.equal(display.rezkaPaddonOrderSummary(batch('123', {}, 'Mahsulot YARIM TAYYOR MAHSULOT , APPARAT: something')), '123 - Mahsulot');
  assert.equal(display.rezkaPaddonOrderSummary(batch('123', {}, ' , apparat: only')), '123 - —');
});
test('apparatus, physical asset and work unit identifiers resolve while preserving surrounding text', () => {
  const catalog = [machine(' apparatus:site:a ', ' Cutter A ', 'apparatus:asset:a', 'apparatus:work:a'), machine('apparatus:site:b', 'Cutter B')];
  const original = JSON.stringify(catalog);
  assert.equal(display.rezkaPaddonApparatusOrLocation('  apparatus:site:a / apparatus:asset:a + apparatus:work:a  ', catalog, 'Unknown'),
    'Cutter A / Cutter A + Cutter A');
  assert.equal(display.rezkaPaddonApparatusOrLocation('x apparatus:site:b y', catalog, 'Unknown'), 'x Cutter B y');
  assert.equal(JSON.stringify(catalog), original);
});
test('invalid matching labels continue to later matches; unknown and case mismatches use the localized fallback', () => {
  const catalog = [machine('apparatus:x', ''), machine('apparatus:x', 'apparatus:internal'), machine('apparatus:x', 'Rezka')];
  assert.equal(display.rezkaPaddonApparatusOrLocation('apparatus:x + apparatus:missing', catalog, 'Unknown'), 'Rezka + Unknown');
  assert.equal(display.rezkaPaddonApparatusOrLocation('APPARATUS:x', catalog, 'Unknown'), 'Unknown');
  assert.equal(display.rezkaPaddonApparatusOrLocation('apparatus:y', [machine('apparatus:y', 'APPARATUS:visible')], 'Unknown'), 'APPARATUS:visible');
  assert.equal(display.rezkaPaddonApparatusOrLocation('apparatus:x.', catalog, 'Unknown'), 'Unknown');
  assert.equal(display.rezkaPaddonApparatusOrLocation('  ', catalog, 'Unknown'), '');
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const fallback = adminText('wip.unspecified', locale);
    assert.notEqual(fallback, 'wip.unspecified');
    assert.equal(display.rezkaPaddonApparatusOrLocation('apparatus:unknown', catalog, fallback), fallback);
  }
});
