const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const { QolipPlacementGate } = load('qolip/qolipPlacementGate.ts', { './qolipApiCommon': common });
const ORIGIN = 'https://example.test', OWNER_A = 'a'.repeat(64), OWNER_B = 'b'.repeat(64);
const TARGET = { block: 'A blok', warehouse: 'W', rowLetter: 'A', columnNumber: 1 };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function memoryBackend(initial = null) {
  let raw = initial, queue = Promise.resolve(), failNext = false;
  return { wrapper: () => ({ transact(update) {
    const run = queue.then(async () => {
      const result = update(raw); await Promise.resolve();
      if (failNext) { failNext = false; throw new Error('journal unavailable'); }
      if ('next' in result) raw = result.next;
      return result.value;
    });
    queue = run.then(() => {}, () => {}); return run;
  } }), get raw() { return raw; }, fail() { failNext = true; } };
}
function lease(owner = OWNER_A, generation = 'generation-1') {
  let current = generation, active = true;
  const token = { ownerScopeKey: owner, generation, currentGeneration: () => current, isCurrent: () => active };
  return { token, change: value => { current = value; }, deactivate: () => { active = false; } };
}
const body = (code, target = TARGET) => JSON.stringify({ block: target.block.trim(), warehouse: target.warehouse.trim(),
  item_code: `ITEM-${code.trim()}`, item_name: 'Item', qolip_code: code.trim(), size: 40, quantity: 1,
  ...(target.rowLetter.trim() ? { row_letter: target.rowLetter.trim() } : {}), column_number: target.columnNumber });
const input = (token, codes = ['Q-1'], origin = ORIGIN) => ({ origin, actions: codes.map(code => ({ code, body: body(code) })), target: TARGET, lease: token });
const settled = result => ({ readAfterVerifiedSettlement: async () => result });

test('two wrappers over one simulated atomic backend serialize reservation before any send', async () => {
  const db = memoryBackend(), a = new QolipPlacementGate(db.wrapper()), b = new QolipPlacementGate(db.wrapper()), l = lease();
  const outcomes = await Promise.all([a.reserve(input(l.token)), b.reserve(input(l.token, ['Q-2']))]);
  assert.deepEqual(outcomes.map(value => value.kind).sort(), ['reconcile_required', 'reserved']);
  const reservation = outcomes.find(value => value.kind === 'reserved').reservation;
  assert.equal((await a.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'waiting');
  await reservation.close(); assert.deepEqual(await b.inspect({ origin: ORIGIN, lease: l.token }), { kind: 'clear' });
});

test('actual send permit exists only after durable intent, binds one item, and a stale permit cannot send the next', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q-1', 'Q-2']));
  const first = await reservation.markSending(0); assert.equal(typeof first.beforeSend, 'function');
  assert.deepEqual(first.request, { origin: ORIGIN, method: 'POST', path: '/v1/mobile/qolip/locations', body: body('Q-1') });
  assert.equal(Object.isFrozen(first.request), true);
  assert.equal(JSON.parse(db.raw).origins[0].pending.items[0].status, 'uncertain'); first.beforeSend();
  assert.throws(first.beforeSend, /already sent/, 'including a transport retry after a 401');
  await assert.rejects(reservation.markSending(1), /already sending/); await assert.rejects(reservation.close(), /still sending/);
  await reservation.markOutcome(0, true); assert.throws(first.beforeSend, /not journaled/);
  const second = await reservation.markSending(1); second.beforeSend(); assert.throws(first.beforeSend, /not journaled/);
  await reservation.markOutcome(1, false); await reservation.close();
  const pending = (await gate.inspect({ origin: ORIGIN, lease: l.token })).pending;
  assert.deepEqual(pending.items.map(item => item.status), ['confirmed', 'uncertain']); assert.equal(pending.closed, true);
  assert.deepEqual(await gate.reserve(input(l.token)), { kind: 'reconcile_required' });
});

