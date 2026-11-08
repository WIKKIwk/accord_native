const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load() {
  const compile = (name, mocks = {}) => {
    const filename = path.resolve(__dirname, `../src/shared/${name}.ts`), loaded = new Module(filename, module);
    loaded.filename = filename; loaded.paths = module.paths;
    loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return loaded.exports;
  };
  return compile('assignmentWriteHold');
}
const { AssignmentWriteHold } = load(), a = 'a'.repeat(32), b = 'b'.repeat(32);
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
// Test-only evaluator. A production evaluator is deliberately not wired here.
const evaluate = check => {
  try {
    const value = check();
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) void Promise.resolve(value).catch(() => {});
    return value;
  } catch { return null; }
};
const evaluator = { isTrue: check => evaluate(check) === true, string: check => {
  const value = evaluate(check); return typeof value === 'string' && value.length ? value : null;
} };
class AtomicStore {
  marker = null;
  calls = [];
  async acquireIfAbsent(marker) { this.calls.push('acquire'); if (this.marker) return false; this.marker = { ...marker }; return true; }
  async read() { this.calls.push('read'); return this.marker && { ...this.marker }; }
  async releaseIfOwner(owner) { this.calls.push('release'); if (this.marker?.owner !== owner) return false; this.marker = null; return true; }
}
const gate = (store, owner = a, isCurrent = () => true, enabled = true) =>
  new AssignmentWriteHold({ enabled, store, createOwner: () => owner, isCurrent, scopeSnapshot: () => 'scope', evaluator });
const code = value => error => error.code === value;

test('default-off prototype performs no storage access at construction or acquisition', async () => {
  const store = new AtomicStore(), hold = new AssignmentWriteHold({ store, createOwner: () => a, isCurrent: () => true,
    scopeSnapshot: () => 'scope', evaluator });
  assert.deepEqual(store.calls, []); await assert.rejects(hold.acquire(), code('disabled')); assert.deepEqual(store.calls, []);
  gate(store); assert.deepEqual(store.calls, [], 'even an enabled instance must not write on construction');
});

test('reservation is persisted and read back before a single attempted send', async () => {
  const store = new AtomicStore(), lease = await gate(store).acquire();
  assert.deepEqual(store.calls, ['acquire', 'read']); assert.deepEqual(store.marker, { version: 1, owner: a });
  lease.beforeSend(); assert.throws(() => lease.beforeSend(), code('already_attempted'));
  await assert.rejects(lease.releaseIfUnsent(), code('already_attempted')); assert.deepEqual(store.calls, ['acquire', 'read']);
});

test('two instances sharing a simulated atomic store cannot acquire concurrently', async () => {
  const store = new AtomicStore(), one = gate(store, a), two = gate(store, b);
  const [left, right] = await Promise.allSettled([one.acquire(), two.acquire()]);
  assert.equal(left.status, 'fulfilled'); assert.equal(right.status, 'rejected'); assert.equal(right.reason.code, 'busy');
  assert.equal(store.marker.owner, a); await left.value.releaseIfUnsent(); assert.equal(store.marker, null);
});

test('a definitely unsent owner can release; a different owner cannot remove the marker', async () => {
  const store = new AtomicStore(), lease = await gate(store).acquire();
  store.marker = { version: 1, owner: b };
  await assert.rejects(lease.releaseIfUnsent(), code('ownership_uncertain')); assert.equal(store.marker.owner, b);
  assert.throws(() => lease.beforeSend(), code('already_attempted'));
  await assert.rejects(gate(store, a).acquire(), code('busy')); assert.equal(store.marker.owner, b);
});

test('an unsent cancellation releases only its owner and permits a later reservation', async () => {
  const store = new AtomicStore(), first = await gate(store).acquire(); await first.releaseIfUnsent();
  const second = await gate(store, b).acquire(); assert.equal(store.marker.owner, b); await second.releaseIfUnsent();
});

test('simulated crash before send and attempted 400 or success remain held across fresh instances', async () => {
  for (const event of ['crash-before-send', 'server-400', 'server-success', 'timeout']) {
    const store = new AtomicStore(), lease = await gate(store).acquire();
    if (event !== 'crash-before-send') lease.beforeSend();
    const FreshProcessHold = load().AssignmentWriteHold;
    const restarted = new FreshProcessHold({ enabled: true, store, createOwner: () => b, isCurrent: () => true,
      scopeSnapshot: () => 'scope', evaluator });
    await assert.rejects(restarted.acquire(), code('busy')); assert.equal(store.marker.owner, a);
    if (event !== 'crash-before-send') await assert.rejects(lease.releaseIfUnsent(), code('already_attempted'));
  }
});

