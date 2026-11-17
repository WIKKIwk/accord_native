const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./support/workerQueueTransport.cjs');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const location = (id, name, kind = 'warehouse') => ({ id, warehouse_id: id, name, kind, active: true });
const asset = (ref = 'roll') => ({ kind: 'raw_material', asset_ref: ref, identifier: ref, item_code: 'PET', item_name: 'PET',
  custody_warehouse_id: 'w1', custody_warehouse: 'First', qty: 2, uom: 'kg', status: 'available', physical_location: location('w1', 'First') });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(options = {}) {
  let active = true, original = true, parent = true;
  const calls = [], saved = [], sockets = [], session = { baseUrl: 'https://example.test', token: 'token', profile: { role: 'brigader', ref: ' leader ' },
    capabilities: ['brigader.access'], assigned_warehouses: [] }, witness = { session, generation: 1 };
  const load = loader({
    './auth': { activeSessionToken: value => active && value === session ? value.token : null,
      isSessionWitnessCurrent: value => original && value === witness },
    '../auth': { activeSessionToken: value => active && value === session ? value.token : null,
      isSessionWitnessCurrent: value => original && value === witness },
    './appPreferences': { appPreferences: { getItem: async key => { saved.push(['get', key]); return options.preference ?? null; },
      setItem: async (key, value) => { saved.push(['set', key, value]); } } },
    '../../modules/accord-native-clock/src/AccordNativeClockModule': { nativeEpochMicroseconds: () => '1794890000000123' },
    './brigader/brigaderInventoryLive': { subscribeBrigaderInventoryLive: (_session, query, version, current, handlers) => {
      const socket = { query, version, current, handlers, stopped: false }; sockets.push(socket);
      if (options.live !== false) queueMicrotask(() => { if (current()) handlers.message({ event: 'inventory.snapshot', id: 'window', epoch: 'epoch', revision: 1, version: 'v1',
        rows: query.kind === 'locations' ? [location('w1', 'First'), location('w2', 'Other'), location('state', 'Press', 'state')]
          : query.kind === 'assets' ? [asset()] : [] }); });
      return () => { socket.stopped = true; };
    } },
    './authorizedFetch': { authorizedFetch: async (...args) => {
      const [_session, path, init, guard, timeout, policy] = args;
      guard?.(); if (policy) assert.equal(policy.readWitness(), true);
      const call = { path, init, guard, timeout, policy }; calls.push(call);
      if (options.fetch) return options.fetch(call, session);
      return { status: 200, ok: true, json: async () => path.includes('/locations') ? [location('w1', 'First')]
        : path.includes('/relocations/batch') ? [asset()] : path.includes('/relocations') ? asset()
        : path.includes('/transfers') && init?.method === 'POST' ? { id: 'transfer', status: 'requested', lines: [] }
        : path.includes('/assets') ? [asset()] : [] };
    } },
  });
  const create = load('brigader/brigaderInventorySession').createBrigaderInventorySession;
  const owner = create(session, witness, () => parent);
  return { owner, session, witness, calls, saved, sockets, load,
    expire: () => { original = false; }, signOut: () => { active = false; }, blurParent: () => { parent = false; }, restoreParent: () => { parent = true; } };
}

test('Brigader inventory retains real role/grants, reads all active warehouses and all asset kinds without assignment-only flags', async () => {
  const f = fixture();
  try {
    f.owner.mount(); await flush();
    assert.equal(f.owner.current(), true);
    assert.deepEqual(f.owner.owner.warehouses.map(row => row.warehouse_id), ['w1', 'w2']);
    assert.deepEqual(f.session.capabilities, ['brigader.access']); assert.equal(f.session.profile.role, 'brigader');
    const assets = f.sockets.find(socket => socket.query.kind === 'assets');
    assert.deepEqual(assets.query.parameters, { warehouse_id: 'w1', limit: '100' });
    assert.deepEqual(f.owner.owner.getSnapshot().assets.map(row => row.asset_ref), ['roll']);
    assert.deepEqual(f.saved[0], ['get', 'inventory_movements.selected_warehouse.leader']);
    f.owner.owner.selectWarehouse('w2'); await flush();
    assert.deepEqual(f.saved.at(-1), ['set', 'inventory_movements.selected_warehouse.leader', 'w2']);
    assert.equal(f.owner.owner.dependencies.key('relocate'), 'mobile:relocate:1794890000000123');
  } finally { f.owner.retire(); }
});