test('another account or server alias sees only an opaque hold and never passes prior account data to its authority', async () => {
  const db = memoryBackend(), one = new QolipPlacementGate(db.wrapper()), two = new QolipPlacementGate(db.wrapper());
  const old = lease(OWNER_A), other = lease(OWNER_B);
  const { reservation } = await one.reserve(input(old.token, ['SECRET-CODE'])); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await reservation.close();
  for (const [token, origin] of [[other.token, ORIGIN], [old.token, 'https://alias.example.test']]) {
    let calls = 0; const authority = { readAfterVerifiedSettlement: async () => { calls++; return { kind: 'not_applied' }; } };
    assert.deepEqual(await two.inspect({ origin, lease: token }), { kind: 'reconcile_required' });
    assert.deepEqual(await two.reconcile({ origin, lease: token, authority }), { kind: 'reconcile_required' });
    assert.deepEqual(await two.reserve(input(token, ['OTHER'], origin)), { kind: 'reconcile_required' }); assert.equal(calls, 0);
  }
  assert.equal((await one.inspect({ origin: ORIGIN, lease: old.token })).pending.items[0].code, 'SECRET-CODE');
});

test('unknown or applied outcomes remain blocked; only independently verified not-applied plus a fresh read releases', async () => {
  const db = memoryBackend(), first = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await first.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await reservation.close();
  // New wrapper simulates a new app instance reading the same durable journal.
  const restarted = new QolipPlacementGate(db.wrapper());
  for (const [evidence, expected] of [[{ kind: 'unknown' }, 'unknown'], [{ kind: 'applied' }, 'applied_review_required']]) {
    assert.deepEqual(await restarted.reconcile({ origin: ORIGIN, lease: l.token, authority: settled(evidence) }), { kind: expected });
    assert.deepEqual(await restarted.reserve(input(l.token)), { kind: 'reconcile_required' });
  }
  let observed;
  const proof = { readAfterVerifiedSettlement: async pending => { observed = pending; return { kind: 'not_applied' }; } };
  assert.deepEqual(await restarted.reconcile({ origin: ORIGIN, lease: l.token, authority: proof }), { kind: 'reconciled' });
  assert.equal(observed.items[0].status, 'uncertain'); assert.equal((await restarted.reserve(input(l.token))).kind, 'reserved');
});

test('an unclosed operation stays in flight after restart; ordinary refresh is not accepted as settlement proof', async () => {
  const db = memoryBackend(), original = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await original.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
  const restarted = new QolipPlacementGate(db.wrapper()); let calls = 0;
  assert.deepEqual(await restarted.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: async () => {
    calls++; return { kind: 'not_applied' }; } } }), { kind: 'in_flight' }); assert.equal(calls, 0);
  await reservation.markOutcome(0, false); await reservation.close();
  assert.deepEqual(await restarted.reconcile({ origin: ORIGIN, lease: l.token, authority: settled({ kind: 'unknown' }) }), { kind: 'unknown' });
});

test('an auth transition during settlement or refresh cannot clear the hold or publish old account data', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), old = lease(OWNER_A), next = lease(OWNER_B);
  const { reservation } = await gate.reserve(input(old.token)); const send = await reservation.markSending(0); send.beforeSend();
  old.change('generation-2'); assert.throws(send.beforeSend, /session changed/); await reservation.markOutcome(0, true); await reservation.close();
  assert.deepEqual(await gate.inspect({ origin: ORIGIN, lease: old.token }), { kind: 'session_changed' });
  assert.deepEqual(await gate.inspect({ origin: ORIGIN, lease: next.token }), { kind: 'reconcile_required' });
  const returning = lease(OWNER_A, 'generation-3'); const proof = deferred();
  const pending = gate.reconcile({ origin: ORIGIN, lease: returning.token, authority: { readAfterVerifiedSettlement: () => proof.promise } });
  await new Promise(resolve => setImmediate(resolve)); returning.change('generation-4'); proof.resolve({ kind: 'not_applied' });
  assert.deepEqual(await pending, { kind: 'session_changed' });
  assert.equal((await gate.inspect({ origin: ORIGIN, lease: lease(OWNER_A, 'generation-5').token })).pending.items[0].status, 'uncertain');
});

