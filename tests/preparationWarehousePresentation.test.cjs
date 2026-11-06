const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/preparation/preparationWarehousePresentation.ts');
const mod = new Module(filename, module);
class WorkerControlException extends Error {}
mod.require = id => id === '../workerControlsApi' ? { WorkerControlException } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
}).outputText, filename);
const { preparationWarehouseParent, preparationWarehouseDeleteMessage, preparationWarehouseErrorMessage } = mod.exports;

test('warehouse creation defaults to the selected eligible parent or the first eligible warehouse', () => {
  assert.equal(preparationWarehouseParent(['A', 'B'], 'B'), 'B');
  assert.equal(preparationWarehouseParent(['A', 'B'], 'C'), 'A');
  assert.equal(preparationWarehouseParent(['A', 'B'], null), 'A');
  assert.equal(preparationWarehouseParent([], null), null);
});

test('warehouse management keeps the V2 confirmation and error messages', () => {
  assert.equal(preparationWarehouseDeleteMessage('Bola'), '«Bola» ombori o‘chirilsinmi? Ichida homashyo yoki bog‘langan yozuvlar bo‘lsa, o‘chirilmaydi.');
  assert.equal(preparationWarehouseErrorMessage(new WorkerControlException('Server xatosi')), 'Server xatosi');
  assert.equal(preparationWarehouseErrorMessage(new Error('offline')), 'Ombor bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring');
});
