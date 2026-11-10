const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { legacyLaminationReportMetrics } = load('workerLegacyLaminationReport');
const { workerCompletionMode } = load('workerCompletion');
// @v2-test test/laminatsiya_astatka_api_test.dart
test('glue astatka accepts zero remainders and waste without requiring paint or output', () => {
  assert.deepEqual(legacyLaminationReportMetrics(true, { wip: '0', film: '0', waste: '0' }),
    { lamination_print_leftover_rolls: 0, lamination_film_leftover_rolls: 0, total_waste: 0 });
  assert.equal(legacyLaminationReportMetrics(true, { wip: '1,25', film: '0', waste: '0,5' }).lamination_print_leftover_rolls, 1.25);
});
test('glue astatka requires all three finite nonnegative values', () => {
  const valid = { wip: '0', film: '0', waste: '0' };
  for (const field of ['wip', 'film', 'waste']) for (const value of ['', '-1', 'Infinity', 'NaN'])
    assert.throws(() => legacyLaminationReportMetrics(true, { ...valid, [field]: value }));
});
test('full glue completion needs positive waste and at least one positive layer remainder', () => {
  for (const change of [{ wip: '2', film: '' }, { wip: '', film: '2' }, { wip: '0', film: '2' }]) {
    const result = legacyLaminationReportMetrics(false, { ...change, waste: '1' }); assert.equal(result.total_waste, 1);
    assert.equal(result.returned_paint_items, undefined);
  }
  for (const values of [{ wip: '0', film: '0', waste: '1' }, { wip: '2', film: '', waste: '0' }, { wip: '-1', film: '2', waste: '1' }])
    assert.throws(() => legacyLaminationReportMetrics(false, values));
});
test('a partial laminate/glue remainder cannot be submitted as a no-output safe-stop issue', () => {
  const base = { action: 'pause', orderId: 'order', closingOutputId: '', safeStopRequest: 'freeze', description: 'Broken', meter: '', kg: '', bobina: '', waste: '' };
  assert.equal(workerCompletionMode(base).safeStopIssue, true);
  for (const additionalOutput of [['0', ''], ['', '2']]) {
    const mode = workerCompletionMode({ ...base, additionalOutput }); assert.equal(mode.safeStopIssue, false); assert.equal(mode.needsOutput, true);
  }
});
