const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
const draft = load('boyoqchi/returnedPaintDraft', { './returnedPaintModel': model });
const cryptoApi = { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, value) =>
  crypto.createHash('sha256').update(value).digest('hex') };

// SDK 58 File.move returns a promise and mutates the source File URI on success.
// Each test controls completion so an omitted await cannot pass by timing luck.
function createBackend() {
  const files = new Map(), moves = [], waiting = [];
  class Directory {
    constructor(parent, name) { this.uri = `${parent.uri}/${name}`; }
    create() {}
  }
  class File {
    constructor(parent, name) { this.uri = typeof parent === 'string' ? parent : `${parent.uri}/${name}`; }
    get name() { return this.uri.split('/').pop(); }
    get exists() { return files.has(this.uri); }
    create() { files.set(this.uri, ''); }
    write(value) { files.set(this.uri, value); }
    async text() { return files.get(this.uri); }
    move(destination, options) {
      assert.deepEqual(options, { overwrite: true });
      const originalUri = this.uri, targetUri = destination.uri;
      return new Promise((resolve, reject) => {
        const move = {
          originalUri, targetUri,
          succeed: () => {
            if (!files.has(originalUri)) { reject(new Error('temporary file missing')); return; }
            files.set(targetUri, files.get(originalUri));
            files.delete(originalUri);
            this.uri = targetUri;
            resolve();
          },
          fail: () => reject(new Error('move failed')),
        };
        if (waiting.length) waiting.shift()(move); else moves.push(move);
      });
    }
    delete() { files.delete(this.uri); }
  }
  const backend = { Directory, File, Paths: { document: { uri: 'file:///documents' } } };
  const { ReturnedPaintDraftFileStorage } = load('boyoqchi/returnedPaintDraftRuntime', {
    'expo-crypto': cryptoApi, 'expo-file-system': backend, './returnedPaintDraft': draft,
  });
  return { files, storage: () => new ReturnedPaintDraftFileStorage(),
    nextMove: () => moves.length ? Promise.resolve(moves.shift()) : new Promise(resolve => waiting.push(resolve)) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('delayed move is awaited, preserves its mutated destination, and survives store restart', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const initial = await store.load('actor:request');
  initial.setValue('rasxot:Oq', 0, '12.5', 1);
  let flushed = false;
  const pending = store.flush('actor:request').then(() => { flushed = true; });
  const move = await backend.nextMove();
  await tick();
  assert.equal(flushed, false, 'flush must wait for SDK relocation');
  assert.equal(backend.files.has(move.originalUri), true);
  move.succeed();
  await pending;
  assert.equal(backend.files.has(move.originalUri), false);
  assert.equal(backend.files.has(move.targetUri), true, 'cleanup must not delete the mutated destination');
  const restored = await new draft.ReturnedPaintDraftStore(backend.storage()).load('actor:request');
  assert.equal(restored.valuesFor('rasxot:Oq', 1)[0], '12.5');
});

test('failed asynchronous move rejects flush and cleans the original temporary path', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const initial = await store.load('actor:request');
  initial.setValue('rasxot:Oq', 0, 'failed', 1);
  const pending = store.flush('actor:request');
  const move = await backend.nextMove();
  move.fail();
  await assert.rejects(pending, /move failed/);
  assert.equal(backend.files.has(move.originalUri), false);
  assert.equal(backend.files.has(move.targetUri), false);
});

test('successive writes wait for each relocation and retain the latest value for each scope', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const a = await store.load(`actor:${'id'.repeat(400)}`), b = await store.load('other:request');
  a.setValue('rasxot:Oq', 0, 'first', 1);
  const first = await backend.nextMove();
  a.setValue('rasxot:Oq', 0, 'second', 1);
  b.setValue('rasxot:Oq', 0, 'other', 1);
  const other = await backend.nextMove();
  assert.notEqual(first.targetUri, other.targetUri);
  first.succeed(); other.succeed();
  const second = await backend.nextMove();
  assert.equal(second.targetUri, first.targetUri);
  second.succeed();
  await Promise.all([store.flush(`actor:${'id'.repeat(400)}`), store.flush('other:request')]);
  const restarted = new draft.ReturnedPaintDraftStore(backend.storage());
  assert.equal((await restarted.load(`actor:${'id'.repeat(400)}`)).valuesFor('rasxot:Oq', 1)[0], 'second');
  assert.equal((await restarted.load('other:request')).valuesFor('rasxot:Oq', 1)[0], 'other');
  assert.equal([...backend.files.keys()].some(name => name.endsWith('.tmp')), false);
});

test('clear waits for a pending move and leaves no draft after restart', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const initial = await store.load('clear-scope');
  initial.setValue('rasxot:Oq', 0, 'pending', 1);
  const move = await backend.nextMove();
  let cleared = false;
  const pending = store.clear('clear-scope').then(() => { cleared = true; });
  await tick();
  assert.equal(cleared, false, 'clear must not race the pending relocation');
  move.succeed();
  await pending;
  assert.equal(backend.files.has(move.originalUri), false);
  assert.equal(backend.files.has(move.targetUri), false);
  const restored = await new draft.ReturnedPaintDraftStore(backend.storage()).load('clear-scope');
  assert.equal(restored.valuesFor('rasxot:Oq', 1)[0], '');
});
