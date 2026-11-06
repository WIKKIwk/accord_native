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
const p = load('preparationProductionPresentation'), model = load('preparationProductionModel');

test('journal cards retain V2 formula fallback and all available roll dimensions', () => {
  const batch = { item_name: '', item_code: 'PE', preparation_formula: null, active: true, warehouse: 'A', last_activity_at: '',
    roll_count: 2, total_net_kg: '12.500000', total_length_m: '9.000000' };
  assert.deepEqual(p.preparationProductionBatchCard(batch), { title: 'PE', subtitle: 'Formula qayd etilmagan\nDavom etmoqda • A • —',
    metrics: '2 ta rulon • 12.5 kg • 9 m' });
  assert.equal(p.preparationProductionRollCard({ epc: 'QR', printed_at: '', warehouse: 'A', net_kg: '1.000000', length_m: '0', width_mm: '45.000', micron: '20' }).metrics,
    '1 kg • 0 m • 45 mm • 20 mkm');
  assert.deepEqual(p.preparationProductionRecipeLines({ variant_name: 'LG', captured_at: '', formulas: [{ name: 'A', share_percent: '50.000',
    lines: [{ name: 'Kley', percent: '20.000' }] }] }), ['Shnek formulasi: LG', 'Saqlangan tarkib • —', 'Shnek A • 50%', 'Kley — 20%']);
});

test('production decoders preserve V2 errors for invalid nested values', () => {
  assert.throws(() => model.preparationProductionOrdersPageFromJson({ has_more: false, orders: [3] }), /Ishlab chiqarish yozuvi noto‘g‘ri/);
  assert.throws(() => model.preparationProductionOrderPageFromJson({ has_more: false, order: null, batches: [] }), /Ishlab chiqarish yozuvi topilmadi/);
  assert.throws(() => model.preparationProductionBatchFromJson({ batch_id: 'B', order_id: 'O', roll_count: 0, total_net_kg: '0', total_length_m: '0',
    preparation_formula: 'bad' }), /Formula ma’lumoti noto‘g‘ri/);
});
