const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), module_ = new Module(filename, module);
  module_.require = key => key in dependencies ? dependencies[key] : require(key);
  module_._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return module_.exports;
}
const normalizer = load('shared/searchNormalizer.ts');
const search = load('qolip/qolipSearchEngine.ts', { '../shared/searchNormalizer': normalizer });
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const { QolipBlocksState } = load('qolip/qolipBlocksState.ts', { './qolipBlocksApi': {}, './qolipApiCommon': common, './qolipSearchEngine': search });
const blocks = [{ name: 'A Block', warehouse: 'Toshkent' }, { name: 'Ikkinchi', warehouse: 'Samarqand' }];
const response = value => ({ blocks: value, warehouses: [], supports_cross_block_move: false });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(overrides = {}) {
  const calls = [], notices = [];
  const state = new QolipBlocksState({ read: () => { calls.push(['read']); return Promise.resolve(response(blocks)); },
    update: (block, name) => { calls.push(['update', block, name]); return Promise.resolve(); },
    remove: block => { calls.push(['remove', block]); return Promise.resolve(); }, ...overrides }, notice => notices.push(notice));
  return { state, calls, notices };
}

test('blocks load and search reuse the V2 matcher on names and warehouses', async () => {
  const { state } = harness(); await state.reload();
  assert.equal(state.getSnapshot().loading, false); assert.deepEqual(state.filtered, blocks);
  state.setQuery(' samarkand '); assert.deepEqual(state.filtered, [blocks[1]]);
  state.setQuery('BLok'); assert.deepEqual(state.filtered, [blocks[0]]);
  state.setQuery('unrelated'); assert.deepEqual(state.filtered, []);
});

test('reload keeps previous rows while waiting, then exposes error; later retry recovers', async () => {
  const wait = deferred(); let reads = 0;
  const { state } = harness({ read: () => ++reads === 1 ? Promise.resolve(response(blocks)) : reads === 2 ? wait.promise : Promise.resolve(response([blocks[1]])) });
  await state.reload(); const pending = state.reload();
  assert.equal(state.getSnapshot().loading, false); assert.equal(state.getSnapshot().refreshing, true); assert.deepEqual(state.filtered, blocks);
  wait.reject(new Error('offline')); await assert.rejects(pending, /offline/);
  assert.equal(state.getSnapshot().error, true); assert.equal(state.getSnapshot().blocks, null);
  await state.reload(); assert.equal(state.getSnapshot().error, false); assert.deepEqual(state.filtered, [blocks[1]]);
});

test('latest FutureBuilder request wins regardless of network completion order', async () => {
  const first = deferred(), second = deferred(); let reads = 0;
  const { state } = harness({ read: () => (++reads === 1 ? first.promise : second.promise) });
  const a = state.reload(), b = state.reload(); second.resolve(response([blocks[1]])); await b;
  first.resolve(response([blocks[0]])); await a; assert.deepEqual(state.filtered, [blocks[1]]);
});

test('edit ignores empty or unchanged names, trims changes and reloads after server success', async () => {
  const h = harness(); await h.state.reload(); h.calls.length = 0;
  await h.state.edit(blocks[0], '   '); await h.state.edit(blocks[0], ' A Block '); assert.deepEqual(h.calls, []);
  await h.state.edit(blocks[0], ' New Block ');
  assert.deepEqual(h.calls, [['update', blocks[0], 'New Block'], ['read']]); assert.deepEqual(h.notices, [{ kind: 'updated' }]);
});

test('save is exclusive; a failed mutation leaves data intact and supplies the actual error', async () => {
  const wait = deferred(); const h = harness({ update: () => wait.promise }); await h.state.reload();
  const first = h.state.edit(blocks[0], 'X'); assert.equal(h.state.getSnapshot().saving, true);
  await h.state.remove(blocks[1]); const error = new Error('block_exists'); wait.reject(error); await first;
  assert.deepEqual(h.state.filtered, blocks); assert.deepEqual(h.notices, [{ kind: 'update_failed', error }]);
  assert.equal(h.state.getSnapshot().saving, false);
});

test('successful mutation followed by failed reload emits both notices as in V2', async () => {
  const error = new Error('offline'), h = harness({ read: () => Promise.reject(error) });
  await h.state.remove(blocks[0]);
  assert.deepEqual(h.notices, [{ kind: 'deleted' }, { kind: 'delete_failed', error }]);
  assert.equal(h.state.getSnapshot().error, true); assert.equal(h.state.getSnapshot().saving, false);
});

test('disposing prevents delayed reads and actions from updating the view', async () => {
  const wait = deferred(), h = harness({ read: () => wait.promise });
  const pending = h.state.reload(); h.state.dispose(); wait.resolve(response(blocks)); await pending;
  assert.equal(h.state.getSnapshot().blocks, null); assert.deepEqual(h.notices, []);
});


test('a save started before unmount cannot notify a later mount of the same controller', async () => {
  const wait = deferred(), h = harness({ update: () => wait.promise });
  const pending = h.state.edit(blocks[0], 'X'); h.state.dispose(); h.state.activate();
  assert.equal(h.state.getSnapshot().saving, false);
  wait.resolve(); await pending; assert.deepEqual(h.notices, []); assert.deepEqual(h.calls, []);
});
