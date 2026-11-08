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
const scopes = load('boyoqchi/boyoqchiDraftScope');
const sessionScope = load('sessionReadScope');
const cryptoApi = { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, value) =>
  crypto.createHash('sha256').update(value).digest('hex') };

// SDK 58 File.move returns a promise and mutates the source File URI on success.
// Each test controls completion so an omitted await cannot pass by timing luck.
function createBackend() {
  const files = new Map(), moves = [], waiting = [];
  const deletions = [], copies = [], waitingCopies = [], reads = [], waitingReads = [];
  let failCopy = false, pauseCopy = false, pauseRead = false, beforeRead = null, active = null, epoch = 1;
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
      if (pauseRead) {
        pauseRead = false;
        await new Promise(resolve => {
          const read = { resume: resolve };
          if (waitingReads.length) waitingReads.shift()(read); else reads.push(read);
        });
      }
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
  const runtime = load('boyoqchi/returnedPaintDraftRuntime', {
    'expo-crypto': cryptoApi, 'expo-file-system': backend, './returnedPaintDraft': draft, './boyoqchiDraftScope': scopes,
    '../auth': { activeSessionToken: session => active === session ? session.token : null,
      activeSessionEpoch: session => active === session ? epoch : null },
    '../sessionReadScope': sessionScope,
  });
  return { files, deletions, storage: () => new runtime.ReturnedPaintDraftFileStorage(() => true),
    activate: session => { active = session; }, advanceEpoch: () => { epoch++; },
    sessionStore: session => runtime.returnedPaintDraftStoreFor(session),
    failNextCopy: () => { failCopy = true; }, beforeNextRead: callback => { beforeRead = callback; },
    pauseNextCopy: () => { pauseCopy = true; }, pendingMoves: () => moves.length,
    pauseNextRead: () => { pauseRead = true; },
    nextRead: () => reads.length ? Promise.resolve(reads.shift()) : new Promise(resolve => waitingReads.push(resolve)),
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

test('clear and an overlapping edit serialize same-scope moves without blocking another scope', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const a = await store.load('overlap-a'), b = await store.load('overlap-b');
  a.setValue('rasxot:Oq', 0, 'before-clear', 1);
  const first = await backend.nextMove();
  const firstFlush = store.flush('overlap-a');
  const clearing = store.clear('overlap-a');
  a.setValue('rasxot:Oq', 0, 'after-clear', 1);
  const afterEdit = store.flush('overlap-a');
  b.setValue('rasxot:Oq', 0, 'other-scope', 1);
  const other = await backend.nextMove();
  assert.notEqual(other.originalUri, first.originalUri, 'another scope must progress while A is pending');
  await tick();
  assert.equal(backend.pendingMoves(), 0, 'same-scope edit must wait for the first move and clear');
  other.succeed();
  await store.flush('overlap-b');
  first.succeed();
  await firstFlush;
  await clearing;
  const second = await backend.nextMove();
  assert.equal(second.originalUri, first.originalUri);
  second.succeed();
  await afterEdit;
  const restarted = new draft.ReturnedPaintDraftStore(backend.storage());
  assert.equal((await restarted.load('overlap-a')).valuesFor('rasxot:Oq', 1)[0], 'after-clear');
  assert.equal((await restarted.load('overlap-b')).valuesFor('rasxot:Oq', 1)[0], 'other-scope');
});

test('a failed move does not poison a queued or later same-scope edit', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('failure-recovery');
  current.setValue('rasxot:Oq', 0, 'fails', 1);
  const failed = store.flush('failure-recovery'), first = await backend.nextMove();
  current.setValue('rasxot:Oq', 0, 'queued-retry', 1);
  const retry = store.flush('failure-recovery');
  first.fail();
  await assert.rejects(failed, /move failed/);
  const second = await backend.nextMove();
  second.succeed();
  await retry;
  current.setValue('rasxot:Oq', 0, 'later', 1);
  const third = await backend.nextMove();
  third.succeed();
  await store.flush('failure-recovery');
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('failure-recovery')).valuesFor('rasxot:Oq', 1)[0], 'later');
});

test('separate file adapters serialize the same scope and recover after a failed move', async () => {
  const backend = createBackend(), firstAdapter = backend.storage(), secondAdapter = backend.storage();
  const first = firstAdapter.write('shared-scope', '{"value":1}'), firstMove = await backend.nextMove();
  const second = secondAdapter.write('shared-scope', '{"value":2}');
  await tick();
  assert.equal(backend.pendingMoves(), 0, 'separate adapters must not share a live temp file');
  firstMove.fail();
  await assert.rejects(first, /move failed/);
  const secondMove = await backend.nextMove();
  secondMove.succeed();
  await second;
  assert.equal(await firstAdapter.read('shared-scope'), '{"value":2}');
});

