const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture(data) {
  const filename = path.resolve(__dirname, '../src/gscale/gscaleAdminApi.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === '../authorizedFetch' ? { authorizedFetch: async () => ({ status: 200, json: async () => data }) }
    : name === '../workerControlsApi' ? {} : name === '../workerProductionMapSaved' ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('warehouse parser preserves fields, defaults, parent precedence and exact boolean semantics', () => {
  const { adminWarehouseFromJson: parse } = fixture([]);
  assert.deepEqual(parse({}), { warehouse: '', company: '', is_group: false, parent_warehouse: '' });
  assert.deepEqual(parse({ warehouse: 'W', company: 'C', is_group: true, parent: 'P' }),
    { warehouse: 'W', company: 'C', is_group: true, parent_warehouse: 'P' });
  assert.deepEqual(parse({ warehouse: '🧵', company: null, is_group: 1, parent_warehouse: '', parent: 'fallback' }),
    { warehouse: '🧵', company: '', is_group: false, parent_warehouse: '' });
  assert.equal(parse({ parent_warehouse: null, parent: 'fallback' }).parent_warehouse, 'fallback');
});

test('warehouse parser retains existing malformed JSON validation', () => {
  const { adminWarehouseFromJson: parse } = fixture([]);
  for (const value of [null, [], 'string', 4, false]) assert.throws(() => parse(value), /Invalid object/);
  for (const field of ['warehouse', 'company', 'parent_warehouse', 'parent'])
    assert.throws(() => parse({ [field]: 7 }), /Invalid string/, field);
  assert.throws(() => parse({ warehouse: 7, parent: 8 }), /Invalid string/);
});

test('the existing list reader and exported parser return the same records', async () => {
  const rows = [{ warehouse: 'A', is_group: true }, { warehouse: 'B', parent_warehouse: 'Y', parent: 'X' }, {}];
  const api = fixture(rows);
  assert.deepEqual(await api.adminWarehouses({}, {}), rows.map(api.adminWarehouseFromJson));
  await assert.rejects(fixture([{ warehouse: 'A' }, null]).adminWarehouses({}, {}), /Invalid object/);
});
