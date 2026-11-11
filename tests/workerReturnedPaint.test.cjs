const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const cache = new Map();
function load(relative) {
  const file = path.resolve(__dirname, '../src', relative.endsWith('.ts') ? relative : `${relative}.ts`);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths; cache.set(file, mod);
  mod.require = request => {
    if (request.endsWith('/workerControlsApi')) return {};
    if (request.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), request)));
    return require(request);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
const { returnedPaintItemsFromDraft } = load('workerOrderLogic');
const { workerReturnedPaintReport, workerPaintValueKey, workerPaintValue } = load('workerReturnedPaint');

// V2 returned_paint_sheet_helpers_part_01.dart collector and progress_qty.dart:838–887.
test('wire collection normalizes commas and preserves finite nonnegative Dart numeric strings only', () => {
  const dynamic = { 'rasxot:Mix': ['comma', 'zero', 'exponent', 'positive', 'negative', 'infinity', 'overflow', 'hex', 'blank'] };
  const raw = [' 1,50 ', '0', '1e2', '+2', '-1', 'Infinity', '1e400', '0x10', ' '];
  const values = Object.fromEntries(dynamic['rasxot:Mix'].map((name, index) => [`rasxot:Mix:${name}`, raw[index]]));
  assert.deepEqual(returnedPaintItemsFromDraft(values, dynamic), [{ usage: 'rasxot', category: 'colors', name: 'Mix',
    values: { comma: '1.50', zero: '0', exponent: '1e2', positive: '+2' } }]);
});

test('Pantone Mix is collected immediately after Pantone before later colors, lacquer and solvents', () => {
  const dynamic = { 'rasxot:Pantone': ['Blue'], 'rasxot:Pantone Mix': ['Special'], 'astatka:Pantone Mix': ['Return'] };
  const values = { 'rasxot:Pantone:Blue': '1', 'rasxot:Pantone Mix:Special': '2', 'rasxot:Oq:Mix': '3',
    'rasxot:Lak:OPV lak': '4', 'rasxot:Spirtlar:Etil': '5', 'astatka:Pantone Mix:Return': '6', 'astatka:Qora:Mix': '7' };
  assert.deepEqual(returnedPaintItemsFromDraft(values, dynamic).map(item => [item.usage, item.category, item.name]), [
    ['rasxot', 'colors', 'Pantone'], ['rasxot', 'colors', 'Mix'], ['rasxot', 'colors', 'Oq'],
    ['rasxot', 'lacquers', 'Lak'], ['rasxot', 'solvents', 'Spirtlar'], ['astatka', 'colors', 'Mix'], ['astatka', 'colors', 'Qora'],
  ]);
});

test('a raw invalid value is rejected before filtered items or an image could satisfy the report', () => {
  const fields = { 'rasxot:Pantone Mix': ['Named'] };
  for (const raw of ['-1', 'NaN', '1e2', '+1', '1.123456789012', '999999999999999999.1', '0x10']) {
    const report = workerReturnedPaintReport({ 'rasxot:Pantone Mix:Named': raw }, fields, 'image');
    assert.deepEqual(report.error, { key: 'worker.progress.qty.returned_paint_invalid' });
  }
});

test('empty/image-only and partial per-usage reports keep the distinct source validation keys', () => {
  assert.deepEqual(workerReturnedPaintReport({}, {}, '').error, { key: 'worker.progress.qty.returned_paint_image' });
  assert.equal(workerReturnedPaintReport({}, {}, ' image ').error, null);
  assert.deepEqual(workerReturnedPaintReport({}, {}, ' ').error, { key: 'worker.progress.qty.returned_paint_image' });
  const values = { 'rasxot:Oq:Mix': '1', 'rasxot:Oq:1w Oq': '2', 'rasxot:Oq:7w Oq': '3',
    'astatka:Oq:Mix': '1', 'astatka:Oq:1w Oq': '0' };
  const partial = workerReturnedPaintReport(values, {}, 'image');
  assert.deepEqual(partial.error, { key: 'worker.progress.qty.returned_paint_min', values: { rasxot: 3, astatka: 2 } });
  values['astatka:Oq:7w Oq'] = '0';
  const full = workerReturnedPaintReport(values, {}, '');
  assert.equal(full.error, null); assert.equal(full.rasxotCount, 3); assert.equal(full.astatkaCount, 3); assert.equal(full.returnInkKg, 1);
});

