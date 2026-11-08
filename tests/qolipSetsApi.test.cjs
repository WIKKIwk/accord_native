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
const productParser = load('qolipCatalogApi.ts', { './auth': {}, './authorizedFetch': {}, './workerControlsApi': {} });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const rawSet = (overrides = {}) => ({ set_id: 'S-1', fingerprint: 'fp-1', name: ' Red ', warehouse: 'W',
  item_code: 'ITEM', item_name: 'Product', item_group: 'Finished',
  members: [{ item_code: 'ITEM', item_name: 'Product', qolip_code: 'Q-1', warehouse: 'W', size: 42, color: 'Red' }],
  products: [{ name: 'Product', code: 'ITEM' }], ...overrides });
function harness(response, options = {}) {
  const calls = [], applied = [], session = { token: 'token', profile: { ref: 'clerk', role: 'qolipchi' }, baseUrl: 'https://example.test' };
  const api = load('qolip/qolipSetsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile]) },
    '../qolipCatalogApi': productParser, '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: (data, scope) => applied.push({ data, scope }) }) },
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      calls.push({ session: value, target, init });
      const result = typeof response === 'function' ? response(calls.length, init) : response;
      options.afterResponse?.(session);
      return result;
    } },
  });
  return { api, calls, applied, session };
}

