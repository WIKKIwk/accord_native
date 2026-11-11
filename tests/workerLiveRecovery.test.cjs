const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, clock } = require('./support/workerQueueTransport.cjs');
const { loadContract } = require('./support/contractFetch.cjs');
const fixture = () => JSON.parse(loadContract('worker_list_api_test').find(item => item.test.startsWith('worker HTTP and v2 socket')).responseBody.text);
function setup(options = {}) {
  const timer = clock(), sockets = [], snapshots = [], errors = [], ready = [], connections = []; let invalidated = 0, current = true, stateListener;
  let snapshot = fixture();
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'worker', role: 'aparatchi' } };
  const load = loader({ './auth': { activeSessionToken: s => s.token }, './authorizedFetch': {},
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, listener) => { stateListener = listener; return { remove() {} }; } } },
    './workerLiveTransport': { openWorkerLiveSocket: (_s, url) => {
      const socket = { url, close() { this.closed = true; this.onclose?.(); }, message(value) { this.onmessage?.({ data: JSON.stringify(value) }); } };
      sockets.push(socket); return socket;
    } },
  });
  const stop = load('workerLive').subscribeWorkerLive(session, '', () => invalidated++, value => connections.push(value),
    () => snapshot, value => { snapshot = value; snapshots.push(value); }, 10,
    { isCurrent: () => current, onReady: value => ready.push(value), onError: error => errors.push(error), ...options });
  return { timer, sockets, snapshots, errors, ready, connections, stop, session,
    get invalidated() { return invalidated; }, setCurrent(value) { current = value; }, state: value => stateListener?.(value),
    readyMessage(extra = {}) { sockets.at(-1).message({ ok: true, protocol: 'state_delta_v2', type: 'state_ready',
      epoch: snapshot.epoch, scope: snapshot.scope, rev: snapshot.rev, recovered: true, recovery_supported: true, ...extra }); },
    close() { stop(); timer.restore(); },
  };
}

test('matching ready certifies cached authority without HTTP; quiet healthy stream never reconnects', () => {
  const h = setup(); try {
    h.readyMessage(); assert.equal(h.ready.length, 1); assert.equal(h.invalidated, 0);
    h.timer.advance(120000); assert.equal(h.sockets.length, 1); assert.equal(h.errors.length, 0);
  } finally { h.close(); }
});

test('first message timeout retires authority before reconnect; silent open does not hang forever', () => {
  const h = setup(); try {
    h.timer.advance(10000); assert.equal(h.errors.length, 1); assert.equal(h.errors[0].name, 'TimeoutError');
    assert.deepEqual(h.connections, [false]); assert.equal(h.sockets[0].closed, true);
    h.timer.advance(1000); assert.equal(h.sockets.length, 2);
  } finally { h.close(); }
});

test('terminal errors stop reconnect and preserve structured code; transient close reconnects', () => {
  const h = setup(); try {
    h.sockets[0].message({ ok: false, error: 'forbidden' });
    assert.equal(h.errors[0].code, 'forbidden'); h.timer.advance(100000);
    assert.equal(h.sockets.length, 1);
  } finally { h.close(); }
  const retry = setup(); try {
    retry.readyMessage(); retry.sockets[0].onclose(); assert.equal(retry.errors.length, 1);
    retry.timer.advance(1000); assert.equal(retry.sockets.length, 2);
  } finally { retry.close(); }
});

test('cursor gaps invalidate once and stop retrying HTTP when caller has no more events', () => {
  const h = setup(); try {
    h.readyMessage({ resync: true }); h.readyMessage({ resync: true });
    h.timer.advance(100); assert.equal(h.invalidated, 1);
    h.timer.advance(60000); assert.equal(h.invalidated, 1);
  } finally { h.close(); }
});

test('scope and owner expiry reject late messages; app inactive does not disconnect but background does', () => {
  const h = setup(); try {
    h.readyMessage(); h.state('inactive'); assert.equal(h.sockets[0].closed, undefined);
    h.state('background'); assert.equal(h.sockets[0].closed, true);
    h.timer.advance(60000); assert.equal(h.sockets.length, 1);
    h.state('active'); assert.equal(h.sockets.length, 2);
    h.setCurrent(false); h.readyMessage(); assert.equal(h.ready.length, 1);
    h.timer.advance(60000); assert.equal(h.sockets.length, 2);
  } finally { h.close(); }
});

test('unsupported compact stream negotiates v1 immediately and applies real canonical state deltas', () => {
  const h = setup(); try {
    h.sockets[0].message({ ok: true, type: 'snapshot', maps: [] });
    assert.equal(h.sockets.length, 2); assert.equal(new URL(h.sockets[1].url).searchParams.get('protocol'), 'state_delta_v1');
    assert.equal(h.errors.length, 0);
    const fullRecord = loadContract('worker_list_api_test').find(record => record.test.startsWith('worker single detail'));
    const full = JSON.parse(fullRecord.responseBody.text);
    Object.assign(full, { ok: true, type: 'snapshot', scope: 'legacy-scope', rev: 7, queue_action_controls: {},
      completed_orders: [], completion_requests: [], completion_request_decisions: [] });
    h.sockets[1].message(full); assert.equal(h.snapshots.length, 1);
    const station = Object.keys(full.queue_states)[0], order = Object.keys(full.queue_states[station])[0];
    h.sockets[1].message({ ok: true, type: 'state_delta', protocol: 'state_delta_v1', epoch: full.epoch,
      scope: full.scope, base_rev: 7, rev: 8, patch: { queue_states: { scopes: { [station]: { upsert: { [order]: 'paused' }, remove: [] } }, remove: [] } } });
    assert.equal(h.snapshots.length, 2); assert.equal(h.snapshots[1].rev, 8);
    assert.equal(h.snapshots[1].queue_states[station][order], 'paused');
    assert.equal(h.invalidated, 0);
  } finally { h.close(); }
});

test('explicit unsupported protocol response falls back once; malformed typed delta is terminal', () => {
  const h = setup(); try {
    h.sockets[0].message({ ok: false, error: 'state_delta_v2_unsupported' });
    assert.equal(h.sockets.length, 2);
    assert.equal(new URL(h.sockets[1].url).searchParams.get('projection'), null);
    h.sockets[1].message({ ok: true, type: 'state_delta', protocol: 'state_delta_v1', epoch: 'server',
      scope: 'scope', base_rev: 1, rev: 2, patch: { unknown: {} } });
    assert.equal(h.errors[0].code, 'production_map_snapshot_contract_invalid');
    h.timer.advance(60000); assert.equal(h.sockets.length, 2);
  } finally { h.close(); }
});