test('stale inspection and pre-authority snapshots do not cross an asynchronous session switch', async () => {
  const db = memoryBackend(), main = new QolipPlacementGate(db.wrapper()), owner = lease();
  const { reservation } = await main.reserve(input(owner.token)); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await reservation.close();
  const wait = deferred(), wrapped = db.wrapper(), delayed = { async transact(callback) { const value = await wrapped.transact(callback); await wait.promise; return value; } };
  const gate = new QolipPlacementGate(delayed); let authorityCalls = 0;
  const read = gate.inspect({ origin: ORIGIN, lease: owner.token });
  const reconcile = gate.reconcile({ origin: ORIGIN, lease: owner.token, authority: { readAfterVerifiedSettlement: async () => {
    authorityCalls++; return { kind: 'not_applied' }; } } });
  await new Promise(resolve => setImmediate(resolve)); owner.change('changed'); wait.resolve();
  assert.deepEqual(await read, { kind: 'session_changed' }); assert.deepEqual(await reconcile, { kind: 'session_changed' }); assert.equal(authorityCalls, 0);
});

test('session checks require synchronous true and verify generation again after a reentrant callback', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), failures = [], listener = reason => failures.push(reason);
  process.on('unhandledRejection', listener);
  try {
    for (const answer of ['true', 1, Promise.resolve(true), Promise.reject(new Error('async denied'))]) {
      const l = lease(); l.token.isCurrent = () => answer;
      assert.deepEqual(await gate.reserve(input(l.token)), { kind: 'session_changed' });
    }
    const l = lease(); l.token.currentGeneration = () => Promise.reject(new Error('async generation'));
    assert.deepEqual(await gate.reserve(input(l.token)), { kind: 'session_changed' });
    const changing = lease(); changing.token.isCurrent = () => { changing.change('different'); return true; };
    assert.deepEqual(await gate.reserve(input(changing.token)), { kind: 'session_changed' });
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(failures, []); assert.equal(db.raw, null);
  } finally { process.off('unhandledRejection', listener); }
});

test('ASCII duplicates and any non-ASCII or malformed code fail before journaling', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  for (const code of ['İ', 'ΟΣ', '\u00a0Q1', 'Q\t1', ' ']) {
    assert.deepEqual(await gate.reserve(input(l.token, [code])), { kind: 'unsupported_code' }, JSON.stringify(code));
  }
  assert.deepEqual(await gate.reserve(input(l.token, [' Q1 ', 'q1'])), { kind: 'duplicate_code' });
  assert.equal(db.raw, null); assert.equal((await gate.reserve(input(l.token, [' A-Z/09_! ']))).kind, 'reserved');
});

test('Dart SDK whitespace set matches trimDart, including U+0085 and U+FEFF', () => {
  // Enumerated independently by the selected Flutter SDK Dart 3.13.7 runtime.
  const codepoints = [0x9,0xa,0xb,0xc,0xd,0x20,0x85,0xa0,0x1680,0x2000,0x2001,0x2002,0x2003,0x2004,0x2005,0x2006,
    0x2007,0x2008,0x2009,0x200a,0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff];
  for (const codepoint of codepoints) { const value = String.fromCodePoint(codepoint); assert.equal(common.trimDart(`${value}X${value}`), 'X'); }
  for (const codepoint of [0, 8, 14, 0x180e, 0x200b, 0x2060]) { const value = String.fromCodePoint(codepoint); assert.equal(common.trimDart(`${value}X${value}`), `${value}X${value}`); }
});

