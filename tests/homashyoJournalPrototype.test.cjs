// Mocked state-machine tests only. No native SQLite, backend, printer or device is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/homashyo/rawSplitJournalPrototype.ts');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { createRawSplitJournalPrototype: create, prototypeJournalKey, PrototypeBlocked, PrototypeWriteUncertain } = loaded.exports;

class TransactionalFake {
  constructor() { this.values = new Map(); this.tail = Promise.resolve(); this.failure = null; this.afterUpdater = null; this.readFailure = false; this.locked = false; this.abortOnContention = false; }
  async getItemAsync(key) {
    if (this.readFailure) throw Error('injected read failure');
    return this.values.get(key) ?? null;
  }
  async setItemAsync(key, updater) {
    if (this.abortOnContention && this.locked) throw Error('injected database locked');
    if (this.abortOnContention) this.locked = true;
    const before = this.tail; let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await before;
    try {
      const failure = this.failure; this.failure = null;
      if (failure === 'before') throw Error('injected before callback');
      const value = updater(this.values.get(key) ?? null);
      const hook = this.afterUpdater; this.afterUpdater = null;
      if (hook) await hook();
      if (failure === 'beforeCommit') throw Error('injected before commit');
      this.values.set(key, value);
      if (failure === 'afterCommit') throw Error('injected after commit');
    } finally { if (this.abortOnContention) this.locked = false; release(); }
  }
}
const scope = { serverId: 'erp-one', ownerRef: 'operator-one' };
const clean = () => ({ writers: 'stopped', stockKey: 'absent', issueKey: 'absent' });
function command(id = 'request-001', kind = 'stock', overrides = {}) {
  const json = kind === 'stock' ? JSON.stringify({ request_id: id, value: 1 }) : JSON.stringify({ command: { request_id: id }, note: 'issue' });
  return { kind, requestId: id, json, ...overrides };
}
function outcome(cmd = command(), overrides = {}) {
  return JSON.stringify({ server_id: scope.serverId, owner_ref: scope.ownerRef, request_id: cmd.requestId,
    command_kind: cmd.kind, status: 'applied', response: { id: 'result-1' }, ...overrides });
}
function setup(opts = {}) {
  const store = opts.store ?? new TransactionalFake();
  const current = opts.current ?? { value: true };
  const legacy = opts.legacy ?? { value: clean() };
  const owner = { generation: opts.generation ?? 1, token: opts.token ?? 'owner-1', isCurrent: () => current.value };
  const journal = create({ store, scope: opts.scope ?? scope, owner, observeLegacy: () => legacy.value });
  return { store, current, legacy, owner, journal };
}
function isUncertain(reason) { return reason instanceof PrototypeWriteUncertain; }
function hasBlocked(reason, text) {
  return reason instanceof PrototypeWriteUncertain && reason.original instanceof PrototypeBlocked && reason.original.reason.includes(text);
}
async function uncertainState(journal, cmd = command()) {
  const initial = await journal.bindOwner();
  const prepared = await journal.prepare(initial.revision, cmd);
  return journal.markUncertain(prepared.revision, cmd.requestId);
}

// The production safety switch remains non-configurable, and no runtime imports this experiment.
test('prototype is unconnected and production write hold is unchanged', () => {
  const policy = fs.readFileSync(path.resolve(__dirname, '../src/homashyo/rawSplitWritePolicy.ts'), 'utf8');
  assert.match(policy, /rawSplitWriteDispatchAllowed\(\): boolean \{ return false; \}/);
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? walk(file) : /\.[cm]?[jt]sx?$/.test(item.name) ? [file] : [];
  });
  const src = path.resolve(__dirname, '../src');
  for (const file of walk(src).filter(file => file !== filename)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /rawSplitJournalPrototype/, file);
  }
  const { journal } = setup();
  assert.deepEqual(Object.keys(journal).sort(), ['acknowledge', 'bindOwner', 'inspect', 'key', 'markUncertain', 'prepare', 'recordOutcome']);
});

