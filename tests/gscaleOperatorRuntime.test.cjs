const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleOperatorRuntime.ts');
const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
let assignments = [], calls = 0;
m.require = name => {
  if (name === '../shared/catalogApi') return { adminWarehouseAssignments: async () => { calls++; return assignments; } };
  if (name.startsWith('.') || name === 'react-native') return {};
  return require(name);
};
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { materialAssignedWarehouseNames } = m.exports;

test('material warehouse scope prefers explicit assignments and normalizes names', async () => {
  calls = 0;
  const result = await materialAssignedWarehouseNames({ assigned_warehouses: [' Kalidor ', 'KALIDOR', ''], profile: {} });
  assert.deepEqual([...result], ['kalidor']); assert.equal(calls, 0);
});

test('fallback assignments match material/preparation users by ref or display name', async () => {
  assignments = [
    { principal_role: 'material_taminotchi', principal_ref: 'MAT-1', display_name: '', warehouse: ' A ' },
    { principal_role: 'tayyorlov_masteri', principal_ref: '', display_name: 'Ali', warehouse: 'B' },
    { principal_role: 'werka', principal_ref: 'MAT-1', display_name: 'Ali', warehouse: 'C' },
    { principal_role: 'material_taminotchi', principal_ref: 'OTHER', display_name: '', warehouse: 'D' },
  ];
  const result = await materialAssignedWarehouseNames({ assigned_warehouses: [], profile: { ref: 'mat-1', display_name: 'ali' } });
  assert.deepEqual([...result], ['a', 'b']);
});
