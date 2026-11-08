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
  const deletions = [], copies = [], waitingCopies = [];
  let failCopy = false, pauseCopy = false, beforeRead = null;
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
    async text() {
      if (beforeRead) { const callback = beforeRead; beforeRead = null; callback(this.uri); }
      if (!files.has(this.uri)) throw new Error('file missing');
      return files.get(this.uri);
    }
    async copy(destination, options) {
      assert.deepEqual(options, { overwrite: true });
      // SDK 58 may remove an existing destination before attempting the copy.
      files.delete(destination.uri);
      if (pauseCopy) {
        pauseCopy = false;
        await new Promise((resolve, reject) => {
          const copy = { succeed: resolve, fail: () => reject(new Error('copy failed')) };
          if (waitingCopies.length) waitingCopies.shift()(copy); else copies.push(copy);
        });
      }
      if (failCopy) { failCopy = false; throw new Error('copy failed'); }
      if (!files.has(this.uri)) throw new Error('copy source missing');
      files.set(destination.uri, files.get(this.uri));
    }
    move(destination, options) {
      assert.deepEqual(options, { overwrite: true });
      const originalUri = this.uri, targetUri = destination.uri;
      return new Promise((resolve, reject) => {
        const move = {
          originalUri, targetUri,
          deleteTarget: () => files.delete(targetUri),
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
    delete() { deletions.push(this.uri); files.delete(this.uri); }
  }
  const backend = { Directory, File, Paths: { document: { uri: 'file:///documents' } } };
  const { ReturnedPaintDraftFileStorage } = load('boyoqchi/returnedPaintDraftRuntime', {
    'expo-crypto': cryptoApi, 'expo-file-system': backend, './returnedPaintDraft': draft,
  });
  return { files, deletions, storage: () => new ReturnedPaintDraftFileStorage(),
    failNextCopy: () => { failCopy = true; }, beforeNextRead: callback => { beforeRead = callback; },
    pauseNextCopy: () => { pauseCopy = true; }, pendingMoves: () => moves.length,
    nextCopy: () => copies.length ? Promise.resolve(copies.shift()) : new Promise(resolve => waitingCopies.push(resolve)),
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

test('delete-then-fail move preserves the last saved draft during the window and after restart', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const initial = await store.load('recover');
  initial.setValue('rasxot:Oq', 0, 'saved', 1);
  const first = await backend.nextMove();
  first.succeed();
  await store.flush('recover');

  initial.setValue('rasxot:Oq', 0, 'new', 1);
  const pending = store.flush('recover');
  const second = await backend.nextMove();
  const backupUri = `${second.targetUri}.bak`;
  assert.equal(JSON.parse(backend.files.get(backupUri)).values['rasxot:Oq'][0], 'saved');
  second.deleteTarget(); // Both native SDK implementations can pause or fail after this deletion.
  const during = await new draft.ReturnedPaintDraftStore(backend.storage()).load('recover');
  assert.equal(during.valuesFor('rasxot:Oq', 1)[0], 'saved');
  second.fail();
  await assert.rejects(pending, /move failed/);
  assert.equal(backend.files.has(second.originalUri), false);
  const restarted = new draft.ReturnedPaintDraftStore(backend.storage());
  const restored = await restarted.load('recover');
  assert.equal(restored.valuesFor('rasxot:Oq', 1)[0], 'saved');

  // A successful write after fallback keeps the recovered backup and stores the new draft.
  restored.setValue('rasxot:Oq', 0, 'recovered edit', 1);
  const retry = await backend.nextMove();
  retry.succeed();
  await restarted.flush('recover');
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('recover')).valuesFor('rasxot:Oq', 1)[0], 'recovered edit');
  assert.equal(JSON.parse(backend.files.get(backupUri)).values['rasxot:Oq'][0], 'saved');
});

test('repeated writes keep the most recent saved version in backup, and clear removes all copies', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('clear-recovery');
  for (const value of ['one', 'two']) {
    current.setValue('rasxot:Oq', 0, value, 1);
    const move = await backend.nextMove();
    move.succeed();
    await store.flush('clear-recovery');
  }
  current.setValue('rasxot:Oq', 0, 'three', 1);
  const pending = store.flush('clear-recovery'), interrupted = await backend.nextMove();
  interrupted.deleteTarget();
  interrupted.fail();
  await assert.rejects(pending, /move failed/);
  const restarted = new draft.ReturnedPaintDraftStore(backend.storage());
  assert.equal((await restarted.load('clear-recovery')).valuesFor('rasxot:Oq', 1)[0], 'two');
  // An interrupted process can leave a temporary file; it must not resurrect a cleared draft.
  backend.files.set(interrupted.originalUri, 'stale temporary content');
  await restarted.clear('clear-recovery');
  assert.equal(backend.files.has(interrupted.targetUri), false);
  assert.equal(backend.files.has(`${interrupted.targetUri}.bak`), false);
  assert.equal(backend.files.has(interrupted.originalUri), false);
  assert.ok(backend.deletions.includes(`${interrupted.targetUri}.bak`));
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('clear-recovery')).valuesFor('rasxot:Oq', 1)[0], '');
});