test('versioned command persists complete response until exact acknowledgment and then retains a tombstone', async () => {
  const { journal } = setup(); const cmd = command();
  const initial = await journal.bindOwner(); assert.equal(initial.version, 1);
  const prepared = await journal.prepare(initial.revision, cmd); assert.equal(prepared.active.phase, 'prepared');
  const pending = await journal.markUncertain(prepared.revision, cmd.requestId); assert.equal(pending.active.phase, 'uncertain');
  const body = outcome(cmd); const completed = await journal.recordOutcome(pending.revision, cmd.requestId, body);
  assert.equal((await journal.inspect()).active.outcomeJson, body);
  await assert.rejects(journal.acknowledge(completed.revision, cmd.requestId, body + ' '), e => hasBlocked(e, 'completion mismatch'));
  assert.equal((await journal.inspect()).active.outcomeJson, body);
  const ack = await journal.acknowledge(completed.revision, cmd.requestId, body);
  assert.equal(ack.active, null); assert.equal(ack.tombstones.length, 1);
  assert.equal(ack.tombstones[0].command.json, cmd.json); assert.equal(ack.tombstones[0].outcomeJson, body);
  await assert.rejects(journal.prepare(ack.revision, cmd), e => hasBlocked(e, 'already used'));
  await assert.rejects(journal.prepare(ack.revision, command(cmd.requestId, 'stock', { json: JSON.stringify({ request_id: cmd.requestId, value: 2 }) })), e => hasBlocked(e, 'already used'));
});

test('after acknowledgment a new ID can represent the same user intent, which this prototype cannot detect', async () => {
  const { journal } = setup(), cmd = command(), pending = await uncertainState(journal, cmd), body = outcome(cmd);
  const completed = await journal.recordOutcome(pending.revision, cmd.requestId, body);
  const ack = await journal.acknowledge(completed.revision, cmd.requestId, body);
  const repeatedIntent = await journal.prepare(ack.revision, command('another-request-id'));
  assert.equal(repeatedIntent.active.command.requestId, 'another-request-id');
});

test('issue payload IDs and scoped server outcome identity must match', async () => {
  const { journal } = setup(); const cmd = command('request-issue', 'issue');
  const pending = await uncertainState(journal, cmd);
  for (const bad of [
    JSON.stringify({ id: 'stock-response-without-request-id' }),
    outcome(cmd, { server_id: 'other-server' }), outcome(cmd, { owner_ref: 'other-owner' }),
    outcome(cmd, { request_id: 'other-request' }), outcome(cmd, { command_kind: 'stock' }),
    outcome(cmd, { status: 'not-found' }), outcome(cmd, { response: null }),
  ]) {
    await assert.rejects(journal.recordOutcome(pending.revision, cmd.requestId, bad), isUncertain);
    assert.equal((await journal.inspect()).active.phase, 'uncertain');
  }
  const completed = await journal.recordOutcome(pending.revision, cmd.requestId, outcome(cmd, { status: 'rejected' }));
  assert.equal(completed.active.phase, 'completed');
  const other = setup(); const initial = await other.journal.bindOwner();
  await assert.rejects(other.journal.prepare(initial.revision, command('good-id', 'issue', { json: JSON.stringify({ command: { request_id: 'other-id' } }) })), PrototypeBlocked);
  await assert.rejects(other.journal.prepare(initial.revision, command('invalid id')), PrototypeBlocked);
});

