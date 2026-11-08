// Exercises the actual main auth witness and role ticket with in-memory storage. No backend or printer.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename); return m.exports; }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup() {
  const auth = load('auth', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': { chunkedStorage: () => ({}) } });
  const state = new Map(); let calls = 0;
  const storage = { getItemAsync: async key => state.get(key) ?? null,
    setItemAsync: async (key, value) => state.set(key, typeof value === 'function' ? value(state.get(key) ?? null) : value),
    removeItemAsync: async key => state.delete(key) };
  const api = load('homashyo/rawSplitApi', { 'expo-sqlite/kv-store': { default: storage, __esModule: true }, '../auth': auth,
    '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'), '../authorizedFetch': { authorizedFetch: async (_s, _p, _i, guard) => { guard(); calls++; throw new Error('unexpected request'); } },
    '../shared/mobileApiException': load('shared/mobileApiException'), './rawSplitModel': load('homashyo/rawSplitModel'), './rawSplitResultMatch': load('homashyo/rawSplitResultMatch', { './rawSplitModel': load('homashyo/rawSplitModel') }) });
  const session = { baseUrl: 'https://example.invalid', token: 'not-a-credential', profile: { role: 'homashyo_rezkachi', ref: 'same' },
    capabilities: ['raw_material.split'], assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: 'A' };
  return { auth, api, storage, state, session, calls: () => calls };
}
test('actual main witness permanently retires a role ticket through same-account A-to-B-to-A', async () => {
  const h = setup(); await h.auth.saveSession(h.session); const witness = h.auth.captureSessionWitness(h.session);
  const ticket = h.api.createRawSplitSessionTicket(h.session, h.auth.activeSessionEpoch, () => h.auth.isSessionWitnessCurrent(witness));
  let transitions = 0; const stop = h.auth.subscribeSessionWitness(() => { transitions++; if (!h.auth.isSessionWitnessCurrent(witness)) h.api.rawSplitSessionIsCurrent(ticket); });
  const other = { ...h.session, profile: { ...h.session.profile }, imageCacheScope: 'B' };
  await h.auth.saveSession(other); await h.auth.saveSession(h.session); stop();
  assert.ok(transitions >= 2); assert.equal(h.auth.isSessionWitnessCurrent(witness), false);
  assert.equal(h.api.rawSplitSessionIsCurrent(ticket), false); await assert.rejects(h.api.rawSplitPending(ticket), /Akkaunt o‘zgargan/); assert.equal(h.calls(), 0);
});
test('actual main transition during role pending-key write stops dispatch and retains the command', async () => {
  const h = setup(); await h.auth.saveSession(h.session); const witness = h.auth.captureSessionWitness(h.session);
  const ticket = h.api.createRawSplitSessionTicket(h.session, h.auth.activeSessionEpoch, () => h.auth.isSessionWitnessCurrent(witness));
  const gate = deferred(), entered = deferred(), write = h.storage.setItemAsync;
  h.storage.setItemAsync = async (key, value) => { await write(key, value); entered.resolve(); await gate.promise; };
  const payload = { request_id: 'test-command' }, pending = h.api.rawSplitSave(ticket, payload); await entered.promise;
  const replacement = { ...h.session, profile: { ...h.session.profile }, imageCacheScope: 'B' }; await h.auth.saveSession(replacement);
  gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls(), 0); assert.deepEqual(JSON.parse([...h.state.values()][0]), payload);
});

test('role Profile guard uses the actual captured witness and blocks a demo token', async () => {
  const h = setup(); await h.auth.saveSession(h.session); const witness = h.auth.captureSessionWitness(h.session);
  const ticket = h.api.createRawSplitSessionTicket(h.session, h.auth.activeSessionEpoch, () => h.auth.isSessionWitnessCurrent(witness));
  const { useRawSplitProfileGuard } = load('homashyo/useRawSplitProfileGuard', { react: { useCallback: fn => fn },
    './rawSplitApi': h.api, './RawSplitContext': { useRawSplitContext: () => ({ session: h.session, ticket }) } });
  const guard = useRawSplitProfileGuard(); assert.equal(guard(), true); h.session.token = 'test-mode-token'; assert.equal(guard(), false);
  h.session.token = 'not-a-credential'; const other = { ...h.session, profile: { ...h.session.profile }, imageCacheScope: 'B' };
  await h.auth.saveSession(other); await h.auth.saveSession(h.session); assert.equal(guard(), false);
});
