const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(store) {
  const filename = path.resolve(__dirname, '../src/appAppearance.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id === 'expo-secure-store' ? store : id === 'react-native' ? { Platform: { OS: 'ios' } } : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

test('appearance defaults to the system and restores valid choices', async () => {
  let saved = null;
  const api = load({ getItemAsync: async () => saved, setItemAsync: async (_key, value) => { saved = value; } });
  assert.equal(await api.loadAppearancePreference(), 'system');
  await api.saveAppearancePreference('dark');
  assert.equal(await api.loadAppearancePreference(), 'dark');
  saved = 'unexpected';
  assert.equal(await api.loadAppearancePreference(), 'system');
});

test('rapid changes are persisted in order and a failed save does not block later changes', async () => {
  const calls = [];
  let release;
  const first = new Promise(resolve => { release = resolve; });
  const api = load({
    getItemAsync: async () => calls.at(-1),
    setItemAsync: async (_key, value) => {
      if (value === 'light') await first;
      if (value === 'system') throw new Error('storage unavailable');
      calls.push(value);
    },
  });
  const light = api.saveAppearancePreference('light');
  const dark = api.saveAppearancePreference('dark');
  release();
  await Promise.all([light, dark]);
  assert.deepEqual(calls, ['light', 'dark']);
  await assert.rejects(api.saveAppearancePreference('system'));
  await api.saveAppearancePreference('light');
  assert.equal(await api.loadAppearancePreference(), 'light');
});
