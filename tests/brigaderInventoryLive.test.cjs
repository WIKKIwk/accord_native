const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, scheduler, flush } = require('./adminUsersSupport.cjs');
const guard = load('shared/camera/synchronousGuard'), uri = load('admin/dartUri');
const { InventoryViewQuery } = load('shared/inventoryViewQuery', { '../inventoryModels': {} });

function fixture({ available = true, isCurrent, opening } = {}) {
  const listeners = new Set(), observers = new Set(), resets = new Set(), calls = [], events = [], clock = scheduler();
  let active = true, allowed = true, serial = 0;
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'brigader', ref: 'leader' }, capabilities: ['brigader.access'] };
  const native = { addListener: (_name, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; },
    openInventory(origin, target) { const id = String(++serial); calls.push(['open', origin, target]); opening?.({ id, emit, retire: () => { allowed = false; } }); return id; },
    stop: id => calls.push(['stop', id]) };
  const api = load('brigader/brigaderInventoryLive', {
    '../../modules/accord-production-live/src/AccordProductionLiveModule': { productionLiveNativeModule: () => available ? native : null },
    '../auth': { activeSessionToken: () => active ? session.token : null,
      subscribeSessionWitness: callback => { observers.add(callback); return () => observers.delete(callback); },
      registerSessionResetHook: callback => { resets.add(callback); return () => resets.delete(callback); } },
    '../admin/dartJsonString': strings, '../admin/dartUri': uri, '../shared/camera/synchronousGuard': guard,
  });
  function emit(event) { for (const listener of [...listeners]) listener(event); }
  const handlers = { message: value => events.push(value), error: error => events.push(['error', error.message]), done: () => events.push('done') };
  return { api, session, native, events, calls, observers, resets, listeners, emit, clock, handlers,
    open: (query = InventoryViewQuery.locations(), version = null) => api.subscribeBrigaderInventoryLive(session, query, version,
      isCurrent ?? (() => allowed), handlers, { schedule: clock.set, cancel: clock.clear }),
    retire: () => { allowed = false; }, restore: () => { allowed = true; }, signOut: () => { active = false; } };
}

test('Inventory URI preserves source subscription query, resumed version, token encoding and fixed endpoint', () => {
  const f = fixture(); f.session.token = "\u0085 a b+!'\ud800 \u0085";
  const query = InventoryViewQuery.assets({ warehouseId: ' Warehouse ', query: 'PET & PP', includeOrderAssignment: true, limit: 50 });
  const value = f.api.brigaderInventoryLiveUri(f.session, query, 'version:2'), parsed = new URL(value);
  assert.equal(parsed.protocol, 'wss:'); assert.equal(parsed.host, 'server.example'); assert.equal(parsed.pathname, '/v1/mobile/admin/inventory/live');
  assert.deepEqual([...parsed.searchParams.keys()], ['token', 'subscriptions']);
  assert.equal(parsed.searchParams.get('token'), "a b+!'\ufffd");
  assert.deepEqual(JSON.parse(parsed.searchParams.get('subscriptions')), [{ id: 'window', kind: 'assets', query: {
    warehouse_id: 'Warehouse', query: 'PET & PP', include_order_assignment: true, limit: 50 }, version: 'version:2' }]);
  assert.match(value, /token=a\+b%2B%21%27%EF%BF%BD&subscriptions=/);
  assert.deepEqual(JSON.parse(new URL(f.api.brigaderInventoryLiveUri(f.session, InventoryViewQuery.locations(), null)).searchParams.get('subscriptions')),
    [{ id: 'window', kind: 'locations', query: {} }]);
  for (const baseUrl of ['http://server.example', 'https://server.example/', 'https://user:secret@server.example', 'https://server.example/path', 'https://server.example?query']) {
    f.session.baseUrl = baseUrl; assert.throws(() => f.api.brigaderInventoryLiveUri(f.session, query, null), /Invalid inventory live origin/);
  }
});

test('dedicated native method is required, test sessions and asynchronous guards never open an unisolated socket', async () => {
  const absent = fixture({ available: false }); assert.throws(absent.open, /native transport unavailable/);
  const old = fixture(); delete old.native.openInventory; assert.throws(old.open, /native transport unavailable/); assert.deepEqual(old.calls, []);
  const demo = fixture(); demo.session.token = 'test-mode-token'; assert.throws(demo.open, /session token/); assert.deepEqual(demo.calls, []);
  const invalid = fixture({ isCurrent: () => Promise.reject(Error('async')) }); assert.throws(invalid.open, /session changed/); await flush(); assert.deepEqual(invalid.calls, []);
});

