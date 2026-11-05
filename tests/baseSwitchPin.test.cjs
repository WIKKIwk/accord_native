const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const saved = load('savedAccountStore');
const { SwitchPinStore } = load('shared/switchPin', { '../savedAccountStore': saved });
const sha256 = async value => crypto.createHash('sha256').update(value).digest('hex');
function fixture() {
  const data = new Map(), storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => data.set(k, v), removeItem: async k => data.delete(k) };
  return { store: new SwitchPinStore(storage, sha256), data };
}
const account = (baseUrl, ref) => ({ baseUrl, profile: { role: 'aparatchi', ref } });

test('switch PIN is distinct per account and server, and accepts trimmed four digits', async () => {
  const { store, data } = fixture(), one = account('https://erp.example.com', 'one'), two = account('https://erp.example.com', 'two');
  await store.save(one, ' 1234 ');
  assert.equal(await store.has(one), true); assert.equal(await store.has(two), false);
  assert.equal(await store.verify(one, '1234'), true); assert.equal(await store.verify(one, '0000'), false);
  assert.equal(await store.verify(account('https://other.example.com', 'one'), '1234'), false);
  assert.equal([...data.values()][0], await sha256('1234'));
  await store.clear(one); assert.equal(await store.has(one), false);
});

test('switch PIN rejects malformed values', async () => {
  const { store } = fixture(), user = account('https://erp.example.com', 'one');
  for (const pin of ['123', 'abcd', '12345', '1 23']) {
    await assert.rejects(store.save(user, pin), /PIN/);
    assert.equal(await store.verify(user, pin), false);
  }
});
