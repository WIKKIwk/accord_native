const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const normalizer = load('shared/searchNormalizer.ts');
const searchEngine = load('qolip/qolipSearchEngine.ts', { '../shared/searchNormalizer': normalizer });
const entry = (id, name, codes) => ({ name, display_name: name || id, source: {}, set: {
  id, fingerprint: `fp-${id}`, product_labels: [], members: codes.map(qolip_code => ({ qolip_code })),
} });
function harness(reader = async () => []) {
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'clerk' } };
  const api = load('qolip/qolipSetSearch.ts', {
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) },
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    './qolipSearchEngine': searchEngine, './qolipSetsApi': { qolipManagedSets: reader },
  });
  return { api, session };
}
const sets = [entry('S-1', 'Kross qizil', ['RED-1', 'RED-2']), entry('S-2', 'Kross yashil', ['GREEN-1', 'GREEN-2']),
  entry('S-3', 'Botinka ko‘k', ['BLUE-1', 'BLUE-2'])];

// @v2-test test/qolip_set_lookup_test.dart
test('set search tolerates typos, Cyrillic and reordered words and ranks exact names', async () => {
  const { api } = harness();
  assert.deepEqual((await api.searchQolipSets(sets, 'kross')).map(value => value.name), ['Kross qizil', 'Kross yashil']);
  for (const query of ['kros qizl', 'Кросс қизил', 'qizil kross', 'KROSS QIZIL']) {
    assert.equal((await api.searchQolipSets(sets, query))[0].set.id, 'S-1', query);
  }
  assert.deepEqual(await api.searchQolipSets(sets, 'unrelated'), []);
  assert.deepEqual(await api.searchQolipSets(sets, 'RED-3'), []);
  assert.equal((await api.searchQolipSets(sets, 'RED-1'))[0].set.id, 'S-1');
  assert.deepEqual(await api.searchQolipSets(sets, 'RED-1', { includeMoldCodes: false }), []);
});

test('empty sets are excluded, exact code beats a name and cancellation returns an empty list', async () => {
  const { api } = harness();
  const values = [entry('S-4', 'RED-1', ['OTHER']), sets[0], entry('EMPTY', 'RED-1', [])];
  assert.deepEqual((await api.searchQolipSets(values, 'RED-1')).map(value => value.set.id), ['S-1', 'S-4']);
  assert.deepEqual((await api.searchQolipSets(values, '')).map(value => value.set.id), ['S-1', 'S-4']);
  assert.deepEqual(await api.searchQolipSets(values, 'red', { isCurrent: () => false }), []);
});

test('lookup shares a scoped read, refreshes explicitly and drops stale sessions', async () => {
  const pending = [];
  const { api, session } = harness(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const lookup = new api.QolipSetLookup(session);
  assert.equal(lookup.isCurrent, false);
  const old = lookup.load(), same = lookup.load();
  assert.equal(old, same);
  assert.equal(pending.length, 1);
  assert.equal(lookup.isCurrent, true);
  session.profile.ref = 'other';
  assert.equal(lookup.isCurrent, false);
  const next = lookup.load();
  assert.notEqual(next, old);
  assert.equal(pending.length, 2);
  pending[0].resolve(sets);
  await assert.rejects(old, error => error instanceof MobileApiException && error.code === 'session_scope_changed');
  assert.equal(lookup.load(), next);
  pending[1].resolve(sets);
  assert.deepEqual(await next, sets);
  const refreshed = lookup.load(true);
  assert.notEqual(refreshed, next);
  pending[2].resolve([sets[0]]);
  assert.deepEqual(await refreshed, [sets[0]]);
});

test('failed lookup can be retried and same-account token refresh keeps the scope', async () => {
  let calls = 0;
  const { api, session } = harness(async () => { if (++calls === 1) throw new Error('offline'); return sets; });
  const lookup = new api.QolipSetLookup(session);
  await assert.rejects(lookup.load(), /offline/);
  session.token = 'refreshed';
  assert.equal(lookup.isCurrent, true);
  assert.deepEqual(await lookup.load(), sets);
  assert.equal(calls, 2);
});

// @v2-test test/qolip_set_lookup_test.dart
test('f119 lookup replay rejects an old account and caches the new read', async () => {
  const stem = 'f11910bb/qolip_set_lookup_test', name = 'lookup caches catalog reads and rejects responses from a previous session';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const replay = contractFetch(stem, name), recorded = recordedSession(stem, name);
  const session = { ...recorded, profile: { ref: 'clerk', role: 'qolipchi' } };
  const scope = { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) };
  const productParser = load('qolipCatalogApi.ts', { './auth': {}, './authorizedFetch': {}, './workerControlsApi': {} });
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const setsApi = load('qolip/qolipSetsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null }, '../sessionReadScope': scope,
    '../qolipCatalogApi': productParser, '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: () => {} }) },
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${value.token}`);
      const result = await replay(new URL(target, value.baseUrl), { ...init, headers });
      if (++calls === 1) { started(); await gate; }
      return result;
    } },
  });
  const api = load('qolip/qolipSetSearch.ts', { '../sessionReadScope': scope,
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    './qolipSearchEngine': searchEngine, './qolipSetsApi': setsApi });
  const lookup = new api.QolipSetLookup(session), old = lookup.load();
  await entered;
  session.profile.ref = 'other';
  release();
  await assert.rejects(old, error => error.code === 'session_scope_changed');
  assert.equal((await lookup.load())[0].name, 'Botinka ko‘k');
  assert.equal((await lookup.load())[0].name, 'Botinka ko‘k');
  assert.equal(calls, 2);
  replay.assertDone();
});
