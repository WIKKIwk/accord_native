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
function harness() {
  const sockets = [], original = global.WebSocket;
  global.WebSocket = class {
    constructor(url) { this.url = new URL(url); this.closed = false; sockets.push(this); }
    emit(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    close() { if (!this.closed) { this.closed = true; this.onclose?.(); } }
  };
  return { sockets, restore: () => { global.WebSocket = original; } };
}
function api() { return load('productionMapNotifications', {
  './authorizedFetch': {}, './auth': { activeSessionToken: session => session.active === false ? null : session.token },
}); }
const session = () => ({ token: 'token', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } });
const tick = () => new Promise(resolve => queueMicrotask(resolve));

test('notification consumers share a socket, replay latest and close on final unsubscribe', async () => {
  const h = harness();
  try {
    const client = api(), current = session(), one = [], two = [], errors = [];
    const a = client.adminProductionMapNotificationEvents(current).subscribe(value => one.push(value), error => errors.push(error));
    await tick();
    assert.equal(h.sockets.length, 1);
    assert.equal(h.sockets[0].url.searchParams.get('protocol'), 'notifications_v1');
    h.sockets[0].emit({ ok: true, type: 'notifications_snapshot', epoch: 'server', rev: 9, completion_requests: [] });
    const b = client.adminProductionMapNotificationEvents(current).subscribe(value => two.push(value), error => errors.push(error));
    assert.equal(two.length, 1);
    assert.equal(h.sockets.length, 1);
    a();
    h.sockets[0].emit({ ok: true, type: 'notifications_snapshot', epoch: 'server', rev: 10, completion_requests: [] });
    assert.equal(one.length, 1);
    assert.equal(two.length, 2);
    b();
    assert.equal(h.sockets[0].closed, true);
    assert.deepEqual(errors, []);
  } finally { h.restore(); }
});

test('notification stream refuses an account change before setup and while active', async () => {
  const h = harness();
  try {
    const client = api(), current = session(), errors = [];
    const stream = client.adminProductionMapNotificationEvents(current);
    stream.subscribe(() => {}, error => errors.push(error));
    current.token = 'other';
    await tick();
    assert.equal(h.sockets.length, 0);
    assert.equal(errors[0].code, 'session_changed');
    const next = session();
    client.adminProductionMapNotificationEvents(next).subscribe(() => {}, error => errors.push(error));
    await tick();
    next.profile.ref = 'changed';
    h.sockets[0].emit({ ok: true, type: 'notifications_snapshot', epoch: 'server', rev: 1, completion_requests: [] });
    assert.equal(errors.at(-1).code, 'session_changed');
    assert.equal(h.sockets[0].closed, true);
  } finally { h.restore(); }
});

test('notification events reject invalid cursors and malformed rows', () => {
  const { decodeProductionMapNotifications: decode } = api();
  assert.throws(() => decode({ ok: true, type: 'notifications_snapshot', epoch: '', rev: 1, completion_requests: [] }),
    error => error.code === 'production_map_snapshot_contract_invalid');
  assert.throws(() => decode({ ok: true, type: 'notifications_snapshot', epoch: 'e', rev: 1, completion_requests: [null] }));
});
