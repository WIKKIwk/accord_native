// Session races use in-memory storage and deferred fake responses; no network or printer is contacted.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const fixture = require('./contracts/f11910bb/raw_material_split_test.json');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return m.exports; }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const record = (testName, pathPart) => fixture.records.find(r => r.test === testName && r.status === 200 && r.url.includes(pathPart));
const stockRecord = record('lost issue completion retries the same stock command including issue ID', '/split');
const issueRecord = fixture.records.filter(r => r.test === 'issue retry survives lost or invalid response and stays separate from stock' &&
  r.status === 200 && r.url.endsWith('/issues')).at(-1);
const sourceRecord = record('scan lookup and measured weights show 98 stock plus 2 waste', '/source');
const printRecord = record('printer failure and reprint do not submit stock again', '/print');
function setup() {
  const session = { baseUrl: 'https://example.invalid', token: 'not-a-credential', profile: { role: 'homashyo_rezkachi', ref: 'same' },
    capabilities: ['raw_material.split'] }, replacement = { ...session, profile: { ...session.profile } }, saved = new Map(), calls = [];
  let current = session, epoch = 0, witnessCurrent = true, beforeSend, respond = async () => { throw new Error('No fake response provided'); };
  const store = { getItemAsync: async key => saved.get(key) ?? null,
    setItemAsync: async (key, value) => { saved.set(key, typeof value === 'function' ? value(saved.get(key) ?? null) : value); },
    removeItemAsync: async key => saved.delete(key) };
  const api = load('homashyo/rawSplitApi', { 'expo-sqlite/kv-store': { default: store, __esModule: true },
    '../auth': { currentSession: () => current }, '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'), '../authorizedFetch': { authorizedFetch: async (s, url, init, guard) => {
      beforeSend = guard; guard(); calls.push({ s, url, init }); return respond(); } }, '../shared/mobileApiException': load('shared/mobileApiException'),
    './rawSplitModel': load('homashyo/rawSplitModel') });
  const ticket = api.createRawSplitSessionTicket(session, candidate => current === candidate ? epoch : null, () => witnessCurrent);
  return { api, store, saved, calls, session, ticket, replacement, switchSession: () => { current = replacement; epoch++; },
    bumpEpoch: () => { epoch++; }, setWitness: value => { witnessCurrent = value; }, restoreSameObject: () => { current = session; },
    setResponse: fn => { respond = fn; }, retryGuard: () => beforeSend() };
}
const fakeResponse = body => ({ status: 200, json: async () => body });
for (const kind of ['stock', 'issue']) test(`same-account new login during ${kind} pending storage read cannot return old data`, async () => {
  const h = setup(), gate = deferred(), reached = deferred();
  h.store.getItemAsync = async () => { reached.resolve(); await gate.promise; return JSON.stringify({ secret: 'old' }); };
  const pending = kind === 'stock' ? h.api.rawSplitPending(h.ticket) : h.api.rawSplitIssuePending(h.ticket);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0);
});
test('same-account new login during response JSON prevents old source from reaching a controller', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(sourceRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});
test('same-account new login while persisting a command stops before sending and leaves the exact pending command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  const set = h.store.setItemAsync; h.store.setItemAsync = async (key, value) => { await set(key, value); reached.resolve(); await gate.promise; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} response parse keeps the sent command, without retry`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => ({ status: 200, json: async () => { reached.resolve(); await gate.promise; return JSON.parse(rec.responseBody.text); } }));
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload) : h.api.rawSplitReportIssue(h.ticket, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} pending-key removal restores the exact command`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(rec.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload) : h.api.rawSplitReportIssue(h.ticket, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
test('restoring an uncertain key after logout never overwrites a newer command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text), newer = { request_id: 'newer' };
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); h.saved.set(key, JSON.stringify(newer)); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), newer); assert.equal(h.calls.length, 1);
});
test('a failed pending-key deletion is conservatively restored and does not retry the write', async () => {
  const h = setup(), payload = JSON.parse(stockRecord.requestBody.text); h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { h.saved.delete(key); throw new Error('storage interrupted'); };
  await assert.rejects(h.api.rawSplitSave(h.ticket, payload), /storage interrupted/);
  assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); assert.equal(h.calls.length, 1);
});
test('same-account new login during print response JSON cannot report old print success or automatically reprint', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(printRecord.responseBody.text); } }));
  const input = { splitId: 'split-result', barcode: 'child1', driverUrl: 'http://printer', printer: 'zebra', printMode: 'label' };
  const pending = h.api.rawSplitPrint(h.ticket, input); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});

test('same-account new login during a failed response parse does not expose the old error body', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 400, json: async () => {
    reached.resolve(); await gate.promise; return { error: 'old account detail' }; } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, error => /Akkaunt o‘zgargan/.test(error.message) && !/old account detail/.test(error.message));
});

test('epoch zero is valid; missing, invalid, inactive and forged tickets fail closed', async () => {
  const h = setup(); assert.ok(h.api.rawSplitSessionIsCurrent(h.ticket));
  for (const value of [null, undefined, NaN, -1, 1.5])
    assert.throws(() => h.api.createRawSplitSessionTicket(h.session, () => value, () => true), /Akkaunt o‘zgargan/);
  assert.throws(() => h.api.createRawSplitSessionTicket(h.replacement, () => 0, () => true), /Akkaunt o‘zgargan/);
  await assert.rejects(h.api.rawSplitPending({ session: h.session, check() {} }), /Sessiya tekshiruvi kerak/);
});
test('a login attempt epoch change invalidates an old ticket even if the same object stays active or returns after rollback', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(sourceRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.bumpEpoch(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
  const other = setup(); other.switchSession(); other.restoreSameObject();
  await assert.rejects(other.api.rawSplitPending(other.ticket), /Akkaunt o‘zgargan/);
});
test('epoch change during storage deletion preserves the exact sent command without automatic retry', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.bumpEpoch(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
  assert.equal(h.calls.length, 1);
});

test('witness transition with the same session object stops a pending send and permanently retires the ticket', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  const save = h.store.setItemAsync; h.store.setItemAsync = async (key, value) => { await save(key, value); reached.resolve(); await gate.promise; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0);
  assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); h.setWitness(true);
  assert.equal(h.api.rawSplitSessionIsCurrent(h.ticket), false); await assert.rejects(h.api.rawSplitPending(h.ticket), /Akkaunt o‘zgargan/);
});
test('witness change during a response parse preserves the sent command and never retries', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => ({ status: 200, json: async () => { reached.resolve(); await gate.promise; return JSON.parse(stockRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
test('missing or asynchronous witness fails closed without unhandled rejections', async () => {
  const h = setup(); for (const witness of [undefined, () => false, () => Promise.resolve(true), () => Promise.reject(new Error('no'))])
    assert.throws(() => h.api.createRawSplitSessionTicket(h.session, () => 0, witness), /Akkaunt o‘zgargan/);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 0);
});
test('demo token blocks stock, issue and remote print before storage or network', async () => {
  const h = setup(); h.session.token = 'test-mode-token'; let storageCalls = 0;
  h.store.getItemAsync = async () => { storageCalls++; return null; };
  await assert.rejects(h.api.rawSplitSave(h.ticket, {}), /Demo\/test/);
  await assert.rejects(h.api.rawSplitReportIssue(h.ticket, {}), /Demo\/test/);
  await assert.rejects(h.api.rawSplitPrint(h.ticket, { splitId: 'x', barcode: 'x', driverUrl: 'x', printer: 'zebra', printMode: 'label' }), /Demo\/test/);
  assert.equal(storageCalls, 0); assert.deepEqual(h.calls, []);
});
test('demo token introduced during key removal restores the sent command without another send', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.session.token = 'test-mode-token'; gate.resolve();
  await assert.rejects(pending, /Demo\/test/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); assert.equal(h.calls.length, 1);
});

test('the same captured witness guards a later 401 retry before another send', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => { reached.resolve(); await gate.promise; return fakeResponse(JSON.parse(stockRecord.responseBody.text)); });
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false);
  assert.throws(() => h.retryGuard(), /Akkaunt o‘zgargan/); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
