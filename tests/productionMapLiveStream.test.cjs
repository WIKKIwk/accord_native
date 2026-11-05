const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function socketHarness() {
  const sockets = [], original = global.WebSocket;
  global.WebSocket = class {
    constructor(url) { this.url = new URL(url); this.closed = false; sockets.push(this); }
    emit(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    close() { if (!this.closed) { this.closed = true; this.onclose?.(); } }
  };
  return { sockets, restore: () => { global.WebSocket = original; } };
}
function api() { return load('productionMapLiveStream', {
  './authorizedFetch': {}, './auth': { activeSessionToken: session => session.active === false ? null : session.token },
}); }
const session = () => ({ token: 'token', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } });

test('older backend v2 response falls back to v1 before publishing a snapshot', async () => {
  const h = socketHarness();
  try {
    const client = api(), messages = [], errors = [];
    const cancel = client.adminProductionMapLiveStream(session(), { stateDelta: true, queueLimit: 5, epoch: 'server', revision: 8, scope: 'scope-five' })
      .subscribe(message => messages.push(message), error => errors.push(error));
    await Promise.resolve();
    assert.equal(h.sockets[0].url.searchParams.get('protocol'), 'state_delta_v2');
    h.sockets[0].emit({ ok: true, type: 'snapshot', maps: [] });
    assert.equal(h.sockets.length, 2);
    assert.equal(h.sockets[1].url.searchParams.get('protocol'), 'state_delta_v1');
    assert.equal(h.sockets[1].url.searchParams.get('scope'), 'scope-five');
    assert.equal(messages.length, 0);
    h.sockets[1].emit({ ok: true, type: 'state_ready', epoch: 'server', rev: 8, scope: 'scope-five', recovered: true, recovery_supported: true });
    assert.equal(messages[0].scope, 'scope-five');
    assert.equal(messages[0].recovered, true);
    assert.deepEqual(errors, []);
    cancel();
    assert.equal(h.sockets[1].closed, true);
  } finally { h.restore(); }
});

test('paged admin requires cursor-bearing delta and refuses full snapshots', () => {
  const client = api();
  assert.throws(() => client.decodeProductionMapLiveMessage({ ok: true, type: 'snapshot' }, { paged: true }), error => error.code === 'paged_live_required');
  assert.throws(() => client.decodeProductionMapLiveMessage({ ok: true, type: 'delta' }, { paged: true }), error => error.code === 'production_map_snapshot_contract_invalid');
  const ready = client.decodeProductionMapLiveMessage({ ok: true, type: 'page_ready', epoch: 'server', rev: 1 }, { paged: true });
  assert.equal(ready.ready, true);
  const delta = client.decodeProductionMapLiveMessage({ ok: true, type: 'delta', epoch: 'server', snapshot_rev: 9,
    apparatus: 'apparatus:default:bosma_8', base_revision: 1, revision: 2, ops: [{ type: 'move', id: 'first', after_id: 'second' }] }, { paged: true });
  assert.equal(delta.snapshot_revision, 9);
  assert.equal(delta.ops[0].after_id, 'second');
});

test('retained stream never opens for a different account and closes on account change', async () => {
  const h = socketHarness();
  try {
    const client = api(), first = session(), errors = [];
    const retained = client.adminProductionMapLiveStream(first, { stateDelta: true });
    first.token = 'other';
    retained.subscribe(() => {}, error => errors.push(error));
    await Promise.resolve();
    assert.equal(h.sockets.length, 0);
    assert.equal(errors[0].code, 'session_changed');
    const next = session();
    client.adminProductionMapLiveStream(next, { stateDelta: true }).subscribe(() => {}, error => errors.push(error));
    await Promise.resolve();
    next.token = 'other';
    h.sockets[0].emit({ ok: true, type: 'snapshot' });
    assert.equal(errors.at(-1).code, 'session_changed');
    assert.equal(h.sockets.length, 1);
    assert.equal(h.sockets[0].closed, true);
  } finally { h.restore(); }
});

test('state delta validates patch fields and negotiated compact format', () => {
  const { decodeProductionMapLiveMessage: decode } = api();
  const valid = { ok: true, type: 'state_delta', protocol: 'state_delta_v2', epoch: 'e', base_rev: 1, rev: 2, patch: {} };
  assert.equal(decode(valid, { stateDelta: true, compact: true }).revision, 2);
  assert.throws(() => decode({ ...valid, patch: { unknown: {} } }, { stateDelta: true, compact: true }),
    error => error.code === 'production_map_snapshot_contract_invalid');
  assert.throws(() => decode({ ...valid, patch: { map_order: [], map_order_edit: {} } }, { stateDelta: true, compact: true }),
    error => error.code === 'production_map_snapshot_contract_invalid');
});

test('page window messages retain their wire value and expose the V2 revision', () => {
  const { decodeProductionMapLiveMessage: decode } = api();
  const event = { ok: true, type: 'page_window_checkpoint', window: 'window', epoch: 'server', rev: 7, version: 'v1',
    next_cursors: [null] };
  const result = decode(event, { paged: true });
  assert.equal(result.revision, 7);
  assert.equal(result.window, 'window');
  assert.equal(result.value, event);
  assert.throws(() => decode({ ...event, rev: -1 }, { paged: true }), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('a live decoding error reaches the subscriber before stream completion', async () => {
  const h = socketHarness();
  try {
    const events = [];
    api().adminProductionMapLiveStream(session(), { paged: true }).subscribe(() => events.push('message'),
      error => events.push(error.code), () => events.push('done'));
    await Promise.resolve();
    h.sockets[0].emit({ ok: true, type: 'snapshot' });
    assert.deepEqual(events, ['paged_live_required', 'done']);
    assert.equal(h.sockets[0].closed, true);
  } finally { h.restore(); }
});

test('legacy full stream snapshots pass through the canonical queue decoder', () => {
  const { loadContract } = require('./support/contractFetch.cjs');
  const row = loadContract('order_scan_bootstrap_api_test').find(x => x.test === 'bootstrap decodes context and QR proof in one authorized request');
  const context = JSON.parse(row.responseBody.text).queue_context;
  const { decodeProductionMapLiveMessage: decode } = api();
  assert.equal(decode({ ...context, type: 'snapshot' }, {}).maps[0].map.id, 'zakaz-scan-bootstrap');
  assert.throws(() => decode({ ...context, type: 'snapshot', queue_policies: null }, {}), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('paused live subscriptions buffer messages and completion in order', async () => {
  const h = socketHarness();
  try {
    const messages = [], errors = [], done = [];
    const subscription = api().adminProductionMapLiveStream(session(), { paged: true })
      .subscribe(message => messages.push(message.revision), error => errors.push(error), () => done.push(true));
    subscription.pause();
    await Promise.resolve();
    h.sockets[0].emit({ ok: true, type: 'page_ready', epoch: 'server', rev: 1 });
    h.sockets[0].emit({ ok: true, type: 'page_invalidated', epoch: 'server', rev: 2 });
    h.sockets[0].close();
    assert.deepEqual(messages, []); assert.deepEqual(done, []);
    subscription.resume();
    assert.deepEqual(messages, [1, 2]); assert.deepEqual(done, [true]); assert.deepEqual(errors, []);
    subscription();
  } finally { h.restore(); }
});


test('cancellation before asynchronous setup does not open a live socket', async () => {
  const h = socketHarness();
  try {
    const cancel = api().adminProductionMapLiveStream(session(), {}).subscribe(() => {}, () => {});
    cancel();
    await Promise.resolve();
    assert.equal(h.sockets.length, 0);
  } finally { h.restore(); }
});
