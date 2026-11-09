const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/qolip/qolipSetNameState.ts'), m = new Module(filename, module);
m.require = key => key === './qolipSetsApi' ? {} : require(key);
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { QolipSetNameState } = m.exports;
const entry = { name: 'Old', set: { id: '123' } };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('rename starts with existing name, sends the raw input once and returns the server set', async () => {
  const calls = [], saved = { ...entry, name: 'New' }, state = new QolipSetNameState(entry, async name => { calls.push(name); return saved; });
  assert.equal(state.getSnapshot().name, 'Old'); state.setName(' New  name ');
  assert.equal(await state.save(), saved); assert.deepEqual(calls, [' New  name ']); assert.equal(state.getSnapshot().saving, false);
});

test('saving blocks repeat submit, edit and dismissal until the request settles', async () => {
  const wait = deferred(); let calls = 0;
  const state = new QolipSetNameState(entry, () => { calls++; return wait.promise; });
  const pending = state.save(); assert.equal(state.getSnapshot().saving, true); state.setName('Ignored');
  assert.equal(state.getSnapshot().name, 'Old'); assert.equal(await state.save(), null); assert.equal(calls, 1);
  wait.resolve(entry); assert.equal(await pending, entry); assert.equal(state.getSnapshot().saving, false);
});

test('failure stays in the dialog and changing text clears the error', async () => {
  const error = new Error('conflict'), state = new QolipSetNameState(entry, async () => { throw error; });
  assert.equal(await state.save(), null); assert.equal(state.getSnapshot().error, error); assert.equal(state.getSnapshot().saving, false);
  state.setName('New'); assert.equal(state.getSnapshot().error, null); assert.equal(state.getSnapshot().name, 'New');
});

test('a request settling after disposal cannot close or mutate a later dialog', async () => {
  const wait = deferred(), state = new QolipSetNameState(entry, () => wait.promise), pending = state.save();
  state.dispose(); state.activate(); wait.resolve({ ...entry, name: 'stale' }); assert.equal(await pending, null);
  assert.equal(state.getSnapshot().saving, false);
});
