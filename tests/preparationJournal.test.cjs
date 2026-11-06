const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/preparation/preparationJournal.ts');
const mod = new Module(filename, module);
mod.require = id => id === '../workerControlsApi' ? { WorkerControlException: class extends Error {} } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
const { PreparationJournal } = mod.exports;
const page = (items, more, next) => ({ items, has_more: more, next_offset: next });
test('journal silently refreshes the whole loaded window and deduplicates by identity', async () => {
  const calls = [], rounds = [page([{ id: 'a', n: 1 }], true, 1), page([{ id: 'b', n: 1 }], false, null),
    page([{ id: 'a', n: 2 }], true, 1), page([{ id: 'b', n: 2 }], false, null)];
  const journal = new PreparationJournal(async offset => { calls.push(offset); return rounds.shift(); }, x => x.id, () => 'scope', () => {});
  await journal.load(); await journal.load({ append: true }); await journal.load({ silent: true });
  assert.deepEqual(calls, [0, 1, 0, 1]); assert.deepEqual(journal.state.items.map(v => v.n), [2, 2]);
  assert.equal(journal.state.has_more, false); journal.dispose();
});
test('a changed filter discards the old response and queues one fresh load', async () => {
  let release, calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const journal = new PreparationJournal(async () => ++calls === 1 ? pending : page([{ id: 'new' }], false, null), x => x.id, () => 'scope', () => {});
  const first = journal.load(); await journal.load(); release(page([{ id: 'old' }], false, null)); await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2); assert.deepEqual(journal.state.items, [{ id: 'new' }]); journal.dispose();
});
test('account changes discard a late response and clear journal data', async () => {
  let release, scope = 'a'; const pending = new Promise(resolve => { release = resolve; });
  const journal = new PreparationJournal(() => pending, x => x.id, () => scope, () => {});
  const request = journal.load(); scope = 'b'; journal.sessionChanged(); release(page([{ id: 'old' }], false, null)); await request;
  assert.deepEqual(journal.state.items, []); assert.match(journal.state.error, /Akkaunt o‘zgargan/); journal.dispose();
});
test('journal rejects a non-advancing next page', async () => {
  const journal = new PreparationJournal(async () => page([{ id: 'a' }], true, 0), x => x.id, () => 'scope', () => {});
  await journal.load(); assert.equal(journal.state.items.length, 0); assert.match(journal.state.error, /Qayta urinib/); journal.dispose();
});
test('session reset clears the journal before the active session changes', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const journal = new PreparationJournal(() => pending, x => x.id, () => 'same-scope', () => {});
  const request = journal.load(); journal.sessionChanged(true);
  release(page([{ id: 'old' }], false, null)); await request;
  assert.deepEqual(journal.state.items, []); assert.match(journal.state.error, /Akkaunt/); journal.dispose();
});
