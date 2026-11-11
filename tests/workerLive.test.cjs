const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  mocks = { './workerLegacyState': {}, './workerLiveTransport': { openWorkerLiveSocket: (_session, url) => new WebSocket(url) },
    './workerQueueReadError': require('./support/workerQueueTransport.cjs').loader()('workerQueueReadError'), ...mocks };
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

test('worker live URI keeps the V2 cursor and complete search text', () => {
  const sockets = [];
  const original = global.WebSocket;
  global.WebSocket = class {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.onclose?.(); }
  };
  try {
    const live = load('workerLive', {
      'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      './workerDelta': { applyWorkerDelta: () => null, workerSnapshotCursor: value => value ?? null },
      './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 },
      './workerLiveUri': load('workerLiveUri'),
      './auth': { activeSessionToken: session => session.token },
      './sessionReadScope': load('sessionReadScope'),
    });
    const session = { baseUrl: 'https://example.test', token: 'mock-token' };
    const search = 'x'.repeat(130);
    const stop = live.subscribeWorkerLive(session, ` ${search} `, () => {}, undefined,
      () => ({ epoch: 'e', scope: 's', rev: 8 }), undefined, 5);
    const url = new URL(sockets[0].url);
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.searchParams.get('queue_search'), search);
    assert.equal(url.searchParams.get('epoch'), 'e');
    assert.equal(url.searchParams.get('scope'), 's');
    assert.equal(url.searchParams.get('rev'), '8');
    assert.equal(url.searchParams.get('projection'), 'worker_list_v1');
    stop();
    const stopEmpty = live.subscribeWorkerLive(session, '', () => {});
    const empty = new URL(sockets[1].url);
    assert.equal(empty.searchParams.get('epoch'), '');
    assert.equal(empty.searchParams.get('scope'), '');
    assert.equal(empty.searchParams.has('rev'), false);
    stopEmpty();
  } finally { global.WebSocket = original; }
});

test('worker live ignores stale accounts and already applied revisions', () => {
  const sockets = [], original = global.WebSocket;
  let applied = 0, invalidated = 0;
  global.WebSocket = class {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; this.onclose?.(); }
  };
  try {
    const live = load('workerLive', {
      'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      './workerDelta': { applyWorkerDelta: () => { applied++; return {}; }, workerSnapshotCursor: value => value ?? null },
      './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerLiveUri': load('workerLiveUri'),
      './auth': { activeSessionToken: session => session.active ? session.token : null }, './sessionReadScope': load('sessionReadScope'),
    });
    const session = { baseUrl: 'https://example.test', token: 'mock-token', active: true, profile: { role: 'aparatchi', ref: 'one' } };
    const stop = live.subscribeWorkerLive(session, '', () => { invalidated++; }, undefined,
      () => ({ epoch: 'e', scope: 's', rev: 8 }), () => {});
    sockets[0].onmessage({ data: JSON.stringify({ ok: true, type: 'state_delta', protocol: 'state_delta_v2', epoch: 'e', scope: 's', base_rev: 7, rev: 8, patch: {} }) });
    assert.equal(applied, 0);
    assert.equal(invalidated, 0);
    session.profile.ref = 'other';
    sockets[0].onmessage({ data: JSON.stringify({ ok: true, type: 'state_delta', protocol: 'state_delta_v2', epoch: 'e', scope: 's', base_rev: 8, rev: 9, patch: {} }) });
    assert.equal(sockets[0].closed, true);
    assert.equal(applied, 0);
    stop();
    session.active = false;
    const stopInactive = live.subscribeWorkerLive(session, '', () => {});
    assert.equal(sockets.length, 1);
    stopInactive();
  } finally { global.WebSocket = original; }
});

// V2 test/worker_queue_window_api_test.dart: live URI assertions.
test('V2 live URI switches worker, admin, legacy and page options', () => {
  const { adminProductionMapLiveUri: uri } = load('workerLiveUri');
  for (const queueLimit of [5, 0]) {
    const worker = uri('https://example.test', ' token ', { stateDelta: true, queueLimit, queueSearch: ' old order ' });
    assert.equal(worker.searchParams.get('queue_limit'), String(queueLimit));
    assert.equal(worker.searchParams.get('queue_positions'), 'true');
    assert.equal(worker.searchParams.get('queue_search'), 'old order');
    assert.equal(worker.searchParams.get('worker_scope'), 'true');
    assert.equal(worker.searchParams.get('protocol'), 'state_delta_v2');
    const admin = uri('https://example.test', 'token', { stateDelta: true, workerScope: false, queueLimit });
    assert.equal(admin.searchParams.has('queue_positions'), false);
  }
  const legacy = uri('https://example.test', 'token', { delta: true });
  assert.equal(legacy.searchParams.has('queue_limit'), false);
  assert.equal(legacy.searchParams.has('queue_positions'), false);
  const page = uri('https://example.test', 'token', { stateDelta: true, pageWindows: [{ id: 'one' }] });
  assert.equal(page.searchParams.get('protocol'), 'page_delta_v1');
  assert.equal(page.searchParams.get('pages'), '[{"id":"one"}]');
  assert.throws(() => uri('https://example.test', '  '), /No session token/);
});
