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
  let current = session, respond = async () => { throw new Error('No fake response provided'); };
  const store = { getItemAsync: async key => saved.get(key) ?? null,
    setItemAsync: async (key, value) => { saved.set(key, typeof value === 'function' ? value(saved.get(key) ?? null) : value); },
    removeItemAsync: async key => saved.delete(key) };
  const api = load('homashyo/rawSplitApi', { 'expo-sqlite/kv-store': { default: store, __esModule: true },
    '../auth': { currentSession: () => current }, '../authorizedFetch': { authorizedFetch: async (s, url, init, guard) => {
      guard(); calls.push({ s, url, init }); return respond(); } }, '../shared/mobileApiException': load('shared/mobileApiException'),
    './rawSplitModel': load('homashyo/rawSplitModel') });
  return { api, store, saved, calls, session, replacement, switchSession: () => { current = replacement; },
    setResponse: fn => { respond = fn; } };
}
const fakeResponse = body => ({ status: 200, json: async () => body });
for (const kind of ['stock', 'issue']) test(`same-account new login during ${kind} pending storage read cannot return old data`, async () => {
  const h = setup(), gate = deferred(), reached = deferred();
  h.store.getItemAsync = async () => { reached.resolve(); await gate.promise; return JSON.stringify({ secret: 'old' }); };
  const pending = kind === 'stock' ? h.api.rawSplitPending(h.session) : h.api.rawSplitIssuePending(h.session);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0);
});
test('same-account new login during response JSON prevents old source from reaching a controller', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(sourceRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSource(h.session, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});
test('same-account new login while persisting a command stops before sending and leaves the exact pending command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  const set = h.store.setItemAsync; h.store.setItemAsync = async (key, value) => { await set(key, value); reached.resolve(); await gate.promise; };
  const pending = h.api.rawSplitSave(h.session, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} response parse keeps the sent command, without retry`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => ({ status: 200, json: async () => { reached.resolve(); await gate.promise; return JSON.parse(rec.responseBody.text); } }));
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.session, payload) : h.api.rawSplitReportIssue(h.session, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} pending-key removal restores the exact command`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(rec.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.session, payload) : h.api.rawSplitReportIssue(h.session, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
test('restoring an uncertain key after logout never overwrites a newer command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text), newer = { request_id: 'newer' };
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); h.saved.set(key, JSON.stringify(newer)); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.session, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), newer); assert.equal(h.calls.length, 1);
});
test('a failed pending-key deletion is conservatively restored and does not retry the write', async () => {
  const h = setup(), payload = JSON.parse(stockRecord.requestBody.text); h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { h.saved.delete(key); throw new Error('storage interrupted'); };
  await assert.rejects(h.api.rawSplitSave(h.session, payload), /storage interrupted/);
  assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); assert.equal(h.calls.length, 1);
});
test('same-account new login during print response JSON cannot report old print success or automatically reprint', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(printRecord.responseBody.text); } }));
  const input = { splitId: 'split-result', barcode: 'child1', driverUrl: 'http://printer', printer: 'zebra', printMode: 'label' };
  const pending = h.api.rawSplitPrint(h.session, input); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});

test('same-account new login during a failed response parse does not expose the old error body', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 400, json: async () => {
    reached.resolve(); await gate.promise; return { error: 'old account detail' }; } }));
  const pending = h.api.rawSplitSource(h.session, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, error => /Akkaunt o‘zgargan/.test(error.message) && !/old account detail/.test(error.message));
});