test('single native socket forwards only its opened text maps and cleanup removes all original account observers', () => {
  const f = fixture(), stop = f.open();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], 'open'); assert.equal(f.listeners.size, 1);
  f.emit({ session: 'foreign', type: 'open', value: '' }); f.emit({ session: '1', type: 'message', value: '{"event":"before-open"}' });
  assert.deepEqual(f.events, []); f.emit({ session: '1', type: 'open', value: '' });
  f.emit({ session: '1', type: 'message', value: new Uint8Array([1]) });
  f.emit({ session: '1', type: 'message', value: '{"event":"inventory.snapshot","id":"window","version":"v1","rows":[]}' });
  assert.deepEqual(f.events, [{ event: 'inventory.snapshot', id: 'window', version: 'v1', rows: [] }]);
  stop(); stop(); assert.equal(f.calls.filter(call => call[0] === 'stop').length, 1);
  assert.equal(f.listeners.size, 0); assert.equal(f.observers.size, 0); assert.equal(f.resets.size, 0); assert.equal(f.clock.size(), 0);
});

test('native errors/non-map JSON end once without an adapter retry or poll loop', () => {
  for (const value of ['invalid', 'null', '[]', '1', '"text"']) {
    const f = fixture(); f.open(); f.emit({ session: '1', type: 'open', value: '' });
    f.emit({ session: '1', type: 'message', value }); f.emit({ session: '1', type: 'close', value: '' });
    assert.deepEqual(f.events, [['error', 'Inventory live transport failed'], 'done']); assert.equal(f.clock.size(), 0);
    f.clock.advance(60000); assert.equal(f.calls.filter(call => call[0] === 'open').length, 1);
  }
  const f = fixture(); f.open(); f.emit({ session: '1', type: 'error', value: '' }); f.emit({ session: '1', type: 'close', value: '' });
  assert.deepEqual(f.events, [['error', 'Inventory live transport failed'], 'done']);
  const clean = fixture(); clean.open(); clean.emit({ session: '1', type: 'close', value: '' }); assert.deepEqual(clean.events, ['done']);
});

test('source10s handshake deadline cancels stalled setup; established connections retain store-owned heartbeat timing', () => {
  const f = fixture(); f.open(); f.clock.advance(9999); assert.deepEqual(f.events, []); f.clock.advance(1);
  assert.deepEqual(f.events, [['error', 'Inventory live transport failed'], 'done']); assert.deepEqual(f.calls.at(-1), ['stop', '1']);
  const live = fixture(), stop = live.open(); live.emit({ session: '1', type: 'open', value: '' }); assert.equal(live.clock.size(), 0);
  live.clock.advance(100000); assert.deepEqual(live.events, []); stop();
});

test('retired original scope, token refresh and reset cancel sockets before late callbacks can publish', async () => {
  for (const invalidate of [f => f.retire(), f => f.signOut(), f => { f.session.token = 'refreshed-token'; }]) {
    const f = fixture(); f.open(); f.emit({ session: '1', type: 'open', value: '' }); invalidate(f);
    for (const observer of [...f.observers]) observer(); f.restore();
    f.emit({ session: '1', type: 'message', value: '{"event":"late"}' }); assert.deepEqual(f.events, []);
    assert.deepEqual(f.calls.at(-1), ['stop', '1']); assert.equal(f.listeners.size, 0);
  }
  const f = fixture(); f.open(); await Promise.all([...f.resets].map(reset => reset()));
  assert.deepEqual(f.calls.at(-1), ['stop', '1']); assert.equal(f.observers.size, 0); assert.equal(f.resets.size, 0);
});

test('synchronous bridge events wait for their owned ID and cancellation during open stops its late native ID exactly once', () => {
  const f = fixture({ opening: ({ id, emit }) => {
    emit({ session: id, type: 'open', value: '' }); emit({ session: id, type: 'message', value: '{"event":"inventory.ready"}' });
  } }); const stop = f.open(); assert.deepEqual(f.events, [{ event: 'inventory.ready' }]); stop();
  const retired = fixture({ opening: ({ retire }) => retire() }); retired.open();
  assert.equal(retired.calls.filter(call => call[0] === 'stop').length, 1); assert.equal(retired.listeners.size, 0); assert.equal(retired.clock.size(), 0);
});
