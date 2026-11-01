const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/chatComposer.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);

test('saving a message clears only that message and preserves text typed meanwhile', () => {
  const { draftAfterSending } = loaded.exports;
  assert.equal(draftAfterSending('Salom', 'Salom'), '');
  assert.equal(draftAfterSending('Salom', 'Salom keyingi xabar'), 'Salom keyingi xabar');
  assert.equal(draftAfterSending('Salom', 'Boshqa matn'), 'Boshqa matn');
  assert.equal(draftAfterSending('Salom', 'Salo'), 'Salo');
});
