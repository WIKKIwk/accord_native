const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/werka/werkaStoreApi.ts');
function setup(home) {
  const calls = [], loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => {
    if (name === '../werkaHomeApi') return { werkaHome: async session => { calls.push(['home', session]); return home; } };
    if (name === '../shared/notificationApi') return { dispatchRecordFromJson: value => ({ parsed: value }) };
    if (name === './werkaRecordApi') return Object.fromEntries(['werkaPending', 'werkaHistory', 'werkaStatusBreakdown', 'werkaStatusDetails']
      .map(key => [key, (...args) => { calls.push([key, ...args]); return Promise.resolve([]); }]));
    return require(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports.werkaStoreApi, calls };
}
test('store adapter reuses the shared dispatch parser and preserves counts', async () => {
  const { api, calls } = setup({ summary: { pending_count: 1, confirmed_count: 2, returned_count: 3 }, pending_items: [{ id: 'r' }] });
  const session = { token: 'fake' }, result = await api.home(session);
  assert.deepEqual(result, { summary: { pendingCount: 1, confirmedCount: 2, returnedCount: 3 }, pendingItems: [{ parsed: { id: 'r' } }] });
  await api.details(session, 'confirmed', 's'); assert.deepEqual(calls[1], ['werkaStatusDetails', session, 'confirmed', 's']);
});
test('store adapter rejects a malformed count instead of inventing one', async () => {
  const { api } = setup({ summary: { pending_count: 'bad', confirmed_count: 2, returned_count: 3 }, pending_items: [] });
  await assert.rejects(api.home({}), /Invalid Werka summary count/);
});