test('lookup and snapshot reads preserve source queries and pass the original guard to every authorized send and body boundary', async () => {
  const f = fixture();
  try {
    await f.owner.owner.dependencies.lookup('roll');
    const query = f.load('shared/inventoryViewQuery').InventoryViewQuery;
    await f.owner.store.dependencies.snapshotLoader(query.assets({ warehouseId: ' w ', query: ' PET ', includeOrderAssignment: false, limit: 50, offset: 100 }));
    await f.owner.store.dependencies.snapshotLoader(query.locations());
    await f.owner.store.dependencies.snapshotLoader(query.transfers({ direction: 'incoming', limit: 25 }));
    assert.equal(f.calls.length, 4);
    assert.deepEqual(Object.fromEntries(new URL(f.calls[0].path, f.session.baseUrl).searchParams), { query: 'roll', limit: '100' });
    assert.deepEqual(Object.fromEntries(new URL(f.calls[1].path, f.session.baseUrl).searchParams), { warehouse_id: 'w', query: 'PET', limit: '50', offset: '100' });
    for (const call of f.calls) { assert.equal(typeof call.guard, 'function'); assert.equal(call.timeout, 10000); assert.equal(call.policy.readWitness(), true); }
    f.expire(); assert.throws(() => f.calls[0].guard(), /Inventar ruxsatlari/); assert.equal(f.calls[0].policy.readWitness(), false);
  } finally { f.owner.retire(); }
});

test('scope loss before lookup blocks HTTP; lost and restored grants cannot revive the old inventory owner', () => {
  const f = fixture();
  try {
    f.session.capabilities = ['admin.access']; assert.equal(f.owner.current(), false);
    f.session.capabilities = ['brigader.access']; assert.equal(f.owner.current(), false);
    assert.throws(() => f.owner.owner.dependencies.lookup('roll'), /Inventar ruxsatlari/);
    assert.equal(f.calls.length, 0);
  } finally { f.owner.retire(); }
});

test('a delayed lookup JSON body cannot escape after account replacement', async () => {
  const body = deferred(), f = fixture({ fetch: () => ({ status: 200, json: () => body.promise }) });
  try {
    const pending = f.owner.owner.dependencies.lookup('roll'); await flush();
    f.expire(); body.resolve([asset()]); await assert.rejects(pending, /Inventar ruxsatlari/);
  } finally { f.owner.retire(); }
});

test('single/batch relocation and transfer preserve payload and original guard without granting Admin permissions', async () => {
  const f = fixture(), a = asset(), state = location('state', 'Press', 'state'), other = location('w2', 'Other');
  try {
    await f.owner.owner.dependencies.relocate(a, state, 'native-key');
    await f.owner.owner.dependencies.relocateBatch([a], state, 'native-batch');
    await f.owner.owner.dependencies.transfer(a, other, 'native-transfer');
    assert.deepEqual(f.calls.map(call => [new URL(call.path, f.session.baseUrl).pathname, call.init.method]), [
      ['/v1/mobile/admin/inventory/relocations', 'POST'], ['/v1/mobile/admin/inventory/relocations/batch', 'POST'], ['/v1/mobile/admin/inventory/transfers', 'POST'],
    ]);
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { asset_kind: 'raw_material', asset_ref: 'roll', physical_location_id: 'state', idempotency_key: 'native-key' });
    assert.deepEqual(JSON.parse(f.calls[2].init.body), { source_warehouse_id: 'w1', destination_warehouse_id: 'w2', assets: [{ asset_kind: 'raw_material', asset_ref: 'roll' }], idempotency_key: 'native-transfer' });
    f.expire(); for (const call of f.calls) assert.throws(call.guard, /Inventar ruxsatlari/);
  } finally { f.owner.retire(); }
});

test('mutations reject late successful bodies from a replaced account and their retry guard cannot send again', async () => {
  for (const operation of ['relocate', 'relocateBatch', 'transfer']) {
    const body = deferred(), f = fixture({ fetch: () => ({ status: 200, ok: true, json: () => body.promise }) });
    try {
      const a = asset(), destination = operation === 'transfer' ? location('w2', 'Other') : location('state', 'Press', 'state');
      const pending = f.owner.owner.dependencies[operation](operation === 'relocateBatch' ? [a] : a, destination, 'original-key');
      await flush(); f.expire(); assert.throws(f.calls[0].guard, /Inventar ruxsatlari/);
      body.resolve(operation === 'relocateBatch' ? [a] : operation === 'transfer' ? { id: 't', lines: [] } : a);
      await assert.rejects(pending, /Inventar ruxsatlari/);
    } finally { f.owner.retire(); }
  }
});

test('StrictMode attach-cleanup-attach keeps the same live owner; final removal releases native sockets and retires authority', async () => {
  const f = fixture();
  f.owner.mount(); f.owner.unmount(); f.owner.mount(); await flush();
  assert.equal(f.owner.current(), true); assert.equal(f.owner.owner.current(), true);
  assert.ok(f.sockets.length > 0); f.owner.unmount(); await flush();
  assert.equal(f.owner.current(), false); assert.equal(f.owner.owner.current(), false);
  assert.ok(f.sockets.every(socket => socket.stopped));
});
