// Review regressions use fake in-memory storage only. They do not establish native durability or external authority.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/homashyo/rawSplitJournalPrototype.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const api = loaded.exports;
const scope = { serverId: 'erp-one', ownerRef: 'operator-one' };
const cmd = { kind: 'stock', requestId: 'request-001', json: JSON.stringify({ request_id: 'request-001', value: 1 }) };
const fakeOutcome = JSON.stringify({ server_id: scope.serverId, owner_ref: scope.ownerRef, request_id: cmd.requestId,
  command_kind: cmd.kind, status: 'applied', response: { id: 'fabricated' } });
function setup() {
  const values = new Map(); let updates = 0, reads = 0;
  const store = { getItemAsync: async key => { reads++; return values.get(key) ?? null; },
    setItemAsync: async (key, update) => { updates++; values.set(key, update(values.get(key) ?? null)); } };
  const token = typeof api.createPrototypeFenceToken === 'function'
    ? api.createPrototypeFenceToken() : 'owner-1';
  const owner = { generation: 1, token, isCurrent: () => true };
  const options = { store, scope, owner, observeLegacy: () => ({ writers: 'stopped', stockKey: 'absent', issueKey: 'absent' }),
    // Arbitrary caller assertions cannot provide independent recovery or outcome authority.
    recoveryProof: { current: true }, verifyOutcome: () => true, verifyAcknowledgment: () => true };
  const journal = api.createRawSplitJournalPrototype(options);
  function seed(phase, outcomeJson = null) {
    values.set(journal.key, JSON.stringify({ version: 1, scope, revision: 1, owner: { generation: 1, token: 'owner-1' },
      active: phase ? { command: cmd, phase, outcomeJson } : null, tombstones: [] }));
  }
  return { values, store, owner, options, journal, seed, updates: () => updates, reads: () => reads };
}
function blockedFor(fragment) {
  return error => error instanceof api.PrototypeBlocked && error.reason.includes(fragment);
}

test('a missing journal is not treated as a first use when no independent recovery authority exists', async () => {
  const h = setup(); h.seed('uncertain'); h.values.delete(h.journal.key);
  await assert.rejects(h.journal.bindOwner(), blockedFor('recovery authority unavailable'));
  assert.equal(h.values.has(h.journal.key), false); assert.equal(h.updates(), 0);
  await assert.rejects(h.journal.inspect(), blockedFor('recovery authority unavailable'));
});

test('a valid-looking restored older value cannot authorize a new command without independent recovery authority', async () => {
  const h = setup(); h.seed(null); const before = h.values.get(h.journal.key);
  await assert.rejects(h.journal.prepare(1, cmd), blockedFor('recovery authority unavailable'));
  assert.equal(h.values.get(h.journal.key), before); assert.equal(h.updates(), 0);
});

test('matching fabricated outcome fields and caller-supplied verifier do not prove server authority', async () => {
  const h = setup(); h.seed('uncertain'); const before = h.values.get(h.journal.key);
  await assert.rejects(h.journal.recordOutcome(1, cmd.requestId, fakeOutcome), blockedFor('outcome authority unavailable'));
  assert.equal(h.values.get(h.journal.key), before); assert.equal(h.updates(), 0);
});

test('a matching fabricated acknowledgment and caller-supplied verifier do not prove user observation', async () => {
  const h = setup(); h.seed('completed', fakeOutcome); const before = h.values.get(h.journal.key);
  await assert.rejects(h.journal.acknowledge(1, cmd.requestId, fakeOutcome), blockedFor('acknowledgment authority unavailable'));
  assert.equal(h.values.get(h.journal.key), before); assert.equal(h.updates(), 0);
});

test('raw authentication-like strings cannot be supplied as persisted fence tokens', () => {
  const h = setup();
  assert.throws(() => api.createRawSplitJournalPrototype({ ...h.options,
    owner: { ...h.owner, token: 'eyJhbGciOiJIUzI1NiJ9.secret-session-token' } }), api.PrototypeBlocked);
  assert.throws(() => api.createPrototypeFenceToken('secret-token'), api.PrototypeBlocked);
  assert.throws(() => api.createRawSplitJournalPrototype({ ...h.options, owner: { ...h.owner, token: {} } }), api.PrototypeBlocked);
  assert.equal(Object.isFrozen(h.owner.token), true); assert.deepEqual(Object.keys(h.owner.token), []);
  assert.notEqual(api.createPrototypeFenceToken(), h.owner.token);
});

test('all operations remain unavailable without independent proof and perform no reads or writes', async () => {
  const h = setup(); h.seed('prepared'); const before = h.values.get(h.journal.key);
  await assert.rejects(h.journal.bindOwner(), blockedFor('recovery authority unavailable'));
  await assert.rejects(h.journal.inspect(), blockedFor('recovery authority unavailable'));
  await assert.rejects(h.journal.prepare(1, cmd), blockedFor('recovery authority unavailable'));
  await assert.rejects(h.journal.markUncertain(1, cmd.requestId), blockedFor('recovery authority unavailable'));
  await assert.rejects(h.journal.cancelPrepared(1, cmd.requestId), blockedFor('dispatch provenance unavailable'));
  await assert.rejects(h.journal.recordOutcome(1, cmd.requestId, fakeOutcome), blockedFor('outcome authority unavailable'));
  await assert.rejects(h.journal.acknowledge(1, cmd.requestId, fakeOutcome), blockedFor('acknowledgment authority unavailable'));
  assert.equal(h.values.get(h.journal.key), before); assert.equal(h.reads(), 0); assert.equal(h.updates(), 0);
});

test('opaque in-memory fence handles are not serializable as reusable authority', () => {
  const h = setup();
  const copied = JSON.parse(JSON.stringify(h.owner.token));
  assert.throws(() => api.createRawSplitJournalPrototype({ ...h.options, owner: { ...h.owner, token: copied } }), api.PrototypeBlocked);
});

test('scope requires its own exact identity fields rather than inherited or substituted properties', () => {
  const inherited = Object.assign(Object.create(scope), { unrelated: 1, other: 2 });
  assert.throws(() => api.prototypeJournalKey(inherited), api.PrototypeBlocked);
  const commaKey = Object.assign(Object.create(scope), { 'ownerRef,serverId': true });
  assert.throws(() => api.prototypeJournalKey(commaKey), api.PrototypeBlocked);
});