test('backup copy failure leaves the primary readable even if the old backup was deleted', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('copy-failure');
  for (const value of ['one', 'two']) {
    current.setValue('rasxot:Oq', 0, value, 1);
    const move = await backend.nextMove();
    move.succeed();
    await store.flush('copy-failure');
  }
  backend.failNextCopy();
  current.setValue('rasxot:Oq', 0, 'three', 1);
  await assert.rejects(store.flush('copy-failure'), /copy failed/);
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('copy-failure')).valuesFor('rasxot:Oq', 1)[0], 'two');
  assert.equal([...backend.files.keys()].some(name => name.endsWith('.tmp')), false);
});

test('read falls back if the primary disappears after its existence check', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('read-race');
  for (const value of ['old', 'new']) {
    current.setValue('rasxot:Oq', 0, value, 1);
    const move = await backend.nextMove();
    move.succeed();
    await store.flush('read-race');
  }
  backend.beforeNextRead(uri => backend.files.delete(uri));
  const restored = await new draft.ReturnedPaintDraftStore(backend.storage()).load('read-race');
  assert.equal(restored.valuesFor('rasxot:Oq', 1)[0], 'old');
});

test('clear deletes backup before primary, removes stale temp, and leaves other scopes intact', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const a = await store.load('a'), b = await store.load('b');
  let lastA, lastB;
  for (const [current, scope, value] of [[a, 'a', 'one'], [a, 'a', 'two'], [b, 'b', 'other']]) {
    current.setValue('rasxot:Oq', 0, value, 1);
    const move = await backend.nextMove();
    move.succeed();
    await store.flush(scope);
    if (scope === 'a') lastA = move; else lastB = move;
  }
  assert.equal(backend.files.has(lastA.targetUri), true);
  assert.equal(backend.files.has(`${lastA.targetUri}.bak`), true);
  backend.files.set(lastA.originalUri, 'stale');
  backend.deletions.length = 0;
  await store.clear('a');
  assert.deepEqual(backend.deletions, [`${lastA.targetUri}.bak`, lastA.targetUri, lastA.originalUri]);
  assert.equal(backend.files.has(lastB.targetUri), true);
  const restarted = new draft.ReturnedPaintDraftStore(backend.storage());
  assert.equal((await restarted.load('a')).valuesFor('rasxot:Oq', 1)[0], '');
  assert.equal((await restarted.load('b')).valuesFor('rasxot:Oq', 1)[0], 'other');
});

test('after a failed queued write, clear can be retried and removes the recovered backup', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('clear-after-failure');
  current.setValue('rasxot:Oq', 0, 'saved', 1);
  const first = await backend.nextMove();
  first.succeed();
  await store.flush('clear-after-failure');
  current.setValue('rasxot:Oq', 0, 'failed', 1);
  const pending = store.flush('clear-after-failure'), move = await backend.nextMove();
  move.deleteTarget();
  move.fail();
  await assert.rejects(pending, /move failed/);
  // V2 likewise waits for the queued write and propagates its failure before removal.
  await assert.rejects(store.clear('clear-after-failure'), /move failed/);
  await store.clear('clear-after-failure');
  assert.equal(backend.files.has(`${move.targetUri}.bak`), false);
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('clear-after-failure')).valuesFor('rasxot:Oq', 1)[0], '');
});

test('replacement waits for the asynchronous backup copy while the previous primary remains readable', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('copy-order');
  current.setValue('rasxot:Oq', 0, 'saved', 1);
  const first = await backend.nextMove();
  first.succeed();
  await store.flush('copy-order');

  backend.pauseNextCopy();
  current.setValue('rasxot:Oq', 0, 'new', 1);
  const pending = store.flush('copy-order'), copy = await backend.nextCopy();
  await tick();
  assert.equal(backend.pendingMoves(), 0, 'replacement must wait for the backup copy');
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('copy-order')).valuesFor('rasxot:Oq', 1)[0], 'saved');
  copy.succeed();
  const second = await backend.nextMove();
  assert.equal(JSON.parse(backend.files.get(`${second.targetUri}.bak`)).values['rasxot:Oq'][0], 'saved');
  second.succeed();
  await pending;
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('copy-order')).valuesFor('rasxot:Oq', 1)[0], 'new');
});
