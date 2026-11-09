// V2 detail FutureBuilder, retry and refresh behavior; mocked reads only, no device or backend.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/rezka/rezkaPaddonDetailController.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { RezkaPaddonDetailController } = mod.exports;
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function make(options = {}) {
  let current = true, created = 0, owner; const calls = [];
  const controller = new RezkaPaddonDetailController({ isCurrent: () => current,
    createOwner: () => { created++; owner = { closed: false, listeners: new Set(), close() {
      if (this.closed) return; this.closed = true; for (const listener of [...this.listeners]) listener(); } }; return owner; },
    ownerCurrent: value => !value.closed, subscribeOwner: (value, listener) => { value.listeners.add(listener); return () => value.listeners.delete(listener); },
    load: (value, control) => { calls.push({ owner: value, control }); return options.load ? options.load(value, control, calls.length)
      : Promise.resolve({ owner: value, id: calls.length }); },
    accept: value => !!value && value.owner === owner && !owner.closed });
  return { c: controller, calls, owner: () => owner, created: () => created, lose: () => { current = false; } };
}
test('initial load uses one owner and repeated starts share the same read', async () => {
  const h = make(); assert.equal(h.c.getSnapshot().phase, 'loading');
  await h.c.start(); assert.equal(h.created(), 0); h.c.resume();
  const first = h.c.start(), second = h.c.start(); assert.equal(first, second); await first;
  assert.equal(h.created(), 1); assert.equal(h.calls.length, 1); assert.equal(h.c.getSnapshot().phase, 'ready');
  assert.equal(h.c.getSnapshot().binding.owner, h.owner()); h.c.dispose(); assert.equal(h.owner().closed, true);
});
test('failed load exposes an error and a real retry runs a fresh read', async () => {
  const h = make({ load: async (owner, _control, count) => { if (count === 1) throw Error('offline'); return { owner, id: count }; } });
  h.c.resume(); await h.c.start(); assert.deepEqual(h.c.getSnapshot(), { phase: 'error', binding: null, refreshing: false });
  await h.c.refresh(); assert.equal(h.calls.length, 2); assert.equal(h.c.getSnapshot().binding.id, 2); h.c.dispose();
});
test('refresh retains old content while pending and only the newest generation can publish', async () => {
  const slow = deferred(), fast = deferred();
  const h = make({ load: (owner, _control, count) => count === 1 ? Promise.resolve({ owner, id: 'initial' }) : count === 2 ? slow.promise : fast.promise });
  h.c.resume(); await h.c.start(); const old = h.c.refresh(); await tick();
  assert.equal(h.c.getSnapshot().refreshing, true); assert.equal(h.c.getSnapshot().binding.id, 'initial');
  const latest = h.c.refresh(); await tick(); fast.resolve({ owner: h.owner(), id: 'new' }); await latest;
  slow.resolve({ owner: h.owner(), id: 'old' }); await old;
  assert.equal(h.c.getSnapshot().binding.id, 'new'); assert.equal(h.c.getSnapshot().refreshing, false); h.c.dispose();
});
test('a failed refresh shows error without retaining stale content', async () => {
  const slow = deferred(); const h = make({ load: (owner, _control, count) => count === 1 ? Promise.resolve({ owner, id: 'initial' }) : slow.promise });
  h.c.resume(); await h.c.start(); const refresh = h.c.refresh(); await tick(); assert.equal(h.c.getSnapshot().binding.id, 'initial');
  slow.reject(Error('offline')); await refresh; assert.deepEqual(h.c.getSnapshot(), { phase: 'error', binding: null, refreshing: false }); h.c.dispose();
});
test('effect replay pauses the second read and resumes the same attempt and owner', async () => {
  const catalog = deferred(); let detailCalls = 0;
  const h = make({ load: async (owner, control) => { await catalog.promise; await control.waitForSend();
    assert.equal(control.canSend(), true); detailCalls++; return { owner, id: 'ready' }; } });
  h.c.resume(); const pending = h.c.start(); await tick(); h.c.suspend(); catalog.resolve(); await tick();
  assert.equal(detailCalls, 0); assert.equal(h.c.getSnapshot().phase, 'loading'); h.c.resume(); assert.equal(h.c.start(), pending);
  await pending; assert.equal(h.created(), 1); assert.equal(h.calls.length, 1); assert.equal(detailCalls, 1); h.c.dispose();
});
test('unmount during the catalog read closes the owner and never sends detail', async () => {
  const catalog = deferred(); let detailCalls = 0;
  const h = make({ load: async (owner, control) => { await catalog.promise; await control.waitForSend();
    if (control.canSend()) detailCalls++; return { owner, id: 'old' }; } });
  h.c.resume(); const pending = h.c.start(); await tick(); h.c.suspend(); h.c.dispose(); catalog.resolve(); await pending;
  assert.equal(detailCalls, 0); assert.equal(h.c.getSnapshot().phase, 'invalid'); assert.equal(h.owner().closed, true);
  h.c.resume(); await h.c.start(); assert.equal(h.calls.length, 1);
});
test('a suspended completion is published only on a valid resume', async () => {
  for (const invalid of [false, true]) {
    const result = deferred(), h = make({ load: () => result.promise }); h.c.resume(); const pending = h.c.start(); await tick(); h.c.suspend();
    if (invalid) h.lose(); result.resolve({ owner: h.owner(), id: 'result' }); await pending;
    assert.equal(h.c.getSnapshot().phase, invalid ? 'invalid' : 'loading'); h.c.resume();
    assert.equal(h.c.getSnapshot().phase, invalid ? 'invalid' : 'ready'); h.c.dispose();
  }
});
test('reentrant refresh supersedes a queued older attempt before its first read', async () => {
  const h = make(); let refreshed = false;
  h.c.subscribe(() => { if (!refreshed && h.c.getSnapshot().phase === 'loading') { refreshed = true; void h.c.refresh(); } });
  h.c.resume(); await h.c.start(); await tick(); assert.equal(h.calls.length, 1); assert.equal(h.c.getSnapshot().phase, 'ready'); h.c.dispose();
});
test('owner reset redacts, isolates subscribers and blocks reentrant retry', async () => {
  const h = make(), observed = []; h.c.subscribe(() => { throw Error('listener'); });
  h.c.subscribe(async () => { throw Error('late listener'); });
  h.c.subscribe(() => { observed.push(h.c.getSnapshot().phase); if (h.c.getSnapshot().phase === 'invalid') void h.c.refresh(); });
  h.c.resume(); await h.c.start(); h.owner().close(); await tick();
  assert.equal(h.c.getSnapshot().phase, 'invalid'); assert.equal(observed.at(-1), 'invalid'); assert.equal(h.calls.length, 1); h.c.dispose();
});
test('scope lost before a scheduled load or an invalid binding cannot publish content', async () => {
  const h = make(); h.c.resume(); const pending = h.c.start(); h.lose(); await pending;
  assert.equal(h.calls.length, 0); assert.equal(h.c.getSnapshot().phase, 'invalid'); h.c.dispose();
  const foreign = make({ load: async () => ({ owner: {}, id: 'wrong' }) }); foreign.c.resume(); await foreign.c.start();
  assert.equal(foreign.c.getSnapshot().phase, 'error'); assert.equal(foreign.c.getSnapshot().binding, null); foreign.c.dispose();
});
test('throwing or accidentally asynchronous dependencies fail closed without leaking rejections', async () => {
  for (const kind of ['session', 'owner', 'create', 'subscribe', 'accept']) {
    let loads = 0; const owner = { closed: false, close() { this.closed = true; } };
    const fail = async () => { throw Error('late dependency'); };
    const c = new RezkaPaddonDetailController({ isCurrent: kind === 'session' ? fail : () => true,
      createOwner: kind === 'create' ? fail : () => owner, ownerCurrent: kind === 'owner' ? fail : value => !value.closed,
      subscribeOwner: kind === 'subscribe' ? fail : () => () => {},
      load: async value => { loads++; return { owner: value }; }, accept: kind === 'accept' ? fail : () => true });
    c.resume(); await c.start(); await tick();
    assert.equal(c.getSnapshot().phase, kind === 'accept' ? 'error' : 'invalid', kind);
    assert.equal(loads, kind === 'accept' ? 1 : 0, kind); c.dispose();
  }
});
test('a reentrant owner subscription retires and cleans up without starting a read', async () => {
  let unwatch = 0, loads = 0; const owner = { closed: false, close() { this.closed = true; } };
  const c = new RezkaPaddonDetailController({ isCurrent: () => true, createOwner: () => owner, ownerCurrent: () => true,
    subscribeOwner: (_owner, listener) => { listener(); return () => { unwatch++; }; },
    load: async () => { loads++; return {}; }, accept: () => true });
  c.resume(); await c.start(); assert.equal(c.getSnapshot().phase, 'invalid'); assert.equal(owner.closed, true);
  assert.equal(unwatch, 1); assert.equal(loads, 0); c.dispose();
});
