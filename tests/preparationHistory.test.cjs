const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(filename) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return mod.exports;
}

const history = load('preparationHistoryModel');
test('history formats receipt, reversal, and consumption records as V2', () => {
  const receipt = { kind: 'receipt', name: 'Kley', warehouse: 'A', kg: '12.500000', created_at: '2026-10-12T08:25:16' };
  assert.deepEqual(history.preparationHistoryCard(receipt), {
    title: 'Kirim — Kley', subtitle: 'A • 2026-10-12 08:25:16', value: '+12.5 kg',
  });
  assert.deepEqual(history.preparationHistoryCard({ ...receipt, kind: 'receipt_reversal', reversed: true }), {
    title: 'Kirimni bekor qilish — Kley', subtitle: 'A • 2026-10-12 08:25:16\nBekor qilingan', value: '-12.5 kg',
  });
  assert.deepEqual(history.preparationHistoryCard({ kind: 'consumption', warehouse: 'A', created_at: 'bad date',
    order_code: 'B1', order_title: 'Paket', order_kg: '100.000000', lines: [{ name: 'Kley', percent: '5.000', kg: '5.000' }] }), {
    title: 'Sarf — B1 Paket', subtitle: 'A • bad date\nKley: 5% → 5 kg', value: 'Order: 100 kg',
  });
  assert.equal(history.preparationReceiptActionSubtitle(receipt), 'A • 12.5 kg');
  assert.equal(history.preparationReceiptReverseMessage(receipt), '12.5 kg kirim bekor qilinsinmi? Bu amal tarixda saqlanadi.');
  assert.equal(history.preparationHistoryDate(null), '');
});
