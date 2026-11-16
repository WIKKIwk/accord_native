const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, scheduler, deferred, flush } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), uri = load('admin/dartUri');
const { AdminWarehouseLiveController } = load('admin/adminWarehouseLiveController', { '../shared/camera/synchronousGuard': strict });
function transportFixture({ available = true, current = () => true, onOpen } = {}) {
  const calls = [], listeners = new Set(), resets = new Set(), observers = new Set(), events = [], clock = scheduler();
  let active = true, epoch = 1, scope = 'original', witnessCurrent = true, sequence = 0;
  const session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'owner' } }, witness = { session };
  const native = { addListener: (_name, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
    openWarehouse(origin, target) { const id = String(++sequence); calls.push(['open', origin, target]); onOpen?.({ id, emit, retire: () => { active = false; } }); return id; },
    stop: id => calls.push(['stop', id]) };
  function emit(event) { for (const fn of [...listeners]) fn(event); }
  const auth = { activeSessionEpoch: () => active ? epoch : null, activeSessionToken: () => active ? session.token : null,
    isSessionWitnessCurrent: value => value === witness && witnessCurrent,
    registerSessionResetHook: fn => { resets.add(fn); return () => resets.delete(fn); },
    subscribeSessionWitness: fn => { observers.add(fn); return () => observers.delete(fn); } };
  const api = load('admin/adminWarehouseLiveTransport', {
    '../../modules/accord-production-live/src/AccordProductionLiveModule': { productionLiveNativeModule: () => available ? native : null },
    '../auth': auth, '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminWarehouses: '/warehouses' }, canOpenRoute: () => true },
    '../shared/camera/synchronousGuard': strict, './dartUri': uri, './dartJsonString': strings,
  });
  const original = api.adminWarehouseLiveCurrent(session, witness, current);
  const callbacks = { message: value => events.push(value), error: () => events.push('error'), done: () => events.push('done') };
  return { api, session, witness, native, original, calls, events, listeners, observers, resets, emit, callbacks, clock,
    open: () => api.openAdminWarehouseLive(session, original, callbacks, { schedule: clock.set, cancel: clock.clear }), setEpoch: value => { epoch = value; },
    setScope: value => { scope = value; }, retire: () => { active = false; }, invalidateWitness: () => { witnessCurrent = false; } };
}
test('Warehouse live URI preserves source token encoding and canonical HTTPS origin without exposing tokens in errors', () => {
  const f = transportFixture(); f.session.token = "\u0085 a b+!'\ud800 \u0085";
  assert.equal(f.api.adminWarehouseLiveUri(f.session), 'wss://server.example/v1/mobile/admin/warehouses/live?token=a+b%2B%21%27%EF%BF%BD');
  for (const base of ['http://server.example', 'https://server.example/', 'https://user:secret@server.example', 'https://server.example/path']) {
    f.session.baseUrl = base; assert.throws(() => f.api.adminWarehouseLiveUri(f.session), /Invalid warehouse live origin/);
  }
  f.retire(); assert.throws(() => f.api.adminWarehouseLiveUri(f.session), /No session token/);
});
test('original Warehouse witness permanently retires on epoch, scope, token, witness or async current loss', async () => {
  for (const invalidate of [f => f.setEpoch(2), f => f.setScope('changed'), f => f.retire(), f => f.invalidateWitness()]) {
    const f = transportFixture(); assert.equal(f.original(), true); invalidate(f); assert.equal(f.original(), false);
    f.setEpoch(1); f.setScope('original'); assert.equal(f.original(), false); assert.throws(f.open, /session changed/); assert.deepEqual(f.calls, []);
  }
  const invalid = transportFixture({ current: () => Promise.reject(Error('async')) }); assert.equal(invalid.original(), false); await flush();
});
test('Warehouse uses its dedicated native entry and rejects unavailable older binaries instead of creating an unisolated socket', () => {
  const f = transportFixture(), connection = f.open();
  assert.deepEqual(f.calls, [['open', 'https://server.example', 'wss://server.example/v1/mobile/admin/warehouses/live?token=token']]);
  connection.stop(); connection.stop(); assert.deepEqual(f.calls.at(-1), ['stop', '1']); assert.equal(f.listeners.size, 0); assert.equal(f.resets.size, 0);
  const absent = transportFixture({ available: false }); assert.throws(absent.open, /native transport unavailable/);
  const old = transportFixture(); delete old.native.openWarehouse; assert.throws(old.open, /native transport unavailable/); assert.deepEqual(old.calls, []);
});
test('native connection IDs, text-map decoding, witness updates and reset fence all live publication', async () => {
  const f = transportFixture(); f.open();
  f.emit({ session: 'another', type: 'open', value: '' }); f.emit({ session: '1', type: 'message', value: '{"event":"before-open"}' });
  assert.deepEqual(f.events, []); f.emit({ session: '1', type: 'open', value: '' });
  f.emit({ session: '1', type: 'message', value: '{"event":"warehouse.updated","version":2}' });
  assert.deepEqual(f.events, [{ event: 'warehouse.updated', version: 2 }]);
  f.setScope('changed'); for (const fn of [...f.observers]) fn();
  f.emit({ session: '1', type: 'message', value: '{"event":"late"}' }); assert.equal(f.events.length, 1);
  assert.equal(f.listeners.size, 0); assert.equal(f.resets.size, 0); assert.deepEqual(f.calls.at(-1), ['stop', '1']);
  const reset = transportFixture(); reset.open(); await Promise.all([...reset.resets].map(fn => fn())); assert.deepEqual(reset.calls.at(-1), ['stop', '1']);
});
test('source malformed/non-map JSON fails and ends the stream; native binary/non-string frames do not publish', () => {
  for (const value of ['invalid', 'null', '[]', '1', '"text"']) {
    const f = transportFixture(); f.open(); f.emit({ session: '1', type: 'open', value: '' });
    f.emit({ session: '1', type: 'message', value }); f.emit({ session: '1', type: 'close', value: '' });
    assert.deepEqual(f.events, ['error', 'done']); assert.equal(f.calls.filter(call => call[0] === 'stop').length, 1);
  }
  const f = transportFixture(); f.open(); f.emit({ session: '1', type: 'open', value: '' });
  f.emit({ session: '1', type: 'message', value: new Uint8Array([1]) }); assert.deepEqual(f.events, []);
});
test('synchronous bridge events are queued until the returned connection ID is owned, and retirement stops its late ID once', () => {
  const f = transportFixture({ onOpen: ({ id, emit }) => {
    emit({ session: id, type: 'open', value: '' }); emit({ session: id, type: 'message', value: '{"event":"warehouse.updated"}' });
  } }); f.open(); assert.deepEqual(f.events, [{ event: 'warehouse.updated' }]);
  const stale = transportFixture({ onOpen: ({ retire }) => retire() }); stale.open();
  assert.equal(stale.calls.filter(call => call[0] === 'stop').length, 1); assert.equal(stale.listeners.size, 0); assert.deepEqual(stale.events, []);
});
test('the source10s whole-setup deadline cancels a stalled handshake but never an established socket', () => {
  const stalled = transportFixture(); stalled.open(); stalled.clock.advance(9999); assert.deepEqual(stalled.events, []);
  stalled.clock.advance(1); assert.deepEqual(stalled.events, ['error', 'done']); assert.deepEqual(stalled.calls.at(-1), ['stop', '1']);
  stalled.emit({ session: '1', type: 'open', value: '' }); assert.equal(stalled.listeners.size, 0);
  const live = transportFixture(); const connection = live.open(); live.emit({ session: '1', type: 'open', value: '' });
  assert.equal(live.clock.size(), 0); live.clock.advance(100000); assert.deepEqual(live.events, []); connection.stop();
});