test('uncertain acquire or read failure cannot authorize send or erase a possibly durable marker', async () => {
  for (const where of ['acquire-before', 'acquire-after', 'read']) {
    const store = new AtomicStore();
    if (where === 'acquire-before') store.acquireIfAbsent = async () => { throw Error('write failed'); };
    if (where === 'acquire-after') store.acquireIfAbsent = async marker => { store.marker = { ...marker }; throw Error('write uncertain'); };
    if (where === 'read') store.read = async () => { throw Error('read failed'); };
    await assert.rejects(gate(store).acquire(), code('storage_uncertain'));
    assert.equal(store.calls.includes('release'), false);
    if (where !== 'acquire-before') assert.equal(store.marker.owner, a);
  }
});

test('readback mismatch never grants a lease or clears a different owner', async () => {
  const store = new AtomicStore();
  store.read = async () => ({ version: 1, owner: b });
  await assert.rejects(gate(store).acquire(), code('ownership_uncertain'));
  assert.equal(store.marker.owner, a); assert.equal(store.calls.includes('release'), false);
});

test('non-boolean or missing storage acknowledgments do not count as durable ownership', async () => {
  const acquired = new AtomicStore();
  acquired.acquireIfAbsent = async marker => { acquired.marker = { ...marker }; return 'yes'; };
  await assert.rejects(gate(acquired).acquire(), code('storage_uncertain')); assert.equal(acquired.marker.owner, a);
  const missing = new AtomicStore(); missing.read = async () => null;
  await assert.rejects(gate(missing).acquire(), code('ownership_uncertain')); assert.equal(missing.marker.owner, a);
});

test('release failure or wrong owner keeps the lease blocked and cannot send', async () => {
  const store = new AtomicStore();
  store.releaseIfOwner = async () => { throw Error('delete failed'); };
  const lease = await gate(store).acquire();
  await assert.rejects(lease.releaseIfUnsent(), code('storage_uncertain'));
  assert.equal(store.marker.owner, a); assert.throws(() => lease.beforeSend(), code('already_attempted'));
});

test('uncertain delete after an unsent reservation never permits that lease to send', async () => {
  const store = new AtomicStore();
  store.releaseIfOwner = async () => { store.marker = null; throw Error('delete acknowledgment lost'); };
  const lease = await gate(store).acquire();
  await assert.rejects(lease.releaseIfUnsent(), code('storage_uncertain'));
  assert.throws(() => lease.beforeSend(), code('already_attempted'));
});

test('release and beforeSend race fails closed while conditional release is pending', async () => {
  const store = new AtomicStore(), delayed = deferred();
  store.releaseIfOwner = async owner => { await delayed.promise; if (store.marker?.owner !== owner) return false; store.marker = null; return true; };
  const lease = await gate(store).acquire();
  const releasing = lease.releaseIfUnsent(); assert.throws(() => lease.beforeSend(), code('already_attempted'));
  delayed.resolve(); await releasing; assert.equal(store.marker, null);
});

test('account switch before acquisition prevents storage access; after reservation it prevents send', async () => {
  const one = new AtomicStore(); await assert.rejects(gate(one, a, () => false).acquire(), code('not_current')); assert.deepEqual(one.calls, []);
  const two = new AtomicStore(); let current = true; const lease = await gate(two, a, () => current).acquire();
  current = false; assert.throws(() => lease.beforeSend(), code('not_current')); assert.equal(two.marker.owner, a);
  await assert.rejects(lease.releaseIfUnsent(), code('already_attempted')); assert.equal(two.marker.owner, a);
});

test('account switch while acquisition is pending conditionally releases only a definitely unsent owner', async () => {
  const store = new AtomicStore(), delayed = deferred(), original = store.acquireIfAbsent.bind(store); let current = true;
  store.acquireIfAbsent = async marker => { const acquired = await original(marker); await delayed.promise; return acquired; };
  const pending = gate(store, a, () => current).acquire(); await new Promise(resolve => setImmediate(resolve));
  current = false; delayed.resolve(); await assert.rejects(pending, code('not_current')); assert.equal(store.marker, null);
});

