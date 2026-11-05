const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/chunkedStorage.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { chunkedStorage } = loaded.exports;

function storage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { assert.ok(Buffer.byteLength(value) < 2048); values.set(key, value); },
    removeItem: async key => { values.delete(key); } };
}

test('secure values round-trip across bounded chunks, replacement and deletion', async () => {
  const backing = storage(), secure = chunkedStorage(backing), value = '🔒'.repeat(1200);
  await secure.setItem('account', value);
  assert.equal(await secure.getItem('account'), value);
  assert.ok(backing.values.size > 1);
  await secure.setItem('account', 'small');
  assert.equal(await secure.getItem('account'), 'small');
  assert.equal(backing.values.size, 1);
  await secure.setItem('account', value);
  await secure.removeItem('account');
  assert.equal(backing.values.size, 0);
});

test('failed replacement retains the previous secure value', async () => {
  const backing = storage(), secure = chunkedStorage(backing), previous = 'old';
  await secure.setItem('account', previous);
  const setItem = backing.setItem;
  backing.setItem = async (key, value) => {
    if (key === 'account') throw new Error('commit failed');
    await setItem(key, value);
  };
  await assert.rejects(secure.setItem('account', 'new'.repeat(1000)), /commit failed/);
  assert.equal(await secure.getItem('account'), previous);
  assert.equal(backing.values.size, 1);
});