test('journal failures and corrupt data fail closed, and no default provider exists', async () => {
  assert.throws(() => new QolipPlacementGate(), /Atomic durable/);
  const broken = memoryBackend('broken-json'), invalid = new QolipPlacementGate(broken.wrapper()), l = lease();
  await assert.rejects(invalid.reserve(input(l.token)), /journal is corrupt/);
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()); db.fail();
  await assert.rejects(gate.reserve(input(l.token)), /journal unavailable/); assert.equal(db.raw, null);
  await assert.rejects(gate.reserve({ origin: ORIGIN, actions: [{ code: 'Q', body: body('Q') }], target: TARGET }), /session lease/);
});

test('no response is marked successful unless its own before-send permit was invoked', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token)); await reservation.markSending(0);
  await assert.rejects(reservation.markOutcome(0, true), /was not sent/); await reservation.close();
  assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'uncertain');
});

test('a confirmed success cannot be cleared by contradictory not-applied evidence', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, true); await reservation.close();
  assert.deepEqual(await gate.reconcile({ origin: ORIGIN, lease: l.token, authority: settled({ kind: 'not_applied' }) }),
    { kind: 'applied_review_required' });
  assert.deepEqual(await gate.reserve(input(l.token)), { kind: 'reconcile_required' });
});

test('a stale concurrent reconciliation cannot remove a newer reservation', async () => {
  const db = memoryBackend(), first = new QolipPlacementGate(db.wrapper()), second = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await first.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await reservation.close();
  const slow = deferred(), fast = deferred();
  const a = first.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: () => fast.promise } });
  const b = second.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: () => slow.promise } });
  await new Promise(resolve => setImmediate(resolve)); fast.resolve({ kind: 'not_applied' });
  assert.deepEqual(await a, { kind: 'reconciled' }); const fresh = await first.reserve(input(l.token, ['Q-NEW'])); assert.equal(fresh.kind, 'reserved');
  slow.resolve({ kind: 'not_applied' }); assert.deepEqual(await b, { kind: 'changed' });
  assert.equal((await second.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].code, 'Q-NEW'); await fresh.reservation.close();
});

test('a rejected asynchronous outcome is uncertain and its rejection is observed', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease(), failures = [], listener = value => failures.push(value);
  process.on('unhandledRejection', listener);
  try {
    const { reservation } = await gate.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
    await reservation.markOutcome(0, Promise.reject(new Error('not a synchronous boolean'))); await reservation.close();
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(failures, []);
    assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'uncertain');
  } finally { process.off('unhandledRejection', listener); }
});

test('a batch stops before the next item after any uncertain outcome', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2'])); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await assert.rejects(reservation.markSending(1), /outcome is uncertain/);
  await reservation.close(); assert.deepEqual((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items.map(item => item.status),
    ['uncertain', 'waiting']);
});

test('even unknown or applied reconciliation evidence is discarded after another resolution replaces the journal', async () => {
  for (const evidence of ['unknown', 'applied']) {
    const db = memoryBackend(), first = new QolipPlacementGate(db.wrapper()), second = new QolipPlacementGate(db.wrapper()), l = lease();
    const { reservation } = await first.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
    await reservation.markOutcome(0, false); await reservation.close(); const slow = deferred();
    const stale = first.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: () => slow.promise } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(await second.reconcile({ origin: ORIGIN, lease: l.token, authority: settled({ kind: 'not_applied' }) }), { kind: 'reconciled' });
    const next = await second.reserve(input(l.token, ['NEW'])); slow.resolve({ kind: evidence });
    assert.deepEqual(await stale, { kind: 'changed' }); await next.reservation.close();
  }
});

