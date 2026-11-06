const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(filename) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return mod.exports;
}

const { preparationSeriyoSearch } = load('preparationSeriyoSearch');
const material = (code, name, can_receive = true) => ({ code, name, can_receive, visible_warehouses: null, balances: {} });

test('seriyo picker filters receivable materials and searches hidden codes', () => {
  const values = [material('PREP-1', 'Kley'), material('PREP-2', 'Un'), material('PREP-3', 'Boya', false)];
  assert.deepEqual(preparationSeriyoSearch(values, '', 50).items.map(item => item.name), ['Kley', 'Un']);
  assert.deepEqual(preparationSeriyoSearch(values, ' prep-2 ', 50).items.map(item => item.name), ['Un']);
  assert.deepEqual(preparationSeriyoSearch(values, 'boya', 50).items, []);
});

test('seriyo picker pages before applying V2 relevance order', () => {
  const values = [material('1', 'Qora kley'), material('2', 'Kley'), material('3', 'Kley rangli'),
    ...Array.from({ length: 52 }, (_, index) => material(`P${index}`, `Kley ${index}`))];
  const first = preparationSeriyoSearch(values, 'kley', 50);
  assert.equal(first.items.length, 50);
  assert.equal(first.hasMore, true);
  assert.deepEqual(first.items.slice(0, 2).map(item => item.name), ['Kley', 'Kley rangli']);
  assert.equal(preparationSeriyoSearch(values, 'kley', 100).hasMore, false);
});
