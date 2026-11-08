const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/supplier/supplierMaterialText.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);

test('menu accessibility tooltip follows Flutter Material localizations in every app locale', () => {
  const { supplierMenuTooltip } = mod.exports;
  assert.equal(supplierMenuTooltip('uz'), 'Navigatsiya menyusini ochish');
  assert.equal(supplierMenuTooltip('en'), 'Open navigation menu');
  assert.equal(supplierMenuTooltip('ru'), 'Открыть меню навигации');
  assert.equal(supplierMenuTooltip('ur-PK'), 'نیویگیشن مینیو کھولیں');
  assert.equal(supplierMenuTooltip('zz'), 'Open navigation menu');
});