test('wire payload must match the reserved mold, cell and quantity and cannot carry extra fields', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  for (const mutate of [data => { data.qolip_code = 'OTHER'; }, data => { data.column_number = 2; },
    data => { data.quantity = 2; }, data => { data.unexpected = 'secret'; }]) {
    const args = input(l.token); const data = JSON.parse(args.actions[0].body); mutate(data); args.actions[0].body = JSON.stringify(data);
    await assert.rejects(gate.reserve(args), /request body/); assert.equal(db.raw, null);
  }
  const spaced = input(l.token); spaced.actions[0].body = ` ${spaced.actions[0].body}`;
  await assert.rejects(gate.reserve(spaced), /request body/);
  const duplicate = input(l.token); duplicate.actions[0].body = duplicate.actions[0].body.replace('{', '{"qolip_code":"OTHER",');
  await assert.rejects(gate.reserve(duplicate), /request body/); assert.equal(db.raw, null);
});

test('wire intent is snapshotted before an asynchronous journal transaction', async () => {
  const db = memoryBackend(), wait = deferred(), underlying = db.wrapper(), delayed = { async transact(callback) {
    await wait.promise; return underlying.transact(callback);
  } }, gate = new QolipPlacementGate(delayed), l = lease();
  const target = { ...TARGET }, args = { ...input(l.token), target }; const reserving = gate.reserve(args);
  target.block = 'changed'; args.actions[0].body = body('OTHER'); args.actions[0].code = 'OTHER'; wait.resolve();
  const { reservation } = await reserving, send = await reservation.markSending(0);
  assert.equal(send.request.body, body('Q-1')); assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.target.block, 'A blok');
  send.beforeSend(); await reservation.markOutcome(0, false); await reservation.close();
});

test('replacing the caller lease during a delayed transaction cannot revive the old request', async () => {
  const db = memoryBackend(), wait = deferred(), underlying = db.wrapper(), delayed = { async transact(callback) {
    await wait.promise; return underlying.transact(callback);
  } }, gate = new QolipPlacementGate(delayed), old = lease(), replacement = lease();
  const args = input(old.token), pending = gate.reserve(args); old.deactivate(); args.lease = replacement.token; wait.resolve();
  assert.deepEqual(await pending, { kind: 'session_changed' }); assert.equal(db.raw, null);
});

test('the evidence provider and same-account inspection receive no journal ownership digest or wire body', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token)); const send = await reservation.markSending(0); send.beforeSend();
  await reservation.markOutcome(0, false); await reservation.close();
  const owned = (await gate.inspect({ origin: ORIGIN, lease: l.token })).pending;
  assert.equal(Object.hasOwn(owned, 'ownerScopeKey'), false); assert.equal(Object.hasOwn(owned.items[0], 'body'), false);
  let seen; await gate.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: async pending => {
    seen = pending; return { kind: 'unknown' }; } } });
  assert.equal(Object.hasOwn(seen, 'ownerScopeKey'), false); assert.equal(Object.hasOwn(seen.items[0], 'body'), false);
});

test('a corrupted journal with out-of-order or repeated sends fails closed', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  await gate.reserve(input(l.token, ['Q1', 'Q2'])); const journal = JSON.parse(db.raw);
  for (const statuses of [['waiting', 'confirmed'], ['uncertain', 'uncertain']]) {
    const corrupted = structuredClone(journal); corrupted.origins[0].pending.items.forEach((item, index) => { item.status = statuses[index]; });
    const blocked = new QolipPlacementGate(memoryBackend(JSON.stringify(corrupted)).wrapper());
    await assert.rejects(blocked.inspect({ origin: ORIGIN, lease: l.token }), /journal is corrupt/);
  }
});

test('out-of-order permits leave a four-item journal byte-for-byte unchanged', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2', 'Q3', 'Q4']));
  for (const index of [1, 2, 3]) {
    const before = db.raw; await assert.rejects(reservation.markSending(index), /order is invalid/); assert.equal(db.raw, before);
  }
  for (let index = 0; index < 4; index++) {
    const permit = await reservation.markSending(index); permit.beforeSend(); await reservation.markOutcome(index, true);
    for (let skipped = index + 2; skipped < 4; skipped++) {
      const before = db.raw; await assert.rejects(reservation.markSending(skipped), /order is invalid/); assert.equal(db.raw, before);
    }
  }
  assert.deepEqual((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items.map(item => item.status),
    ['confirmed', 'confirmed', 'confirmed', 'confirmed']);
  await reservation.close();
});

