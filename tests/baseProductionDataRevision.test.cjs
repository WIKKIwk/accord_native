const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/productionDataRevision.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ProductionDataRevision } = mod.exports;

test('production revisions notify once for each newer revision, epoch, or account scope', () => {
  let scope = 'account-1'; const state = new ProductionDataRevision(() => scope), seen = [];
  const unsubscribe = state.subscribe(revision => seen.push(revision));
  assert.equal(state.isCurrentScope, false);
  state.notify('epoch-a', 4); state.notify('epoch-a', 4); state.notify('epoch-a', 3); state.notify('epoch-a', 5);
  state.notify('epoch-b', 1); scope = 'account-2'; assert.equal(state.isCurrentScope, false);
  state.notify('epoch-b', 1); assert.equal(state.isCurrentScope, true);
  unsubscribe(); state.notify('epoch-b', 2);
  assert.equal(state.revision, 5); assert.deepEqual(seen, [1, 2, 3, 4]);
});
