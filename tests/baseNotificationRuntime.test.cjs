const assert = require('node:assert/strict');
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
const search = load('shared/searchActivityStore');
const stores = load('shared/notificationStores', { './searchActivityStore': search });

test('session reset clears the shared hidden and unread notification stores', async () => {
  const data = new Map(); let reset;
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) };
  const user = { profile: { role: 'supplier', ref: 'one' }, capabilities: ['supplier.access'] };
  const runtime = load('shared/notificationStoresRuntime', { '../auth': { currentSession: () => user,
    registerSessionResetHook: hook => { reset = hook; return () => {}; } }, '../appPreferences': { appPreferences: storage }, './notificationStores': stores });
  await runtime.notificationUnreadStore.markUnread(null, ['a']);
  await runtime.notificationHiddenStore.hideAll(null, ['b']);
  await reset();
  assert.equal(data.has('notification_unread_v1'), false); assert.equal(data.has('notification_hidden_v1'), false);
  assert.equal(runtime.notificationUnreadStore.hasUnreadForProfile(user), false);
});