test('a failed write during clear rejects that clear but a queued edit still persists', async () => {
  const backend = createBackend(), store = new draft.ReturnedPaintDraftStore(backend.storage());
  const current = await store.load('failed-clear-overlap');
  current.setValue('rasxot:Oq', 0, 'fails', 1);
  const first = await backend.nextMove(), failed = store.flush('failed-clear-overlap');
  const clearing = store.clear('failed-clear-overlap');
  const failedWrite = assert.rejects(failed, /move failed/), failedClear = assert.rejects(clearing, /move failed/);
  current.setValue('rasxot:Oq', 0, 'survives', 1);
  const retried = store.flush('failed-clear-overlap');
  await tick();
  assert.equal(backend.pendingMoves(), 0);
  first.fail();
  await Promise.all([failedWrite, failedClear]);
  const next = await backend.nextMove();
  next.succeed();
  await retried;
  assert.equal((await new draft.ReturnedPaintDraftStore(backend.storage()).load('failed-clear-overlap')).valuesFor('rasxot:Oq', 1)[0], 'survives');
});

test('separate adapters order write, remove and later write for the same scope', async () => {
  const backend = createBackend(), a = backend.storage(), b = backend.storage();
  const first = a.write('ordered-scope', '{"value":1}'), firstMove = await backend.nextMove();
  const removal = b.remove('ordered-scope');
  const later = a.write('ordered-scope', '{"value":2}');
  await tick();
  assert.equal(backend.pendingMoves(), 0);
  firstMove.succeed();
  await first;
  await removal;
  const secondMove = await backend.nextMove();
  secondMove.succeed();
  await later;
  assert.equal(await b.read('ordered-scope'), '{"value":2}');
  assert.equal(backend.files.has(`${secondMove.targetUri}.bak`), false, 'removed draft must not remain as a backup');
});

const account = (baseUrl, ref = 'same-ref', role = 'boyoqchi') => ({ baseUrl, token: 'test-token', profile: { ref, role } });

test('private draft keys normalize HTTPS server and separate account, role and request without exposing them in filenames', () => {
  const key = (server, ref = 'same-ref', role = 'boyoqchi', request = 'request-1') =>
    scopes.boyoqchiDraftKey(scopes.boyoqchiDraftAccount(account(server, ref, role)), request);
  assert.equal(key('https://ALPHA.invalid:443/'), key('https://alpha.invalid'));
  assert.notEqual(key('https://alpha.invalid'), key('https://beta.invalid'));
  assert.notEqual(key('https://alpha.invalid'), key('https://alpha.invalid', 'different-ref'));
  assert.notEqual(key('https://alpha.invalid'), key('https://alpha.invalid', 'same-ref', 'other-role'));
  assert.notEqual(key('https://alpha.invalid'), key('https://alpha.invalid', 'same-ref', 'boyoqchi', 'request-2'));
  assert.notEqual(key('https://alpha.invalid', 'a:b', 'boyoqchi', 'c'), key('https://alpha.invalid', 'a', 'boyoqchi', 'b:c'));
  for (const bad of ['http://alpha.invalid', 'https://user:pass@alpha.invalid', 'https://alpha.invalid/path', 'https://alpha.invalid?x=1']) {
    assert.throws(() => key(bad), /Invalid draft account scope/);
  }
  assert.throws(() => key('https://alpha.invalid', ''), /Invalid draft account scope/);
  assert.throws(() => key('https://alpha.invalid', 'same-ref', ''), /Invalid draft account scope/);
  assert.throws(() => key('https://alpha.invalid', 'same-ref', 'boyoqchi', '   '), /Invalid draft request scope/);
});

