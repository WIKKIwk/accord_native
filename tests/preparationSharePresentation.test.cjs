const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

class WorkerControlException extends Error {}
function load(filename) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === '../workerControlsApi' ? { WorkerControlException }
    : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return mod.exports;
}

const shares = load('preparationSharePresentation');
test('share totals and validation follow the V2 sheet', () => {
  assert.deepEqual(shares.preparationShareSummary(['30', '70']), { valid: true, total: '100' });
  assert.deepEqual(shares.preparationShareSummary(['30', '60']), { valid: false, total: '90' });
  assert.deepEqual(shares.preparationShareSummary(['0', '100']), { valid: false, total: null });
  assert.deepEqual(shares.preparationShareSummary(['101']), { valid: false, total: null });
  assert.deepEqual(shares.preparationShareSummary([]), { valid: false, total: '0' });
});

test('share explanation and failure messages match V2', () => {
  assert.equal(shares.preparationShareIntroduction('Kley'),
    'Kley: shnek ulushlari jami 100% bo‘lsin. Har bir shnek ichidagi seriyolar alohida 100% hisoblanadi.');
  assert.match(shares.preparationShareIntroduction(''), /^Homashyo:/);
  assert.equal(shares.preparationShareErrorMessage(new WorkerControlException('Server xatosi')), 'Server xatosi');
  assert.equal(shares.preparationShareErrorMessage(new Error('offline')), 'Shnek ulushlari saqlanmadi. Qayta urinib ko‘ring');
});