test('only a synchronous true guard authorizes acquisition; rejected promises are consumed', async () => {
  for (const make of [() => 1, () => 'yes', () => ({}), () => Promise.resolve(true), () => Promise.reject(Error('async guard rejected'))]) {
    const store = new AtomicStore();
    await assert.rejects(gate(store, a, make).acquire(), code('not_current'));
    assert.deepEqual(store.calls, []);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('async guard after acquisition or before send fails closed without unhandled rejection', async () => {
  const first = new AtomicStore(); let calls = 0;
  await assert.rejects(gate(first, a, () => ++calls <= 2 ? true : Promise.reject(Error('late guard'))).acquire(), code('not_current'));
  assert.equal(first.marker, null); assert.deepEqual(first.calls, ['acquire', 'read', 'release']);
  const second = new AtomicStore(); calls = 0;
  const lease = await gate(second, a, () => ++calls <= 3 ? true : Promise.reject(Error('send guard'))).acquire();
  assert.throws(() => lease.beforeSend(), code('not_current')); assert.equal(second.marker.owner, a);
  await assert.rejects(lease.releaseIfUnsent(), code('already_attempted')); assert.equal(second.marker.owner, a);
  await new Promise(resolve => setImmediate(resolve));
});

test('async or non-string owner and snapshot fail closed without regex coercion or unhandled rejection', async () => {
  for (const makeOwner of [() => Promise.resolve(a), () => Promise.reject(Error('owner rejected')), () => ({ toString: () => a }), () => 1]) {
    const store = new AtomicStore(), hold = new AssignmentWriteHold({ enabled: true, store, createOwner: makeOwner,
      isCurrent: () => true, scopeSnapshot: () => 'scope', evaluator });
    await assert.rejects(hold.acquire(), code('invalid_owner')); assert.deepEqual(store.calls, []);
  }
  for (const scopeSnapshot of [() => Promise.resolve('scope'), () => Promise.reject(Error('scope rejected')), () => 1, () => '']) {
    const store = new AtomicStore(), hold = new AssignmentWriteHold({ enabled: true, store, createOwner: () => a,
      isCurrent: () => true, scopeSnapshot, evaluator });
    await assert.rejects(hold.acquire(), code('not_current')); assert.deepEqual(store.calls, []);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('scope changes inside a true guard or owner callback fail closed before storage or send', async () => {
  const first = new AtomicStore(); let scope = 'one';
  const initial = new AssignmentWriteHold({ enabled: true, store: first, createOwner: () => a,
    isCurrent: () => { scope = 'two'; return true; }, scopeSnapshot: () => scope, evaluator });
  await assert.rejects(initial.acquire(), code('not_current')); assert.deepEqual(first.calls, []);

  const second = new AtomicStore(); scope = 'one';
  const ownerChangesScope = new AssignmentWriteHold({ enabled: true, store: second,
    createOwner: () => { scope = 'two'; return a; }, isCurrent: () => true, scopeSnapshot: () => scope, evaluator });
  await assert.rejects(ownerChangesScope.acquire(), code('not_current')); assert.deepEqual(second.calls, []);

  const third = new AtomicStore(); scope = 'one'; let tamper = false;
  const hold = new AssignmentWriteHold({ enabled: true, store: third, createOwner: () => a,
    isCurrent: () => { if (tamper) scope = 'two'; return true; }, scopeSnapshot: () => scope, evaluator });
  const lease = await hold.acquire(); tamper = true;
  assert.throws(() => lease.beforeSend(), code('not_current')); assert.equal(third.marker.owner, a);
  await assert.rejects(lease.releaseIfUnsent(), code('already_attempted')); assert.equal(third.marker.owner, a);
});

test('scope snapshots stay in memory and are never written to the marker', async () => {
  const store = new AtomicStore(), hold = new AssignmentWriteHold({ enabled: true, store, createOwner: () => a,
    isCurrent: () => true, scopeSnapshot: () => 'opaque-private-scope', evaluator });
  const lease = await hold.acquire();
  assert.deepEqual(store.marker, { version: 1, owner: a }); assert.doesNotMatch(JSON.stringify(store.marker), /opaque-private-scope/);
  await lease.releaseIfUnsent();
});

test('missing or itself-async evaluator fails closed and consumes rejected promises', async () => {
  const values = [undefined, { ...evaluator, string: () => Promise.reject(Error('bad evaluator string')) },
    { ...evaluator, isTrue: () => Promise.reject(Error('bad evaluator boolean')) }];
  for (const candidate of values) {
    const store = new AtomicStore(), hold = new AssignmentWriteHold({ enabled: true, store, createOwner: () => a,
      isCurrent: () => true, scopeSnapshot: () => 'scope', evaluator: candidate });
    await assert.rejects(hold.acquire(), code('not_current')); assert.deepEqual(store.calls, []);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('invalid owner IDs and missing storage never send or touch a store', async () => {
  const store = new AtomicStore(); await assert.rejects(gate(store, 'short').acquire(), code('invalid_owner'));
  assert.deepEqual(store.calls, []);
  const noStore = new AssignmentWriteHold({ enabled: true, createOwner: () => a, isCurrent: () => true,
    scopeSnapshot: () => 'scope', evaluator });
  await assert.rejects(noStore.acquire(), code('storage_uncertain'));
});


test('reentrant guard callbacks cannot allow either inner or outer send even if the inner error is swallowed', async () => {
  for (const trigger of ['scopeSnapshot', 'isCurrent', 'evaluator.string', 'evaluator.isTrue']) {
    const store = new AtomicStore(); let lease, armed = false, innerCompleted = false, attempts = 0;
    const reenter = () => {
      if (!armed) return;
      attempts++;
      try { lease.beforeSend(); innerCompleted = true; } catch (error) { assert.equal(error.code, 'already_attempted'); }
    };
    const chosenEvaluator = {
      string: check => { if (trigger === 'evaluator.string') reenter(); return evaluator.string(check); },
      isTrue: check => { if (trigger === 'evaluator.isTrue') reenter(); return evaluator.isTrue(check); },
    };
    const hold = new AssignmentWriteHold({ enabled: true, store, createOwner: () => a,
      scopeSnapshot: () => { if (trigger === 'scopeSnapshot') reenter(); return 'scope'; },
      isCurrent: () => { if (trigger === 'isCurrent') reenter(); return true; }, evaluator: chosenEvaluator });
    lease = await hold.acquire(); armed = true;
    assert.throws(() => lease.beforeSend(), code('already_attempted'), trigger);
    assert.equal(innerCompleted, false, trigger); assert.ok(attempts > 0, trigger);
    assert.throws(() => lease.beforeSend(), code('already_attempted'), trigger);
    await assert.rejects(lease.releaseIfUnsent(), code('already_attempted'));
    assert.equal(store.marker.owner, a); assert.deepEqual(store.calls, ['acquire', 'read']);
  }
});

test('reentrant release is rejected without deleting marker or unhandled rejection', async () => {
  for (const trigger of ['scopeSnapshot', 'isCurrent', 'evaluator.string', 'evaluator.isTrue']) {
    const store = new AtomicStore(); let lease, armed = false, release, attempts = 0;
    const reenter = () => {
      if (!armed) return;
      attempts++;
      // The first rejection is intentionally ignored, as a sync guard can do.
      // Keep another result to verify awaiting a rejected reentrant call still rejects.
      if (!release) { void lease.releaseIfUnsent(); void lease.releaseIfUnsent(); release = lease.releaseIfUnsent(); }
    };
    const chosenEvaluator = {
      string: check => { if (trigger === 'evaluator.string') reenter(); return evaluator.string(check); },
      isTrue: check => { if (trigger === 'evaluator.isTrue') reenter(); return evaluator.isTrue(check); },
    };
    const hold = new AssignmentWriteHold({ enabled: true, store, createOwner: () => a,
      scopeSnapshot: () => { if (trigger === 'scopeSnapshot') reenter(); return 'scope'; },
      isCurrent: () => { if (trigger === 'isCurrent') reenter(); return true; }, evaluator: chosenEvaluator });
    lease = await hold.acquire(); armed = true;
    assert.throws(() => lease.beforeSend(), code('already_attempted'), trigger);
    assert.ok(attempts > 0, trigger); await assert.rejects(release, code('already_attempted'));
    assert.throws(() => lease.beforeSend(), code('already_attempted'), trigger);
    await assert.rejects(lease.releaseIfUnsent(), code('already_attempted'));
    assert.equal(store.marker.owner, a); assert.deepEqual(store.calls, ['acquire', 'read']);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('false, throwing or rejected async send guards leave the marker blocked', async () => {
  for (const outcome of ['false', 'throw', 'async']) {
    const store = new AtomicStore(); let armed = false;
    const isCurrent = () => { if (!armed) return true; if (outcome === 'throw') throw Error('guard failed');
      if (outcome === 'async') return Promise.reject(Error('async guard failed')); return false; };
    const lease = await gate(store, a, isCurrent).acquire(); armed = true;
    assert.throws(() => lease.beforeSend(), code('not_current'));
    assert.throws(() => lease.beforeSend(), code('already_attempted'));
    await assert.rejects(lease.releaseIfUnsent(), code('already_attempted'));
    assert.equal(store.marker.owner, a); assert.deepEqual(store.calls, ['acquire', 'read']);
  }
  await new Promise(resolve => setImmediate(resolve));
});

function mutableInputs() {
  let liveCurrent = true, liveScope = 'scope';
  const storedEvaluator = { ...evaluator }, store = new AtomicStore(), decoyStore = new AtomicStore();
  const options = { enabled: true, store, createOwner: () => a,
    isCurrent: () => liveCurrent, scopeSnapshot: () => liveScope, evaluator: storedEvaluator };
  const invalidateAndReplace = kind => {
    if (kind === 'isCurrent') { liveCurrent = false; options.isCurrent = () => true; }
    if (kind === 'scopeSnapshot') { liveScope = 'other'; options.scopeSnapshot = () => 'scope'; }
    if (kind === 'evaluator.isTrue') { liveCurrent = false; storedEvaluator.isTrue = () => true; }
    if (kind === 'evaluator.string') { liveScope = 'other'; storedEvaluator.string = () => 'scope'; }
    if (kind === 'evaluator') { liveCurrent = false; options.evaluator = { isTrue: () => true, string: () => 'scope' }; }
    // Replacing the store property cannot redirect this in-flight acquisition or lease.
    options.store = decoyStore;
  };
  return { options, store, decoyStore, invalidateAndReplace };
}

for (const kind of ['isCurrent', 'scopeSnapshot', 'evaluator.isTrue', 'evaluator.string', 'evaluator']) {
  test(`pending acquisition retains original ${kind} callback while observing live state`, async () => {
    const state = mutableInputs(), delayed = deferred(), original = state.store.acquireIfAbsent.bind(state.store);
    state.store.acquireIfAbsent = async marker => { const result = await original(marker); await delayed.promise; return result; };
    const pending = new AssignmentWriteHold(state.options).acquire(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.store.marker.owner, a); state.invalidateAndReplace(kind); delayed.resolve();
    await assert.rejects(pending, code('not_current'));
    assert.equal(state.store.marker, null); assert.deepEqual(state.store.calls, ['acquire', 'read', 'release']);
    assert.deepEqual(state.decoyStore.calls, []);
  });

  test(`acquired lease retains original ${kind} callback while observing live state`, async () => {
    const state = mutableInputs(), lease = await new AssignmentWriteHold(state.options).acquire();
    state.invalidateAndReplace(kind); assert.throws(() => lease.beforeSend(), code('not_current'));
    await assert.rejects(lease.releaseIfUnsent(), code('already_attempted'));
    assert.equal(state.store.marker.owner, a); assert.deepEqual(state.store.calls, ['acquire', 'read']);
    assert.deepEqual(state.decoyStore.calls, []);
  });
}

test('store method replacements during a pending acquisition cannot spoof read or release', async () => {
  const store = new AtomicStore(), delayed = deferred(), originalAcquire = store.acquireIfAbsent.bind(store);
  let replacementsCalled = 0;
  store.acquireIfAbsent = async marker => { const result = await originalAcquire(marker); await delayed.promise; return result; };
  const pending = gate(store).acquire(); await new Promise(resolve => setImmediate(resolve));
  store.read = async () => { replacementsCalled++; return { version: 1, owner: b }; };
  store.releaseIfOwner = async () => { replacementsCalled++; return true; };
  delayed.resolve(); const lease = await pending; await lease.releaseIfUnsent();
  assert.equal(replacementsCalled, 0); assert.equal(store.marker, null); assert.deepEqual(store.calls, ['acquire', 'read', 'release']);
});

test('store method replacement after lease cannot fake release, while live store state is still observed', async () => {
  const store = new AtomicStore(), lease = await gate(store).acquire(); let replacementCalled = false;
  store.releaseIfOwner = async () => { replacementCalled = true; return true; };
  store.marker = { version: 1, owner: b };
  await assert.rejects(lease.releaseIfUnsent(), code('ownership_uncertain'));
  assert.equal(replacementCalled, false); assert.equal(store.marker.owner, b);
  assert.deepEqual(store.calls, ['acquire', 'read', 'release']);
});