test('two placeholder servers with the same actor and request cannot read, change or clear each other', async () => {
  const backend = createBackend(), a = account('https://alpha.invalid'), b = account('https://beta.invalid');
  backend.activate(a);
  const storeA = backend.sessionStore(a), draftA = await storeA.load('same-request');
  draftA.setValue('rasxot:Oq', 0, 'server-a', 1);
  const imageA = { image_id: 'image-a', image_name: 'a.png', image_mime: 'image/png', image_size_bytes: 1, image_url: '/a' };
  draftA.setImage(imageA);
  const first = await backend.nextMove(); first.succeed();
  const imageMove = await backend.nextMove(); imageMove.succeed(); await storeA.flush('same-request');
  backend.activate(b);
  const storeB = backend.sessionStore(b), draftB = await storeB.load('same-request');
  assert.equal(draftB.valuesFor('rasxot:Oq', 1)[0], '');
  assert.equal(draftB.image, null);
  draftB.setValue('rasxot:Oq', 0, 'server-b', 1);
  const second = await backend.nextMove();
  assert.notEqual(first.targetUri, second.targetUri);
  second.succeed(); await storeB.flush('same-request');
  await storeB.clear('same-request');
  assert.equal(backend.files.has(first.targetUri), true);
  assert.equal(backend.files.has(second.targetUri), false);
  await assert.rejects(storeA.load('same-request'), /Sessiya tugagan/);
  await assert.rejects(storeA.clear('same-request'), /Sessiya tugagan/);
  const reauthenticatedA = account('https://ALPHA.invalid:443/');
  backend.activate(reauthenticatedA);
  const restoredA = await backend.sessionStore(reauthenticatedA).load('same-request');
  assert.equal(restoredA.valuesFor('rasxot:Oq', 1)[0], 'server-a');
  assert.deepEqual(restoredA.image, imageA);
  assert.ok([...backend.files.keys()].every(name => /\/[0-9a-f]{64}\.json(?:\.bak|\.tmp)?$/.test(name)));
  assert.ok([...backend.files.keys()].every(name => !/alpha|beta|same-ref|same-request/.test(name)));
});

test('late old-server move and stale callbacks cannot affect the new server draft', async () => {
  const backend = createBackend(), a = account('https://alpha.invalid'), b = account('https://beta.invalid');
  backend.activate(a);
  const storeA = backend.sessionStore(a), draftA = await storeA.load('same-request');
  draftA.setValue('rasxot:Oq', 0, 'old-pending', 1);
  const pendingA = storeA.flush('same-request'), oldMove = await backend.nextMove();
  backend.activate(b);
  const storeB = backend.sessionStore(b), draftB = await storeB.load('same-request');
  draftB.setValue('rasxot:Oq', 0, 'new-current', 1);
  const newMove = await backend.nextMove();
  newMove.succeed(); await storeB.flush('same-request');
  oldMove.succeed();
  await assert.rejects(pendingA, /Sessiya tugagan/);
  draftA.setValue('rasxot:Oq', 0, 'stale-edit', 1);
  await assert.rejects(storeA.clear('same-request'), /Sessiya tugagan/);
  assert.equal((await storeB.load('same-request')).valuesFor('rasxot:Oq', 1)[0], 'new-current');
  const bRestart = account('https://beta.invalid'); backend.activate(bRestart);
  assert.equal((await backend.sessionStore(bRestart).load('same-request')).valuesFor('rasxot:Oq', 1)[0], 'new-current');
});

test('legacy actor/request-only files are neither read, copied nor removed by the new account scope', async () => {
  const backend = createBackend(), a = account('https://alpha.invalid');
  const legacy = 'boyoqchi:same-ref:same-request', hash = crypto.createHash('sha256').update(legacy).digest('hex');
  const legacyUri = `file:///documents/boyoqchi-returned-paint-v1/${hash}.json`, content = '{"values":{"rasxot:Oq":["legacy"]}}';
  backend.files.set(legacyUri, content); backend.files.set(`${legacyUri}.bak`, content);
  backend.activate(a);
  const store = backend.sessionStore(a), current = await store.load('same-request');
  assert.equal(current.valuesFor('rasxot:Oq', 1)[0], '');
  current.setValue('rasxot:Oq', 0, 'new', 1);
  const move = await backend.nextMove(); move.succeed(); await store.flush('same-request');
  await store.clear('same-request');
  assert.equal(backend.files.get(legacyUri), content);
  assert.equal(backend.files.get(`${legacyUri}.bak`), content);
});

test('a session identity change invalidates cached stores and isolates the next account', async () => {
  const backend = createBackend(), session = account('https://alpha.invalid');
  backend.activate(session);
  const before = backend.sessionStore(session), saved = await before.load('request');
  saved.setValue('rasxot:Oq', 0, 'first-account', 1);
  const move = await backend.nextMove(); move.succeed(); await before.flush('request');
  session.profile.ref = 'other-ref';
  assert.equal(before.isCurrent(), false);
  await assert.rejects(before.load('request'), /Sessiya tugagan/);
  const after = backend.sessionStore(session);
  assert.notEqual(after, before);
  assert.equal((await after.load('request')).valuesFor('rasxot:Oq', 1)[0], '');
});