test('concurrent new commands produce one winner and never overwrite its payload', async () => {
  const { journal } = setup(); const initial = await journal.bindOwner();
  const attempts = Array.from({ length: 30 }, (_, i) => journal.prepare(initial.revision, command(`request-${i}`)));
  const settled = await Promise.allSettled(attempts);
  assert.equal(settled.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(settled.filter(x => x.status === 'rejected' && isUncertain(x.reason)).length, 29);
  const saved = await journal.inspect(); assert.equal(saved.active.command.requestId, 'request-0');
  await assert.rejects(journal.prepare(saved.revision, command('newer-command')), e => hasBlocked(e, 'active command'));
  assert.equal((await journal.inspect()).active.command.requestId, 'request-0');
});

test('a contending transaction can abort with a lock error and is not treated as an empty journal', async () => {
  const h = setup(), initial = await h.journal.bindOwner(); h.store.abortOnContention = true;
  let entered, resume; const started = new Promise(resolve => { entered = resolve; });
  const canCommit = new Promise(resolve => { resume = resolve; });
  h.store.afterUpdater = async () => { entered(); await canCommit; };
  const first = h.journal.prepare(initial.revision, command('request-first'));
  await started;
  await assert.rejects(h.journal.prepare(initial.revision, command('request-second')), isUncertain);
  resume(); await first;
  assert.equal((await h.journal.inspect()).active.command.requestId, 'request-first');
});

test('a rejected write before commit and a lost success after commit are both treated as uncertain', async () => {
  const h = setup(); const initial = await h.journal.bindOwner();
  h.store.failure = 'beforeCommit';
  await assert.rejects(h.journal.prepare(initial.revision, command()), isUncertain);
  assert.equal((await h.journal.inspect()).active, null);
  h.store.failure = 'afterCommit';
  await assert.rejects(h.journal.prepare(initial.revision, command()), isUncertain);
  const observed = await h.journal.inspect(); assert.equal(observed.active.phase, 'prepared');
  await assert.rejects(h.journal.prepare(initial.revision, command()), isUncertain);
  await assert.rejects(h.journal.prepare(observed.revision, command()), e => hasBlocked(e, 'active command'));
});

test('lost completion and acknowledgment results remain recoverable without resending', async () => {
  const h = setup(), cmd = command(); const pending = await uncertainState(h.journal, cmd), body = outcome(cmd);
  h.store.failure = 'afterCommit';
  await assert.rejects(h.journal.recordOutcome(pending.revision, cmd.requestId, body), isUncertain);
  const complete = await h.journal.inspect(); assert.equal(complete.active.outcomeJson, body);
  h.store.failure = 'afterCommit';
  await assert.rejects(h.journal.acknowledge(complete.revision, cmd.requestId, body), isUncertain);
  const acknowledged = await h.journal.inspect(); assert.equal(acknowledged.active, null);
  assert.equal(acknowledged.tombstones[0].outcomeJson, body);
  await assert.rejects(h.journal.prepare(acknowledged.revision, cmd), e => hasBlocked(e, 'already used'));
});

test('a stale owner is fenced after handover and its delayed completion cannot erase newer state', async () => {
  const shared = new TransactionalFake();
  const old = setup({ store: shared }), pending = await uncertainState(old.journal);
  const next = setup({ store: shared, generation: 2, token: 'owner-2' });
  const adopted = await next.journal.bindOwner(); assert.equal(adopted.active.command.requestId, 'request-001');
  await assert.rejects(old.journal.recordOutcome(pending.revision, 'request-001', outcome()), e => hasBlocked(e, 'stale owner'));
  await assert.rejects(old.journal.bindOwner(), e => hasBlocked(e, 'stale owner'));
  assert.equal((await next.journal.inspect()).active.phase, 'uncertain');
  const imposter = setup({ store: shared, generation: 2, token: 'other-token' });
  await assert.rejects(imposter.journal.bindOwner(), e => hasBlocked(e, 'stale owner'));
});

test('owner invalidation after updater before commit has an uncertain result, preserved for the next owner', async () => {
  const h = setup(); const initial = await h.journal.bindOwner();
  h.store.afterUpdater = () => { h.current.value = false; };
  await assert.rejects(h.journal.prepare(initial.revision, command()), isUncertain);
  await assert.rejects(h.journal.inspect(), PrototypeBlocked);
  const next = setup({ store: h.store, generation: 2, token: 'owner-2' });
  await next.journal.bindOwner(); assert.equal((await next.journal.inspect()).active.command.requestId, 'request-001');
});

test('mocked restarts preserve each phase and never perform a resend', async () => {
  const h = setup(), cmd = command(), initial = await h.journal.bindOwner();
  await h.journal.prepare(initial.revision, cmd);
  const restarted = setup({ store: h.store, generation: 2, token: 'owner-after-restart' });
  let observed = await restarted.journal.bindOwner(); assert.equal(observed.active.phase, 'prepared');
  observed = await restarted.journal.markUncertain(observed.revision, cmd.requestId);
  const restartedAgain = setup({ store: h.store, generation: 3, token: 'owner-after-second-restart' });
  observed = await restartedAgain.journal.bindOwner(); assert.equal(observed.active.phase, 'uncertain');
  observed = await restartedAgain.journal.recordOutcome(observed.revision, cmd.requestId, outcome(cmd));
  const restartedThird = setup({ store: h.store, generation: 4, token: 'owner-after-third-restart' });
  observed = await restartedThird.journal.bindOwner(); assert.equal(observed.active.outcomeJson, outcome(cmd));
  assert.equal(observed.active.phase, 'completed');
});

test('a stale acknowledgment cannot clear a newer command even after the first was acknowledged', async () => {
  const { journal } = setup(), cmd = command(); const pending = await uncertainState(journal, cmd), body = outcome(cmd);
  const completed = await journal.recordOutcome(pending.revision, cmd.requestId, body);
  const ack = await journal.acknowledge(completed.revision, cmd.requestId, body);
  const newer = await journal.prepare(ack.revision, command('request-002'));
  await assert.rejects(journal.acknowledge(completed.revision, cmd.requestId, body), e => hasBlocked(e, 'stale revision'));
  await assert.rejects(journal.acknowledge(newer.revision, cmd.requestId, body), e => hasBlocked(e, 'completion mismatch'));
  assert.equal((await journal.inspect()).active.command.requestId, 'request-002');
});

test('one or both legacy keys, active or unknown writers, and uncertain legacy reads all fail closed', async () => {
  for (const observation of [
    { writers: 'stopped', stockKey: 'present', issueKey: 'absent' },
    { writers: 'stopped', stockKey: 'absent', issueKey: 'present' },
    { writers: 'stopped', stockKey: 'present', issueKey: 'present' },
    { writers: 'stopped', stockKey: 'unknown', issueKey: 'absent' },
    { writers: 'stopped', stockKey: 'absent', issueKey: 'unknown' },
    { writers: 'active', stockKey: 'absent', issueKey: 'absent' },
    { writers: 'unknown', stockKey: 'absent', issueKey: 'absent' },
  ]) {
    const h = setup({ legacy: { value: observation } });
    await assert.rejects(h.journal.bindOwner(), PrototypeBlocked); assert.equal(h.store.values.size, 0);
    await assert.rejects(h.journal.inspect(), PrototypeBlocked);
  }
  const h = setup(); const initial = await h.journal.bindOwner();
  h.legacy.value = { writers: 'stopped', stockKey: 'present', issueKey: 'absent' };
  await assert.rejects(h.journal.prepare(initial.revision, command()), PrototypeBlocked);
  h.legacy.value = clean(); assert.equal((await h.journal.inspect()).active, null);
  h.store.readFailure = true; await assert.rejects(h.journal.inspect(), /injected read failure/);
});

test('existing fake legacy records are never copied, changed, deleted or automatically resent', async () => {
  const stock = 'raw-material-split.pending.v1:https://example:owner';
  const issue = `${stock}:issue`;
  for (const keys of [[stock], [issue], [stock, issue]]) {
    const h = setup({ legacy: { value: { writers: 'stopped', stockKey: keys.includes(stock) ? 'present' : 'absent', issueKey: keys.includes(issue) ? 'present' : 'absent' } } });
    for (const key of keys) h.store.values.set(key, `legacy-${key}`);
    const before = [...h.store.values.entries()];
    await assert.rejects(h.journal.bindOwner(), PrototypeBlocked);
    assert.deepEqual([...h.store.values.entries()], before);
  }
});

test('a legacy writer appearing between check and commit illustrates why this gate is not production proof', async () => {
  const h = setup(); const initial = await h.journal.bindOwner();
  h.store.afterUpdater = () => { h.legacy.value = { writers: 'active', stockKey: 'present', issueKey: 'absent' }; };
  await assert.rejects(h.journal.prepare(initial.revision, command()), isUncertain);
  await assert.rejects(h.journal.inspect(), PrototypeBlocked);
  h.legacy.value = clean(); assert.equal((await h.journal.inspect()).active.phase, 'prepared');
});

test('scope tuples do not collide and corrupt or future-version data is never treated as empty', async () => {
  const first = { serverId: 'a:b', ownerRef: 'c' }, second = { serverId: 'a', ownerRef: 'b:c' };
  assert.notEqual(prototypeJournalKey(first), prototypeJournalKey(second));
  const shared = new TransactionalFake(), one = setup({ store: shared, scope: first }), two = setup({ store: shared, scope: second });
  await one.journal.bindOwner(); await two.journal.bindOwner();
  assert.equal(shared.values.size, 2);
  const saved = JSON.parse(shared.values.get(one.journal.key)); saved.scope = second;
  shared.values.set(one.journal.key, JSON.stringify(saved));
  await assert.rejects(one.journal.inspect(), /scope mismatch/);
  await assert.rejects(one.journal.bindOwner(), isUncertain);
  saved.scope = first; saved.version = 2; shared.values.set(one.journal.key, JSON.stringify(saved));
  await assert.rejects(one.journal.inspect(), /unsupported journal version/);
  shared.values.set(one.journal.key, '{broken'); await assert.rejects(one.journal.inspect(), /invalid journal JSON/);
});

test('capacity never prunes old tombstones to admit another command', async () => {
  const { journal } = setup(); let state = await journal.bindOwner();
  for (let i = 0; i < 128; i++) {
    const cmd = command(`capacity-${i}`), body = outcome(cmd);
    state = await journal.prepare(state.revision, cmd);
    state = await journal.markUncertain(state.revision, cmd.requestId);
    state = await journal.recordOutcome(state.revision, cmd.requestId, body);
    state = await journal.acknowledge(state.revision, cmd.requestId, body);
  }
  assert.equal(state.tombstones.length, 128);
  await assert.rejects(journal.prepare(state.revision, command('capacity-extra')), e => hasBlocked(e, 'capacity exhausted'));
  const reloaded = await journal.inspect(); assert.equal(reloaded.tombstones.length, 128);
  assert.equal(reloaded.tombstones[0].command.requestId, 'capacity-0');
});
