const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const files = new Map();
class FakeFile {
  constructor(_directory, name) { this.name = name; }
  get exists() { return files.has(this.name); }
  async text() { return files.get(this.name); }
  async write(value) { await new Promise(resolve => setTimeout(resolve, 2)); files.set(this.name, value); }
}
const filename = path.resolve(__dirname, '../src/returnedPaintDraft.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = id => id === 'expo-file-system' ? { File: FakeFile, Paths: { document: '/test' } } :
  id === 'react-native' ? { Platform: { OS: 'android' } } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { loadReturnedPaintDraft, saveReturnedPaintDraft } = loaded.exports;

test('drafts persist by worker and order, and successful completion clears only its own draft', async () => {
  const draft = { values: { 'rasxot:Pantone:Blue': '1.5' }, fields: { 'rasxot:Pantone': ['Blue'] }, usage: 'astatka', imageId: 'image-1' };
  const other = { values: { 'astatka:Oq:Mix': '2' }, fields: {}, usage: 'rasxot', imageId: '' };
  await Promise.all([saveReturnedPaintDraft('worker-1:order-1', draft), saveReturnedPaintDraft('worker-2:order-1', other)]);
  assert.deepEqual(await loadReturnedPaintDraft('worker-1:order-1'), draft);
  assert.deepEqual(await loadReturnedPaintDraft('worker-2:order-1'), other);
  await saveReturnedPaintDraft('worker-1:order-1', { values: {}, fields: {}, usage: 'rasxot', imageId: '' });
  assert.equal(await loadReturnedPaintDraft('worker-1:order-1'), null);
  assert.deepEqual(await loadReturnedPaintDraft('worker-2:order-1'), other);
});
