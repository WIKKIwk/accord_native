// @v2-test test/raw_material_split_test.dart. Replay only cases that passed in the independent f119 oracle.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const Module = require('node:module'); const path = require('node:path');
const test = require('node:test'); const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
const fixture = require('./contracts/f11910bb/raw_material_split_test.json');
const stem = 'f11910bb/raw_material_split_test';
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths; loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
function setup(name, options = {}) {
  const saved = new Map(), s = recordedSession(stem, name);
  const session = { ...s, profile: { role: 'homashyo_rezkachi', ref: 'split-1' }, capabilities: ['raw_material.split'] };
  let current = session;
  const store = { getItemAsync: async key => saved.get(key) ?? null, setItemAsync: async (key, value) => { saved.set(key, value); },
    removeItemAsync: async key => saved.delete(key) };
  const replay = contractFetch(stem, name, options);
  const api = load('homashyo/rawSplitApi', { 'expo-sqlite/kv-store': { default: store, __esModule: true },
    '../auth': { currentSession: () => current }, '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => {
      guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${s.token}` } });
    } }, '../shared/mobileApiException': load('shared/mobileApiException'), './rawSplitModel': load('homashyo/rawSplitModel') });
  return { api, store, saved, session, replay, setCurrent: value => { current = value; } };
}
function bodyFor(name, pathPart) {
  const record = fixture.records.find(r => r.test === name && r.url.includes(pathPart) && r.requestBody?.text);
  return JSON.parse(record.requestBody.text);
}
test('recording is isolated and identifies the selected baseline', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
});
test('lost stock response retains exact command and retry succeeds without issuing a fresh command', async () => {
  const name = 'lost response survives restart and reuses exactly the saved command';
  const { api, session, replay } = setup(name); const payload = bodyFor(name, '/split');
  await assert.rejects(api.rawSplitSave(session, payload)); assert.deepEqual(await api.rawSplitPending(), payload);
  await assert.rejects(api.rawSplitSave(session, { ...payload, waste_kg: '3' }), /Avval oldingi operatsiya/);
  const result = await api.rawSplitSave(session, (await api.rawSplitPending()));
  assert.equal(result.id, 'split-result'); assert.equal(await api.rawSplitPending(), null); replay.assertDone();
});
test('malformed success and proxy failure retain stock key; explicit domain rejection clears it', async () => {
  const name = 'malformed success and proxy failure preserve retry; domain rejection clears it';
  const { api, session, replay } = setup(name); const payload = bodyFor(name, '/split');
  await assert.rejects(api.rawSplitSave(session, payload)); assert.deepEqual(await api.rawSplitPending(), payload);
  await assert.rejects(api.rawSplitSave(session, payload)); assert.deepEqual(await api.rawSplitPending(), payload);
  await assert.rejects(api.rawSplitSave(session, payload)); assert.equal(await api.rawSplitPending(), null); replay.assertDone();
});
test('issue retry retains exact payload separately from stock and rejects malformed returned totals', async () => {
  const name = 'issue retry survives lost or invalid response and stays separate from stock';
  const { api, session, replay } = setup(name); const payload = bodyFor(name, '/issues');
  await assert.rejects(api.rawSplitReportIssue(session, payload)); assert.deepEqual(await api.rawSplitIssuePending(), payload);
  assert.equal(await api.rawSplitPending(), null);
  await assert.rejects(api.rawSplitReportIssue(session, { ...payload, note: 'Changed' }), /Avval oldingi muammo/);
  await assert.rejects(api.rawSplitReportIssue(session, payload)); assert.deepEqual(await api.rawSplitIssuePending(), payload);
  const issue = await api.rawSplitReportIssue(session, await api.rawSplitIssuePending());
  assert.equal(issue.check.difference, 1000000n); assert.equal(await api.rawSplitIssuePending(), null); replay.assertDone();
});
test('issue-linked stock retry keeps its issue ID', async () => {
  const name = 'lost issue completion retries the same stock command including issue ID';
  const { api, session, replay } = setup(name); const payload = bodyFor(name, '/split');
  await assert.rejects(api.rawSplitSave(session, payload));
  const result = await api.rawSplitSave(session, await api.rawSplitPending());
  assert.equal(result.issueId, payload.issue_id); assert.equal(await api.rawSplitPending(), null); replay.assertDone();
});
test('source lookup uses the trimmed barcode and validates revision', async () => {
  const name = 'scan lookup and measured weights show 98 stock plus 2 waste';
  const { api, session, replay } = setup(name, { onlyPaths: ['/v1/mobile/raw-material-split/source'] });
  const result = await api.rawSplitSource(session, ' parent '); assert.equal(result.barcode, 'parent'); assert.equal(result.revision, '1.000000');
  replay.assertDone();
});
test('a failed print and reprint do not cause a second stock mutation', async () => {
  const name = 'printer failure and reprint do not submit stock again';
  const { api, session, replay } = setup(name); const payload = bodyFor(name, '/split');
  const result = await api.rawSplitSave(session, payload);
  const input = { splitId: result.id, barcode: 'child1', driverUrl: 'http://printer', printer: 'godex', printMode: 'label' };
  await assert.rejects(api.rawSplitPrint(session, input)); await api.rawSplitPrint(session, input); replay.assertDone();
});
test('pending commands are account-scoped and unauthorized profiles fail closed', async () => {
  const name = 'uncertain commands are isolated per account';
  const { api, session, replay, setCurrent } = setup(name); const payload = bodyFor(name, '/split');
  await assert.rejects(api.rawSplitSave(session, payload));
  setCurrent({ ...session, profile: { ...session.profile, ref: 'split-2' } }); assert.equal(await api.rawSplitPending(), null);
  setCurrent(session); assert.deepEqual(await api.rawSplitPending(), payload);
  setCurrent({ ...session, capabilities: [] }); assert.throws(() => api.rawSplitScope(), /huquqi kerak/);
  setCurrent({ ...session, profile: { ...session.profile, role: 'aparatchi' } }); assert.throws(() => api.rawSplitScope(), /huquqi kerak/);
  replay.assertDone();
});
