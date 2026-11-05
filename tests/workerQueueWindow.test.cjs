const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

test('worker search preserves 120 complete Unicode code points as V2 does', () => {
  const { workerQueueSearch } = load('workerQueueWindow');
  const input = `  ${'a'.repeat(119)}😀extra  `;
  assert.equal(workerQueueSearch(input), `${'a'.repeat(119)}😀`);
  assert.equal(Array.from(workerQueueSearch(input)).length, 120);
});

test('worker queue limit rejects unsupported values before saving', async () => {
  let writes = 0;
  const api = load('workerQueueLimit', {
    'expo-secure-store': { getItemAsync: async () => null, setItemAsync: async () => { writes++; } },
    'react-native': { Platform: { OS: 'ios' } },
  });
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } };
  await assert.rejects(api.saveQueueLimit(session, 999), RangeError);
  assert.equal(writes, 0);
  await api.saveQueueLimit(session, 5);
  assert.equal(writes, 1);
});