test('concurrent and out-of-order sends cannot mutate a delayed transaction', async () => {
  const db = memoryBackend(), wrapped = db.wrapper(), entered = deferred(), release = deferred(); let delay = false;
  const gate = new QolipPlacementGate({ async transact(update) {
    if (delay) { delay = false; entered.resolve(); await release.promise; }
    return wrapped.transact(update);
  } }), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2', 'Q3']));
  const before = db.raw; delay = true; const first = reservation.markSending(0); await entered.promise;
  await assert.rejects(reservation.markSending(1), /already sending/);
  await assert.rejects(reservation.markSending(2), /already sending/); assert.equal(db.raw, before);
  release.resolve(); const permit = await first; permit.beforeSend(); await reservation.markOutcome(0, true);
  const after = db.raw; await assert.rejects(reservation.markSending(2), /order is invalid/); assert.equal(db.raw, after);
  const second = await reservation.markSending(1); second.beforeSend(); await reservation.markOutcome(1, true);
  const third = await reservation.markSending(2); third.beforeSend(); await reservation.markOutcome(2, true); await reservation.close();
});

test('rejected or ambiguously committed stores never create a later send permit', async () => {
  {
    const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
    const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2'])); const before = db.raw; db.fail();
    await assert.rejects(reservation.markSending(0), /journal unavailable/); assert.equal(db.raw, before);
    await assert.rejects(reservation.markSending(1), /order is invalid/); assert.equal(db.raw, before);
    const permit = await reservation.markSending(0); permit.beforeSend(); await reservation.markOutcome(0, true); await reservation.close();
  }
  {
    const db = memoryBackend(), wrapped = db.wrapper(); let loseAcknowledgement = false;
    const gate = new QolipPlacementGate({ async transact(update) {
      const value = await wrapped.transact(update);
      if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('acknowledgement lost'); }
      return value;
    } }), l = lease();
    const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2'])); loseAcknowledgement = true;
    await assert.rejects(reservation.markSending(0), /acknowledgement lost/); const uncertain = db.raw;
    assert.deepEqual(JSON.parse(uncertain).origins[0].pending.items.map(item => item.status), ['uncertain', 'waiting']);
    await assert.rejects(reservation.markSending(1), /outcome is uncertain/); assert.equal(db.raw, uncertain);
    await reservation.close(); assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'uncertain');
  }
});