test('return ink total is positive finite astatka sum, including named fields, and null for zero or overflow', () => {
  const dynamic = { 'astatka:Pantone': ['Blue'], 'astatka:Pantone Mix': ['Special'] };
  assert.equal(workerReturnedPaintReport({ 'astatka:Pantone:Blue': '1,25', 'astatka:Pantone Mix:Special': '2,5', 'rasxot:Oq:Mix': '100' }, dynamic, '').returnInkKg, 3.75);
  assert.equal(workerReturnedPaintReport({ 'astatka:Oq:Mix': '0' }, {}, '').returnInkKg, null);
  assert.equal(workerReturnedPaintReport({}, {}, '').returnInkKg, null);
  assert.equal(workerReturnedPaintReport({ 'astatka:Oq:Mix': '1e308', 'astatka:Oq:1w Oq': '1e308' }, {}, '').returnInkKg, null);
});

test('closing output retains a raw zero return-ink total while a normal report uses positive/null', () => {
  const zero = workerReturnedPaintReport({ 'astatka:Oq:Mix': '0' }, {}, '');
  assert.equal(zero.rawReturnInkKg, 0); assert.equal(zero.returnInkKg, null);
  const noAstatka = workerReturnedPaintReport({ 'rasxot:Oq:Mix': '2' }, {}, '');
  assert.equal(noAstatka.rawReturnInkKg, 0); assert.equal(noAstatka.returnInkKg, null);
  const empty = workerReturnedPaintReport({}, {}, '');
  assert.equal(empty.rawReturnInkKg, null); assert.equal(empty.returnInkKg, null);
  const positive = workerReturnedPaintReport({ 'astatka:Oq:Mix': '2,5' }, {}, '');
  assert.equal(positive.rawReturnInkKg, 2.5); assert.equal(positive.returnInkKg, 2.5);
});

test('named prototype keys remain data and stale unrelated draft keys never satisfy a report', () => {
  const fields = { 'rasxot:Mix': ['__proto__'] };
  const report = workerReturnedPaintReport({ 'rasxot:Mix:__proto__': '1', 'unknown:Oq:Mix': '5', 'rasxot:Removed:Name': '1' }, fields, '');
  assert.deepEqual(Object.keys(report.items[0].values), ['__proto__']); assert.equal(report.items[0].values.__proto__, '1');
  assert.equal(Object.getPrototypeOf(report.items[0].values), Object.prototype);
  assert.deepEqual(report.error, { key: 'worker.progress.qty.returned_paint_min', values: { rasxot: 1, astatka: 0 } });
});

test('a dynamic name may repeat a base name while retaining independent values and source last-value wire override', () => {
  const state = 'rasxot:Oq', baseKey = workerPaintValueKey(state, 1, '1w Oq'), dynamicKey = workerPaintValueKey(state, 8, '1w Oq');
  const values = { [baseKey]: '1', [dynamicKey]: '2', [`${state}:1w Oq`]: 'old' }, fields = { [state]: ['1w Oq'] };
  assert.notEqual(baseKey, dynamicKey); assert.equal(workerPaintValue(values, state, 1, '1w Oq'), '1');
  assert.equal(workerPaintValue(values, state, 8, '1w Oq'), '2');
  assert.deepEqual(returnedPaintItemsFromDraft(values, fields), [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { '1w Oq': '2' } }]);
  assert.equal(values[baseKey], '1'); assert.equal(values[dynamicKey], '2');
  values[baseKey] = '-1';
  assert.deepEqual(workerReturnedPaintReport(values, fields, 'image').error, { key: 'worker.progress.qty.returned_paint_invalid' }, 'raw invalid base field cannot be hidden by a valid dynamic override');
});

test('indexed empty fields override legacy values while older persisted drafts remain readable', () => {
  const state = 'astatka:Oq', legacy = { [`${state}:1w Oq`]: '3' };
  assert.equal(workerPaintValue(legacy, state, 1, '1w Oq'), '3');
  assert.deepEqual(returnedPaintItemsFromDraft(legacy, {}), [{ usage: 'astatka', category: 'colors', name: 'Oq', values: { '1w Oq': '3' } }]);
  const updated = { ...legacy, [workerPaintValueKey(state, 1, '1w Oq')]: '' };
  assert.equal(workerPaintValue(updated, state, 1, '1w Oq'), '');
  assert.deepEqual(returnedPaintItemsFromDraft(updated, {}), []);
  assert.equal(workerPaintValueKey('rasxot:Mix', 0, 'A:B'), '@["rasxot:Mix",0,"A:B"]');
});
