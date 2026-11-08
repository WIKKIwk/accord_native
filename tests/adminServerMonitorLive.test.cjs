const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture() {
  const sockets = [], events = [], errors = []; let done = 0;
  class Socket {
    constructor(uri) { this.uri = uri; this.readyState = 0; this.sent = []; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const original = global.WebSocket; global.WebSocket = Socket;
  const dart = load('admin/dartJsonString');
  const model = load('admin/serverMonitorModel', { './dartJsonString': dart });
  const api = load('admin/serverMonitorLive', {
    './serverMonitorApi': { adminServerMonitorLiveUri: () => new URL('wss://example.invalid/live') },
    './serverMonitorModel': model,
  });
  const stop = api.adminServerMonitorLiveEvents({}).subscribe(value => events.push(value), error => errors.push(error), () => done++);
  return { sockets, events, errors, get done() { return done; }, stop, restore() { stop(); global.WebSocket = original; } };
}
const tickMicrotasks = () => Promise.resolve();
// @v2-test test/admin_server_monitor_api_test.dart: live watchdog and pong (f119 oracle passed)
test('live monitor sends an immediate and two-second ping and delivers only report/pong events', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const f = fixture();
  try {
    await tickMicrotasks(); const socket = f.sockets[0]; socket.open();
    assert.deepEqual(socket.sent, [{ type: 'ping', id: 1, sent_at_ms: 1000 }]);
    t.mock.timers.tick(2000);
    assert.deepEqual(socket.sent[1], { type: 'ping', id: 2, sent_at_ms: 3000 });
    socket.onmessage({ data: JSON.stringify({ type: 'noop' }) });
    assert.equal(f.events.length, 0);
    socket.onmessage({ data: JSON.stringify({ type: 'pong', sent_at_ms: 2980 }) });
    assert.equal(f.events[0].latency_ms, 20);
    socket.onmessage({ data: JSON.stringify({ ok: true, server: { status: 'running' } }) });
    assert.equal(f.events[1].report.server.status, 'running');
    assert.equal(f.errors.length, 0);
  } finally { f.restore(); }
});

test('silence watchdog resets on every decoded map and stops the stream at seven seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const f = fixture();
  try {
    await tickMicrotasks(); const socket = f.sockets[0]; socket.open();
    t.mock.timers.tick(6000); socket.onmessage({ data: '{"type":"noop"}' });
    t.mock.timers.tick(6999); assert.equal(f.errors.length, 0);
    t.mock.timers.tick(1); assert.equal(f.errors[0].name, 'TimeoutError');
    assert.equal(f.done, 1); assert.equal(socket.readyState, 3);
  } finally { f.restore(); }
});

test('binary frames are ignored; malformed JSON fails and cancel prevents late callbacks', async () => {
  const f = fixture();
  try {
    await tickMicrotasks(); const socket = f.sockets[0]; socket.open();
    socket.onmessage({ data: new Uint8Array([1]) }); assert.equal(f.events.length, 0);
    socket.onmessage({ data: '[]' }); assert.equal(f.errors.length, 1); assert.equal(f.done, 1);
    assert.equal(socket.readyState, 3);
    f.stop(); assert.equal(socket.onmessage, null);
  } finally { f.restore(); }
});

test('cancelling before asynchronous connection prevents socket creation', async () => {
  const f = fixture();
  try { f.stop(); await tickMicrotasks(); assert.equal(f.sockets.length, 0); assert.equal(f.done, 0); }
  finally { f.restore(); }
});

test('pause buffers events, suspends the silence timer and resumes in order while pings continue', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const f = fixture();
  try {
    await tickMicrotasks(); const socket = f.sockets[0]; socket.open(); f.stop.pause();
    socket.onmessage({ data: '{"type":"pong","sent_at_ms":1000}' });
    socket.onmessage({ data: '{"ok":true,"server":{"status":"running"}}' });
    t.mock.timers.tick(10000);
    assert.equal(f.events.length, 0); assert.equal(f.errors.length, 0); assert.equal(socket.readyState, 1);
    assert.ok(socket.sent.length >= 2);
    f.stop.resume();
    assert.equal(f.events.length, 2); assert.equal(f.events[0].latency_ms, 10000);
    assert.equal(f.events[1].report.server.status, 'running');
    t.mock.timers.tick(7000); assert.equal(f.errors[0].name, 'TimeoutError');
  } finally { f.restore(); }
});

test('nested pause calls require matching resumes and an optional signal resumes once', async () => {
  const f = fixture();
  try {
    await tickMicrotasks(); const socket = f.sockets[0]; socket.open();
    let resolve; const signal = new Promise(done => { resolve = done; });
    f.stop.pause(signal); f.stop.pause();
    socket.onmessage({ data: '{"ok":true,"server":{"status":"running"}}' });
    resolve(); await tickMicrotasks(); assert.equal(f.events.length, 0);
    f.stop.resume(); assert.equal(f.events.length, 1);
  } finally { f.restore(); }
});