for (const callback of ['isCurrent', 'currentGeneration']) {
  for (const operation of ['markOutcome', 'markSending', 'close', 'beforeSend']) {
    test(`reentrant ${operation} from ${callback} taints the permit and keeps the journal in flight`, async () => {
      const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
      let armed = false, nested, innerError, reservation, permit;
      const original = l.token[callback];
      l.token[callback] = function () {
        if (armed) {
          armed = false;
          try {
            if (operation === 'markOutcome') nested = reservation.markOutcome(0, false);
            else if (operation === 'markSending') nested = reservation.markSending(1);
            else if (operation === 'close') nested = reservation.close();
            else permit.beforeSend();
          } catch (error) { innerError = error; }
        }
        return original.call(this);
      };
      ({ reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2'])));
      permit = await reservation.markSending(0); const before = db.raw; armed = true;
      assert.throws(permit.beforeSend, /session changed or request not journaled/);
      if (operation === 'beforeSend') assert.match(innerError.message, /session changed or request not journaled/);
      else await assert.rejects(nested, /Qolip placement/);
      assert.equal(db.raw, before);
      assert.throws(permit.beforeSend, /session changed or request not journaled/, 'the observed failure is sticky');
      let calls = 0;
      assert.deepEqual(await gate.reconcile({ origin: ORIGIN, lease: l.token, authority: { readAfterVerifiedSettlement: async () => {
        calls++; return { kind: 'not_applied' };
      } } }), { kind: 'in_flight' });
      assert.equal(calls, 0); assert.equal(db.raw, before);
      await reservation.markOutcome(0, false); await reservation.close();
      assert.deepEqual((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items.map(item => item.status), ['uncertain', 'waiting']);
    });
  }
}

test('ignored reentrant rejected operations are observed without releasing the hold', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease(), unhandled = [], listener = reason => unhandled.push(reason);
  let armed = false, reservation;
  const original = l.token.isCurrent;
  l.token.isCurrent = function () {
    if (armed) { armed = false; reservation.markOutcome(0, false); reservation.close(); reservation.markSending(1); }
    return original.call(this);
  };
  process.on('unhandledRejection', listener);
  try {
    ({ reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2']))); const permit = await reservation.markSending(0), before = db.raw;
    armed = true; assert.throws(permit.beforeSend, /session changed/); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []); assert.equal(db.raw, before);
    await reservation.markOutcome(0, false); await reservation.close();
  } finally { process.off('unhandledRejection', listener); }
});

test('reentrant close during prepare or outcome checks cannot clear or confirm an uncertain item', async () => {
  for (const during of ['prepare', 'outcome']) {
    const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease(); let armed = false, nested, reservation;
    const original = l.token.isCurrent;
    l.token.isCurrent = function () { if (armed) { armed = false; nested = reservation.close(); } return original.call(this); };
    ({ reservation } = await gate.reserve(input(l.token)));
    if (during === 'prepare') {
      const before = db.raw; armed = true; assert.equal(await reservation.markSending(0), null);
      await assert.rejects(nested, /still sending/); assert.equal(db.raw, before);
      assert.equal(await reservation.markSending(0), null); await reservation.close();
    } else {
      const permit = await reservation.markSending(0); permit.beforeSend(); armed = true;
      await reservation.markOutcome(0, true); await assert.rejects(nested, /still sending/); await reservation.close();
      assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'uncertain');
    }
  }
});

for (const property of ['isCurrent', 'currentGeneration', 'generation', 'ownerScopeKey']) {
  test(`replacing lease ${property} after reservation permanently invalidates the captured lease`, async () => {
    const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
    const { reservation } = await gate.reserve(input(l.token)); const original = l.token[property], before = db.raw;
    l.token[property] = property === 'isCurrent' ? () => true : property === 'currentGeneration' ? () => l.token.generation : 'changed';
    assert.equal(await reservation.markSending(0), null); assert.equal(db.raw, before);
    l.token[property] = original; assert.equal(await reservation.markSending(0), null); assert.equal(db.raw, before);
    await reservation.close();
  });
}

for (const property of ['isCurrent', 'currentGeneration']) {
  test(`replacing lease ${property} after a permit cannot revive it by restoring the function`, async () => {
    const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease();
    const { reservation } = await gate.reserve(input(l.token)); const permit = await reservation.markSending(0), before = db.raw;
    const original = l.token[property]; l.token[property] = property === 'isCurrent' ? () => true : () => l.token.generation;
    assert.throws(permit.beforeSend, /session changed/); l.token[property] = original;
    assert.throws(permit.beforeSend, /session changed/); assert.equal(db.raw, before);
    await reservation.markOutcome(0, false); await reservation.close();
  });
}

test('replacement during a delayed transaction and a live generation change cannot revive a reservation', async () => {
  for (const change of ['replacement', 'generation']) {
    const db = memoryBackend(), wrapped = db.wrapper(), entered = deferred(), release = deferred(); let delay = false;
    const gate = new QolipPlacementGate({ async transact(update) {
      if (delay) { delay = false; entered.resolve(); await release.promise; }
      return wrapped.transact(update);
    } }), l = lease();
    const { reservation } = await gate.reserve(input(l.token)); const before = db.raw, original = l.token.currentGeneration;
    delay = true; const pending = reservation.markSending(0); await entered.promise;
    if (change === 'replacement') l.token.currentGeneration = () => l.token.generation;
    else l.change('generation-2');
    release.resolve(); assert.equal(await pending, null); assert.equal(db.raw, before);
    l.token.currentGeneration = original; l.change('generation-1');
    assert.equal(await reservation.markSending(0), null); assert.equal(db.raw, before); await reservation.close();
  }
});

test('a callback that replaces its sibling during a check fails closed', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease(); let armed = false;
  const original = l.token.currentGeneration, originalIsCurrent = l.token.isCurrent;
  l.token.currentGeneration = function () { if (armed) { armed = false; l.token.isCurrent = () => true; } return original.call(this); };
  const { reservation } = await gate.reserve(input(l.token)); const before = db.raw; armed = true;
  assert.equal(await reservation.markSending(0), null); l.token.isCurrent = originalIsCurrent;
  assert.equal(await reservation.markSending(0), null); assert.equal(db.raw, before); await reservation.close();
});

test('concurrent outcome, close and permit calls cannot overlap a delayed outcome commit', async () => {
  const db = memoryBackend(), wrapped = db.wrapper(), entered = deferred(), release = deferred(); let delay = false;
  const gate = new QolipPlacementGate({ async transact(update) {
    if (delay) { delay = false; entered.resolve(); await release.promise; }
    return wrapped.transact(update);
  } }), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2'])); const permit = await reservation.markSending(0); permit.beforeSend();
  const before = db.raw; delay = true; const finishing = reservation.markOutcome(0, true); await entered.promise;
  await assert.rejects(reservation.markOutcome(0, false), /Invalid Qolip placement outcome/);
  await assert.rejects(reservation.close(), /still sending/); await assert.rejects(reservation.markSending(1), /already sending/);
  assert.throws(permit.beforeSend, /not journaled/); assert.equal(db.raw, before);
  release.resolve(); await finishing; assert.equal((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items[0].status, 'confirmed');
  await reservation.close();
});

test('lost outcome-store acknowledgement permanently stops the reservation before the next item', async () => {
  const db = memoryBackend(), wrapped = db.wrapper(); let loseAcknowledgement = false;
  const gate = new QolipPlacementGate({ async transact(update) {
    const value = await wrapped.transact(update);
    if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('outcome acknowledgement lost'); }
    return value;
  } }), l = lease();
  const { reservation } = await gate.reserve(input(l.token, ['Q1', 'Q2']));
  const first = await reservation.markSending(0); first.beforeSend(); loseAcknowledgement = true;
  await assert.rejects(reservation.markOutcome(0, true), /outcome acknowledgement lost/); const before = db.raw;
  await assert.rejects(reservation.markSending(1), /journal outcome is uncertain/); assert.equal(db.raw, before);
  await reservation.close(); assert.deepEqual((await gate.inspect({ origin: ORIGIN, lease: l.token })).pending.items.map(item => item.status),
    ['confirmed', 'waiting']);
});

test('multiple rejected lease property replacements are observed and cannot revive a permit', async () => {
  const db = memoryBackend(), gate = new QolipPlacementGate(db.wrapper()), l = lease(), unhandled = [], listener = reason => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  try {
    const { reservation } = await gate.reserve(input(l.token)), permit = await reservation.markSending(0), before = db.raw;
    const original = { ...l.token };
    l.token.currentGeneration = Promise.reject(new Error('bad generation property'));
    l.token.isCurrent = Promise.reject(new Error('bad current property'));
    assert.throws(permit.beforeSend, /session changed/); Object.assign(l.token, original);
    assert.throws(permit.beforeSend, /session changed/); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []); assert.equal(db.raw, before);
    await reservation.markOutcome(0, false); await reservation.close();
  } finally { process.off('unhandledRejection', listener); }
});