function controllerFixture({ warehouseScoped = false, refresh = async () => {}, connectError = false } = {}) {
  const clock = scheduler(), connections = [], refreshes = [];
  let current = true;
  const controller = new AdminWarehouseLiveController({ isCurrent: () => current, warehouseScoped,
    connect: callbacks => { if (connectError) throw Error('offline'); const connection = { callbacks, stopped: false, stop() { this.stopped = true; } }; connections.push(connection); return connection; },
    refresh: async () => { refreshes.push('refresh'); await refresh(); }, schedule: clock.set, cancel: clock.clear });
  return { controller, clock, connections, refreshes, retire: () => { current = false; }, restore: () => { current = true; },
    update: () => connections.at(-1).callbacks.message({ event: 'warehouse.updated' }) };
}
test('source warehouse-scoped roles do not connect, and unrelated events never refresh', () => {
  const scoped = controllerFixture({ warehouseScoped: true }); scoped.controller.start(); assert.equal(scoped.connections.length, 0);
  const f = controllerFixture(); f.controller.start(); f.connections[0].callbacks.message({ event: 'other' }); f.clock.advance(1000); assert.deepEqual(f.refreshes, []);
});
test('Warehouse events debounce by250ms and serialize a pending refresh after an in-flight one', async () => {
  const pending = deferred(); let count = 0;
  const f = controllerFixture({ refresh: () => ++count === 1 ? pending.promise : Promise.resolve() }); f.controller.start();
  f.update(); f.clock.advance(200); f.update(); f.clock.advance(249); assert.equal(f.refreshes.length, 0);
  f.clock.advance(1); assert.equal(f.refreshes.length, 1); f.update(); f.update(); f.clock.advance(250); assert.equal(f.refreshes.length, 1);
  pending.resolve(); await flush(); assert.equal(f.refreshes.length, 2); assert.equal(f.clock.size(), 0);
});
test('source background refresh failure is retained by the parent without an unhandled promise or extra refresh', async () => {
  const f = controllerFixture({ refresh: async () => { throw Error('parent owns load error'); } }); f.controller.start(); f.update(); f.clock.advance(250); await flush();
  assert.equal(f.refreshes.length, 1); f.update(); f.clock.advance(250); await flush(); assert.equal(f.refreshes.length, 2);
});
test('error/done reconnect once after5s and the closed generation cannot schedule stale refreshes', () => {
  const f = controllerFixture(); f.controller.start(); const old = f.connections[0];
  old.callbacks.error(); old.callbacks.done(); old.callbacks.message({ event: 'warehouse.updated' });
  f.clock.advance(4999); assert.equal(f.connections.length, 1); assert.equal(f.refreshes.length, 0); assert.equal(old.stopped, true);
  f.clock.advance(1); assert.equal(f.connections.length, 2); assert.equal(f.clock.size(), 0);
  const offline = controllerFixture({ connectError: true }); offline.controller.start(); assert.equal(offline.clock.size(), 1);
  offline.clock.advance(5000); assert.equal(offline.clock.size(), 1); offline.controller.dispose(); assert.equal(offline.clock.size(), 0);
});
test('StrictMode restart cancels timers/events from the old owner; observed account retirement never revives', async () => {
  const pending = deferred(), f = controllerFixture({ refresh: () => pending.promise }); f.controller.start(); const old = f.connections[0];
  f.update(); f.clock.advance(250); f.update(); old.callbacks.error(); f.controller.dispose(); f.controller.start();
  old.callbacks.message({ event: 'warehouse.updated' }); old.callbacks.done(); pending.resolve(); await flush();
  f.clock.advance(5000); assert.equal(f.connections.length, 2); assert.equal(f.refreshes.length, 1); assert.equal(f.clock.size(), 0);
  f.retire(); f.update(); f.restore(); f.controller.start(); assert.equal(f.connections.length, 2); assert.equal(f.connections[1].stopped, true);
});
test('a synchronous current callback disposing the controller cannot leave a newly returned socket mounted', () => {
  let controller, check = () => true, stopped = 0;
  controller = new AdminWarehouseLiveController({ isCurrent: () => check(), warehouseScoped: false, refresh: async () => {},
    connect: () => { check = () => { controller.dispose(); return true; }; return { stop: () => { stopped++; } }; } });
  controller.start(); assert.equal(stopped, 1);
});
test('actual Warehouse live hook restarts after effect replay and never reconnects a retired original account', async () => {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout, clock = scheduler(), f = transportFixture();
  const effects = [], connections = [], refreshed = [];
  global.setTimeout = clock.set; global.clearTimeout = clock.clear;
  try {
    const hook = load('admin/useAdminWarehouseLive', {
      react: { useMemo: fn => fn(), useEffect: fn => effects.push(fn) },
      '../auth': { subscribeSessionWitness: fn => { f.observers.add(fn); return () => f.observers.delete(fn); } },
      './adminWarehouseLiveController': { AdminWarehouseLiveController },
      './adminWarehouseLiveTransport': { adminWarehouseLiveCurrent: f.api.adminWarehouseLiveCurrent,
        openAdminWarehouseLive: (_session, _current, callbacks) => { const value = { callbacks, stopped: false, stop() { this.stopped = true; } }; connections.push(value); return value; } },
    });
    hook.useAdminWarehouseLive(f.session, f.witness, () => true, async () => { refreshed.push('refresh'); });
    const firstCleanup = effects[0](); connections[0].callbacks.message({ event: 'warehouse.updated' }); firstCleanup();
    const finalCleanup = effects[0](); assert.equal(connections[0].stopped, true);
    connections[0].callbacks.message({ event: 'warehouse.updated' }); connections[1].callbacks.message({ event: 'warehouse.updated' });
    clock.advance(250); await flush(); assert.deepEqual(refreshed, ['refresh']);
    f.retire(); for (const callback of [...f.observers]) callback(); clock.advance(5000);
    assert.equal(connections[1].stopped, true); assert.equal(connections.length, 2); finalCleanup(); assert.equal(f.observers.size, 0);
  } finally { global.setTimeout = originalSet; global.clearTimeout = originalClear; }
});