// @v2-test test/qolip_set_names_test.dart
test('f119 rename replay retains the name and conflict code', async () => {
  const stem = 'f11910bb/qolip_set_names_test', name = 'rename wire contract persists names and preserves conflict errors';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const replay = contractFetch(stem, name), recorded = recordedSession(stem, name);
  const session = { ...recorded, profile: { ref: 'clerk', role: 'qolipchi' } };
  const api = load('qolip/qolipSetsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile]) },
    '../qolipCatalogApi': productParser, '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: () => {} }) },
    '../authorizedFetch': { authorizedFetch: (value, target, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${value.token}`);
      return replay(new URL(target, value.baseUrl), { ...init, headers });
    } },
  });
  const saved = await api.qolipRenameSet(session, '950100000001', ' Hot   lunch ');
  assert.equal(saved.name, 'Hot lunch');
  assert.equal(saved.set.id, '950100000001');
  await assert.rejects(api.qolipRenameSet(session, '950100000001', 'Hot lunch'), error => error.code === 'qolip_set_name_conflict');
  replay.assertDone();
});

test('set models preserve identity, labels, source and invalid membership errors', () => {
  const { api } = harness(json({}));
  const managed = api.qolipManagedSetFromJson(rawSet());
  assert.equal(managed.set.id, 'S-1');
  assert.equal(managed.name, 'Red');
  assert.equal(managed.display_name, 'Red');
  assert.equal(managed.source.code, 'ITEM');
  assert.deepEqual(managed.set.product_labels, ['Product (ITEM)']);
  assert.equal(managed.set.members[0].set_id, 'S-1');
  assert.equal(api.qolipManagedSetFromJson(rawSet({ name: '' })).display_name, 'S-1');
  assert.throws(() => api.qolipSharedSetFromJson(rawSet({ set_id: '' })), error => error.code === 'qolip_set_changed');
  assert.throws(() => api.qolipSharedSetFromJson(rawSet({ members: [{ qolip_code: '' }] })), error => error.code === 'qolip_set_changed');
  assert.throws(() => api.qolipSharedSetFromJson(rawSet({ products: null })));
});

test('create and list preserve V2 request shape and model data', async () => {
  const { api, calls, session } = harness(index => json(index === 1 ? { set: rawSet() } : { sets: [rawSet()] }));
  const created = await api.qolipCreateSet(session, { warehouse: ' W ', members: [{ code: ' Q-1 ', size: 42, color: ' Red ' },
    { code: 'Q-2', existingOnly: true }] });
  assert.equal(created.set.id, 'S-1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { warehouse: 'W', members: [
    { qolip_code: 'Q-1', size: 42, color: 'Red', existing_only: false },
    { qolip_code: 'Q-2', size: 0, color: '', existing_only: true },
  ] });
  assert.equal((await api.qolipManagedSets(session))[0].name, 'Red');
  assert.equal(calls[1].target, '/v1/mobile/qolip/sets');
  const malformed = harness(json({ sets: null }));
  await assert.rejects(malformed.api.qolipManagedSets(malformed.session));
});

test('rename collapses whitespace, validates rune length and checks returned set identity', async () => {
  const { api, calls, session } = harness(() => json({ set: rawSet({ name: 'Hot lunch' }) }));
  assert.equal((await api.qolipRenameSet(session, 'S-1', ' Hot   lunch ')).name, 'Hot lunch');
  assert.deepEqual(JSON.parse(calls[0].init.body), { set_id: 'S-1', name: 'Hot lunch' });
  for (const name of ['', '  ', 'x\u0001y', '😀'.repeat(161)]) {
    await assert.rejects(api.qolipRenameSet(session, 'S-1', name), error => error.code === 'qolip_set_name_invalid');
  }
  assert.equal(calls.length, 1);
  const mismatch = harness(json({ set: rawSet({ set_id: 'S-2' }) }));
  await assert.rejects(mismatch.api.qolipRenameSet(mismatch.session, 'S-1', 'name'), error => error.code === 'qolip_set_changed');
});

test('resolve uses the identifier query and returns null for a missing set', async () => {
  const { api, calls, session } = harness(index => json({ set: index === 1 ? rawSet() : null }));
  assert.equal((await api.qolipResolveSet(session, ' Q-1 ')).id, 'S-1');
  assert.equal(calls[0].target, '/v1/mobile/qolip/shared-sets?identifier=Q-1');
  assert.equal(await api.qolipResolveSet(session, 'missing'), null);
});

test('reuse validates fingerprint and preserves physical mold with target product identity', async () => {
  const { api, calls, applied, session } = harness(json({ set: rawSet() }));
  const set = api.qolipSharedSetFromJson(rawSet());
  const product = productParser.qolipProductFromJson({ code: 'TARGET', name: 'Target', item_group: 'Finished', first_qolip_code: '' });
  const reused = await api.qolipReuseSet(session, set, product);
  assert.deepEqual(JSON.parse(calls[0].init.body), { set_id: 'S-1', item_code: 'TARGET', fingerprint: 'fp-1' });
  assert.equal(reused[0].code, 'TARGET');
  assert.equal(reused[0].warehouse, 'W');
  assert.equal(reused[0].first_qolip_code, 'Q-1');
  assert.equal(applied.length, 1);
  const mismatch = harness(json({ set: rawSet({ fingerprint: 'changed' }) }));
  await assert.rejects(mismatch.api.qolipReuseSet(mismatch.session, set, product), error => error.code === 'qolip_set_changed');
  assert.equal(mismatch.applied.length, 0);
  await assert.rejects(api.qolipReuseSet(session, { ...set, members: [] }, product), error => error.code === 'qolip_set_changed');
});

test('edit sends fingerprint and raw removal list, then applies current-account delta', async () => {
  const { api, calls, applied, session } = harness(json({ set: rawSet() }));
  const current = api.qolipManagedSetFromJson(rawSet());
  await api.qolipEditSet(session, { current, add: [{ code: ' New ', size: 7, color: ' Blue ' }], remove: [' Q-1 '] });
  assert.deepEqual(JSON.parse(calls[0].init.body), { set_id: 'S-1', fingerprint: 'fp-1',
    add: [{ qolip_code: 'New', size: 7, color: 'Blue', existing_only: false }], remove: [' Q-1 '] });
  assert.equal(applied.length, 1);
});

test('product mold edits group case-sensitive item codes and deduplicate exact mold codes', async () => {
  const { api, calls, applied, session } = harness(() => json({ ok: true }));
  const item = productParser.qolipProductFromJson({ code: 'ITEM', warehouse: ' W ', qolip_code: 'Q-1' });
  await api.qolipAddProductMold(session, item, { code: ' Q-2 ', size: 40, color: ' Red ', existingOnly: true });
  assert.deepEqual(JSON.parse(calls[0].init.body), { changes: [{ item_code: 'ITEM', warehouse: ' W ',
    add: [{ qolip_code: 'Q-2', size: 40, color: 'Red', existing_only: true }] }] });
  assert.equal(await api.qolipRemoveProductMolds(session, [item, item, { ...item, qolip_code: 'q-1' }, { ...item, code: 'item' }]), 3);
  assert.deepEqual(JSON.parse(calls[1].init.body), { changes: [{ item_code: 'ITEM', remove: ['Q-1', 'q-1'] },
    { item_code: 'item', remove: ['Q-1'] }] });
  assert.equal(await api.qolipRemoveProductMolds(session, []), 0);
  assert.deepEqual(JSON.parse(calls[2].init.body), { changes: [] });
  assert.equal(applied.length, 3);
});

test('scope changes do not apply another account catalog and test mode never contacts a backend', async () => {
  const { api, session, applied, calls } = harness(json({ set: rawSet() }), { afterResponse: value => { value.profile.ref = 'other'; } });
  await api.qolipEditSet(session, { current: api.qolipManagedSetFromJson(rawSet()) });
  assert.equal(applied.length, 0);
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipManagedSets(session), /test mode is not yet ported/);
  assert.equal(calls.length, 1);
});
