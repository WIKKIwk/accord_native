const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/preparation/preparationOrdersLive.ts'), mod = new Module(filename, module);
mod.require = id => id === '../auth' ? { activeSessionToken: s => s.token } : id === '../sessionReadScope' ? { sessionReadScope: s => s.scope } :
  id === '../workerControlsApi' ? { WorkerControlException: class extends Error { constructor(code, message) { super(message); this.code = code; } } } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
const original = global.WebSocket;
class Socket { constructor(url) { this.url = url; Socket.current = this; } close() { this.closed = true; } }
test('live subscription sends the scoped V2 cursor and stops on account change', () => {
  global.WebSocket = Socket;
  try {
    const events = [], errors = [], session = { baseUrl: 'https://mini-rs-erp-test.wspace.sbs', token: 'secret', scope: 'A' };
    const window = { apparatus_id: 'apparatus:default:bosma_7', epoch: 'epoch', scope: 'server-scope', version: 'v1', rev: 7, rows: [1, 2] };
    const stop = mod.exports.subscribePreparationOrdersLive(session, window, { search: 'term', length: 30 }, value => events.push(value), error => errors.push(error), () => {});
    const ws = Socket.current, url = new URL(ws.url);
    assert.equal(url.protocol, 'wss:'); assert.equal(url.pathname, '/v1/mobile/preparation/orders/live');
    assert.equal(url.searchParams.get('apparatus'), window.apparatus_id); assert.equal(url.searchParams.get('version'), 'v1');
    assert.equal(url.searchParams.get('rev'), '7'); assert.equal(url.searchParams.get('length'), '30');
    ws.onopen(); ws.onmessage({ data: '{"type":"checkpoint","rev":8}' }); assert.equal(events[0].rev, 8);
    session.scope = 'B'; ws.onmessage({ data: '{}' }); assert.equal(errors[0].code, 'session_changed'); assert.equal(ws.closed, true); stop();
  } finally { global.WebSocket = original; }
});
