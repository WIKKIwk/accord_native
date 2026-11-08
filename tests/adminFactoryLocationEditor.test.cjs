const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString');
const model = load('admin/factoryLocationEditorModel', { './dartJsonString': dart });
const a = { id: 'apparatus:default:a', name: 'Print 7', sort_order: 7 };
const b = { id: 'apparatus:default:b', name: 'Print 2', sort_order: 2 };
const c = { id: 'apparatus:custom:c', name: 'Zeta', sort_order: 1 };
const d = { id: 'apparatus:custom:d', name: 'Alpha', sort_order: 100 };
const location = { id: 'state-1', name: 'State', active: true, apparatus: [a, b] };
// @v2-test test/admin_factory_locations_test.dart (all six f119 cases passed independently).
test('factory apparatus catalog orders default by catalog order and custom by name', () => {
  assert.deepEqual(model.orderedFactoryApparatus([a, c, b, d]).map(item => item.id), [b.id, a.id, d.id, c.id]);
  const groups = model.factoryApparatusPickerGroups([b, a, d, c], ' PRINT ');
  assert.deepEqual(groups.defaults, [b, a]); assert.deepEqual(groups.custom, []);
  assert.deepEqual(model.selectedFactoryApparatus([b, a, d, c], new Set([a.id, 'missing'])), [a]);
});
test('factory editor requires a name and preserves selected set order', () => {
  assert.deepEqual(model.factoryLocationEditorPlan(null, '\u0085 \u0085', new Set()), { kind: 'nameRequired' });
  assert.deepEqual(model.factoryLocationEditorPlan(null, ' State ', new Set([b.id, a.id])),
    { kind: 'create', name: 'State', apparatusIds: [b.id, a.id] });
});
test('existing state changes members only when sets differ, not when order differs', () => {
  assert.deepEqual(model.factoryLocationEditorPlan(location, 'State', new Set([b.id, a.id])), { kind: 'unchanged', location });
  assert.deepEqual(model.factoryLocationEditorPlan(location, 'State', new Set([a.id, c.id])),
    { kind: 'replace', id: 'state-1', apparatusIds: [a.id, c.id] });
});
test('factory save sorts while active status update retains existing order', () => {
  const other = { ...location, id: 'state-2', name: 'Alpha' }, saved = { ...location, name: 'Zeta', active: false };
  assert.deepEqual(model.upsertFactoryLocation([location, other], saved).map(x => x.name), ['Alpha', 'Zeta']);
  assert.deepEqual(model.replaceFactoryLocation([location, other], saved, false).map(x => x.name), ['Zeta', 'Alpha']);
  assert.deepEqual(model.replaceFactoryLocation([location, other], saved, true).map(x => x.name), ['Alpha', 'Zeta']);
});