test('reauthentication of the same account serializes a late old write before the new edit', async () => {
  const backend = createBackend(), oldSession = account('https://alpha.invalid');
  backend.activate(oldSession);
  const oldStore = backend.sessionStore(oldSession), oldDraft = await oldStore.load('request');
  oldDraft.setValue('rasxot:Oq', 0, 'old', 1);
  const oldPending = oldStore.flush('request'), oldMove = await backend.nextMove();
  const nextSession = account('https://alpha.invalid'); backend.activate(nextSession);
  const nextStore = backend.sessionStore(nextSession), nextDraft = await nextStore.load('request');
  nextDraft.setValue('rasxot:Oq', 0, 'new', 1);
  const nextPending = nextStore.flush('request');
  await tick();
  assert.equal(backend.pendingMoves(), 0, 'same account must wait for the prior native move');
  oldMove.succeed();
  await assert.rejects(oldPending, /Sessiya tugagan/);
  const nextMove = await backend.nextMove(); nextMove.succeed(); await nextPending;
  const restart = account('https://alpha.invalid'); backend.activate(restart);
  assert.equal((await backend.sessionStore(restart).load('request')).valuesFor('rasxot:Oq', 1)[0], 'new');
});

test('a delayed read from the prior login rejects after the active server changes', async () => {
  const backend = createBackend(), firstLogin = account('https://alpha.invalid');
  backend.activate(firstLogin);
  const original = backend.sessionStore(firstLogin), draftA = await original.load('request');
  draftA.setImage({ image_id: 'only-a', image_name: 'a.png', image_mime: 'image/png', image_size_bytes: 1, image_url: '/a' });
  const save = await backend.nextMove(); save.succeed(); await original.flush('request');
  const secondLogin = account('https://alpha.invalid'); backend.activate(secondLogin);
  backend.pauseNextRead();
  const pending = backend.sessionStore(secondLogin).load('request'), read = await backend.nextRead();
  const otherServer = account('https://beta.invalid'); backend.activate(otherServer);
  read.resume();
  await assert.rejects(pending, /Sessiya tugagan/);
  assert.equal((await backend.sessionStore(otherServer).load('request')).image, null);
});

test('failed-login rollback with the same session object invalidates the prior draft store', async () => {
  const backend = createBackend(), session = account('https://alpha.invalid');
  backend.activate(session);
  const stale = backend.sessionStore(session), draft = await stale.load('request');
  draft.setValue('rasxot:Oq', 0, 'saved', 1);
  const move = await backend.nextMove(); move.succeed(); await stale.flush('request');
  backend.advanceEpoch(); // Login starts, fails, and auth restores this exact session object.
  backend.activate(session);
  assert.equal(stale.isCurrent(), false);
  await assert.rejects(stale.load('request'), /Sessiya tugagan/);
  await assert.rejects(stale.clear('request'), /Sessiya tugagan/);
  const current = backend.sessionStore(session);
  assert.notEqual(current, stale);
  assert.equal((await current.load('request')).valuesFor('rasxot:Oq', 1)[0], 'saved');
});

test('same-object capability and assignment changes invalidate old stores without poisoning a new scope', async () => {
  const backend = createBackend(), session = account('https://alpha.invalid');
  session.capabilities = ['paint.read']; session.assigned_apparatus = ['apparatus-a'];
  backend.activate(session);
  const before = backend.sessionStore(session), initial = await before.load('request');
  initial.setValue('rasxot:Oq', 0, 'saved', 1);
  const move = await backend.nextMove(); move.succeed(); await before.flush('request');
  session.capabilities.push('paint.write');
  assert.equal(before.isCurrent(), false);
  await assert.rejects(before.load('request'), /Sessiya tugagan/);
  const changed = backend.sessionStore(session);
  assert.notEqual(changed, before);
  assert.equal((await changed.load('request')).valuesFor('rasxot:Oq', 1)[0], 'saved');
  session.assigned_apparatus = ['apparatus-b'];
  assert.equal(changed.isCurrent(), false);
  await assert.rejects(changed.clear('request'), /Sessiya tugagan/);
  const next = backend.sessionStore(session);
  assert.notEqual(next, changed);
  assert.equal((await next.load('request')).valuesFor('rasxot:Oq', 1)[0], 'saved');
});
