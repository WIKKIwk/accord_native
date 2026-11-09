// Source-derived from f11910bb aparatchi_paddon_detail_screen_bobina_summary.dart,
// detail screen filtering and test/aparatchi_paddon_bobina_summary_test.dart. No Dart execution.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/rezka/rezkaPaddonBobina.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const model = mod.exports;
const items = weights => weights.map((bobina_kg, index) => ({ id: index, bobina_kg }));

test('source example groups assigned physical rolls and sorts by weight', () => {
  const assigned = items([...Array(6).fill(4), ...Array(8).fill(3), ...Array(2).fill(2), ...Array(4).fill(1)]);
  const available = items([99, 4]);
  assert.deepEqual(model.rezkaPaddonBobinaGroups(assigned), [
    { units: 1_000_000, count: 4 }, { units: 2_000_000, count: 2 }, { units: 3_000_000, count: 8 }, { units: 4_000_000, count: 6 }]);
  assert.equal(model.rezkaPaddonBobinaGroups(assigned).some(group => group.units === 99_000_000), false);
  assert.equal(available.length, 2); assert.equal(model.rezkaPaddonBobinaGroups([]).length, 0);
});
test('six-decimal grouping distinguishes fractional weights and collects unknown values last', () => {
  const data = items([0.808, 0.8080001, 0.808001, null, 0, -1, NaN, Infinity]);
  assert.deepEqual(model.rezkaPaddonBobinaGroups(data), [{ units: 808_000, count: 2 }, { units: 808_001, count: 1 }, { units: 0, count: 5 }]);
  assert.equal(model.rezkaPaddonBobinaLabel(808_000), '0.808 kg'); assert.equal(model.rezkaPaddonBobinaLabel(808_001), '0.808001 kg');
  assert.equal(model.rezkaPaddonBobinaLabel(2_000_000), '2 kg'); assert.equal(model.rezkaPaddonBobinaLabel(1), '0.000001 kg');
});
test('filter uses the same grouping precision, preserves order and toggles back to all', () => {
  const data = items([0.8080001, 0.808, 0.808001, null, 0, -1, NaN, Infinity]);
  assert.deepEqual(model.rezkaPaddonVisibleWips(data, 808_000).map(item => item.id), [0, 1]);
  assert.deepEqual(model.rezkaPaddonVisibleWips(data, 0).map(item => item.id), [3, 4, 5, 6, 7]);
  assert.deepEqual(model.rezkaPaddonVisibleWips(data, null).map(item => item.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(model.nextRezkaPaddonBobinaFilter(808_000, 0), { selectedUnits: 0, selectedAvailableIds: [], selectedAssignedIds: [] });
  assert.equal(model.nextRezkaPaddonBobinaFilter(0, 0).selectedUnits, null);
});
test('the same selected weight filters either assigned or available items without merging them', () => {
  const assigned = items([2, 4]), available = items([2, 2, 4, 99]);
  assert.equal(model.rezkaPaddonVisibleWips(assigned, 2_000_000).length, 1);
  assert.equal(model.rezkaPaddonVisibleWips(available, 2_000_000).length, 2);
  assert.equal(model.rezkaPaddonVisibleWips(available, 4_000_000).length, 1);
});
test('sub-half-micro measurements are unknown and unsafe integer precision fails closed', () => {
  assert.equal(model.rezkaPaddonBobinaUnits(0.0000004), 0);
  assert.equal(model.rezkaPaddonBobinaUnits(0.0000005), 1);
  assert.throws(() => model.rezkaPaddonBobinaUnits(Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => model.rezkaPaddonBobinaLabel(0), RangeError);
});
