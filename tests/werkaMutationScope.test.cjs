// Exercises real authorizedFetch retry behavior with fake sessions and a local fetch double. No server is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const src = path.resolve(__dirname, '../src');
const fakeSession = ref => ({ baseUrl: 'https://example.invalid', token: `fake-${ref}`, profile: { role: 'werka', ref },
  capabilities: ['werka.access'], assigned_apparatus: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: ref });
function setup(changeOnRefresh) {
  let active = fakeSession('A'), refreshes = 0, epoch = 0;
  const auth = { currentSession: () => active, activeSessionEpoch: session => session === active ? epoch : null,
    activeSessionToken: session => session === active ? session.token : null,
    refreshSession: async session => { refreshes++; changeOnRefresh?.(session); return true; } };
  const cache = new Map();
  function load(file) {
    const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
    if (cache.has(resolved)) return cache.get(resolved);
    const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
    module.require = name => name === './auth' || name === '../auth' ? auth
      : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name)) : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
    module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
    cache.set(resolved, module.exports); return module.exports;
  }
  return { get session() { return active; }, switchTo: value => { active = value; }, advanceEpoch: () => { epoch++; }, get refreshes() { return refreshes; },
    issue: load(`${src}/werka/werkaIssueApi.ts`), records: load(`${src}/werka/werkaRecordApi.ts`), paddon: load(`${src}/werka/werkaPaddonApi.ts`) };
}
const operations = [
  (api, s) => api.issue.createWerkaUnannouncedDraft(s, { supplierRef: 's', itemCode: 'i', qty: 1 }),
  (api, s) => api.issue.createWerkaCustomerIssue(s, { customerRef: 'c', itemCode: 'i', qty: 1 }),
  (api, s) => api.issue.createWerkaCustomerIssueBatch(s, 'batch', [{ customerRef: 'c', itemCode: 'i', qty: 1 }]),
  (api, s) => api.records.confirmReceipt(s, { receiptID: 'r', acceptedQty: 1 }),
  (api, s) => api.paddon.werkaReceivePaddon(s, { snapshot: { paddon: { code: 'p' }, items: [{ batch_id: 'b' }] }, snapshotToken: 'token' }, 'W'),
  (api, s) => api.paddon.werkaReceiveWip(s, { batch: { batch_id: 'b', qr_payload: 'qr' }, snapshotToken: 'token' }, 'W'),
];
test('all Werka writes stop a 401 retry if refreshed permission changed', async () => {
  const original = globalThis.fetch;
  try {
    for (const operation of operations) {
      const api = setup(session => { session.capabilities = []; }); let sends = 0;
      globalThis.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
      await assert.rejects(operation(api, api.session), error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
      assert.equal(sends, 1); assert.equal(api.refreshes, 1);
    }
  } finally { globalThis.fetch = original; }
});
test('role changes also prevent the retry even if the Werka capability remains', async () => {
  const original = globalThis.fetch, api = setup(session => { session.profile.role = 'customer'; }); let sends = 0;
  try {
    globalThis.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
    await assert.rejects(api.issue.createWerkaCustomerIssue(api.session, { customerRef: 'c', itemCode: 'i', qty: 1 }),
      error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
    assert.equal(sends, 1);
  } finally { globalThis.fetch = original; }
});
test('a 401 reauthentication that retains the exact scope can retry with the refreshed token', async () => {
  const original = globalThis.fetch, api = setup(session => { session.token = 'fake-refreshed'; }); const headers = [];
  try {
    globalThis.fetch = async (_url, init) => {
      headers.push(new Headers(init.headers).get('authorization'));
      return headers.length === 1 ? new Response('{}', { status: 401 }) : new Response('{"id":"r"}', { status: 200 });
    };
    const result = await api.records.confirmReceipt(api.session, { receiptID: 'r', acceptedQty: 1 });
    assert.equal(result.id, 'r'); assert.deepEqual(headers, ['Bearer fake-A', 'Bearer fake-refreshed']);
  } finally { globalThis.fetch = original; }
});
test('missing permission blocks the first send', async () => {
  const original = globalThis.fetch, api = setup(); let sends = 0; api.session.capabilities = [];
  try {
    globalThis.fetch = async () => { sends++; return new Response('{}', { status: 200 }); };
    await assert.rejects(api.records.confirmReceipt(api.session, { receiptID: 'r', acceptedQty: 1 }),
      error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === false);
    assert.equal(sends, 0);
  } finally { globalThis.fetch = original; }
});
test('account switch after send is uncertain and never triggers a second write', async () => {
  const original = globalThis.fetch, api = setup(); let sends = 0, resolve;
  const response = new Promise(done => { resolve = done; });
  try {
    globalThis.fetch = async () => { sends++; return response; };
    const pending = api.records.confirmReceipt(api.session, { receiptID: 'r', acceptedQty: 1 });
    api.switchTo(fakeSession('B')); resolve(new Response('{"id":"r"}', { status: 200 }));
    await assert.rejects(pending); assert.equal(sends, 1);
  } finally { globalThis.fetch = original; }
});
test('account switch during response decoding rejects the old result as potentially sent', async () => {
  const original = globalThis.fetch, api = setup(); let sends = 0, resolveBody, bodyStarted;
  const body = new Promise(done => { resolveBody = done; }), started = new Promise(done => { bodyStarted = done; });
  try {
    globalThis.fetch = async () => { sends++; return { status: 200, json: () => { bodyStarted(); return body; } }; };
    const pending = api.records.confirmReceipt(api.session, { receiptID: 'r', acceptedQty: 1 });
    await started; api.switchTo(fakeSession('B')); resolveBody({ id: 'r' });
    await assert.rejects(pending, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
    assert.equal(sends, 1);
  } finally { globalThis.fetch = original; }
});
test('epoch change on 401 refresh blocks a retry even when the same session object remains active', async () => {
  const original = globalThis.fetch; let sends = 0;
  const api = setup(() => { api.advanceEpoch(); });
  try {
    globalThis.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
    await assert.rejects(api.issue.createWerkaCustomerIssue(api.session, { customerRef: 'c', itemCode: 'i', qty: 1 }),
      error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
    assert.equal(sends, 1); assert.equal(api.refreshes, 1);
  } finally { globalThis.fetch = original; }
});
