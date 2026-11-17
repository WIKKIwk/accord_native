const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, clock } = require('./support/workerQueueTransport.cjs');
const wire = require('./contracts/f11910bb/material_supply_tasks.json').windows.material.input;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup() {
  const session = { baseUrl: 'https://example.test', token: 'token', profile: { role: 'material_taminotchi', ref: 'one' }, capabilities: ['raw_material.assign'] };
  let active = true;
  const auth = { activeSessionToken: () => active ? session.token : null, activeSessionEpoch: () => active ? 1 : null };
  const load = loader({ './auth': auth, '../auth': auth, '../../auth': auth });
  const model = load('shared/supplyTasks/supplyTaskModels');
  return { session, load, window: model.supplyTaskWindowFromJson(wire), retire: () => { active = false; } };
}

test('wire integer validation preserves escapes, nesting, duplicate keys and Dart double rejection', () => {
  const parse = loader()('shared/supplyTasks/supplyTaskJson').parseSupplyTaskJson;
  assert.equal(parse('{"rev":7}').rev, 7); assert.ok(Number.isNaN(parse('{"rev":7.0}').rev));
  assert.ok(Number.isNaN(parse('{"window":{"rev":7e0}}').window.rev));
  assert.equal(parse('{"rev":7.0,"rev":8}').rev, 8);
  assert.deepEqual(parse('{"rows":[{"position":1}],"rows":[]}').rows, []);
  assert.deepEqual(parse('{"label":"quote \\" rev: 7.0","qty":7.0}'), { label: 'quote " rev: 7.0', qty: 7 });
  const hostile = parse('{"__proto__":{"rev":7.0},"rows":[{"position":0.0}]}');
  assert.equal(Object.getPrototypeOf(hostile), Object.prototype); assert.ok(Object.hasOwn(hostile, '__proto__'));
  assert.ok(Number.isNaN(hostile.rows[0].position)); assert.throws(() => parse('{'), SyntaxError);
});

test('task controller restores/saves apparatus and connects only after its initial window', async () => {
  const h = setup(), timers = clock(), events = [], reads = [], saves = [];
  try {
    const { SupplyTasksController } = h.load('shared/supplyTasks/SupplyTasksController');
    const controller = new SupplyTasksController({ session: h.session, kind: 'material', isCurrent: () => true,
      loadSelection: async () => 'saved', saveSelection: id => saves.push(id), loadWindow: async (query, current, fresh) => {
        assert.equal(current(), true); reads.push({ query, fresh }); return h.window;
      }, events: (window, handlers) => { events.push({ window, handlers }); return () => {}; } });
    await controller.activate(); assert.equal(reads[0].query.apparatus, 'saved'); assert.equal(reads[0].fresh, false); assert.equal(events.length, 1);
    await controller.selectApparatus(h.window.apparatus[0].id);
    assert.deepEqual(saves, [h.window.apparatus[0].id]); assert.equal(reads.at(-1).fresh, true);
    controller.dispose(); assert.equal(timers.pending, 0);
  } finally { timers.restore(); }
});

test('task live timeout reconnects sockets without polling HTTP; background stops and foreground resumes', async () => {
  const h = setup(), timers = clock(); let connects = 0, reads = 0, stops = 0;
  try {
    const { SupplyTasksController } = h.load('shared/supplyTasks/SupplyTasksController');
    const controller = new SupplyTasksController({ session: h.session, kind: 'material', isCurrent: () => true,
      loadWindow: async () => { reads++; return h.window; }, events: () => { connects++; return () => { stops++; }; } });
    await controller.activate(); timers.advance(10_000); assert.equal(connects, 1); timers.advance(999); assert.equal(connects, 1);
    timers.advance(1); assert.equal(connects, 2); assert.equal(reads, 1);
    controller.setForeground(false); assert.equal(timers.pending, 0); assert.equal(stops, 2);
    controller.setForeground(true); assert.equal(connects, 3); controller.dispose();
  } finally { timers.restore(); }
});

test('task live repair budget is bounded and authorization withdrawal discards its window', async () => {
  const h = setup(), timers = clock(), events = []; let reads = 0, withdrawn = 0;
  try {
    const { SupplyTasksController } = h.load('shared/supplyTasks/SupplyTasksController');
    const controller = new SupplyTasksController({ session: h.session, kind: 'material', isCurrent: () => true,
      loadWindow: async () => { reads++; return h.window; }, withdraw: () => withdrawn++,
      events: (_window, handlers) => { events.push(handlers); return () => {}; } });
    await controller.activate(); events[0].error(Object.assign(Error('resync'), { code: 'supply_tasks_resync' })); await flush();
    assert.equal(reads, 2); events[1].error(Object.assign(Error('resync'), { code: 'supply_tasks_resync' })); await flush();
    assert.equal(reads, 2); assert.equal(controller.getSnapshot().error.code, 'supply_tasks_resync');
    await controller.refresh(); events.at(-1).error(Object.assign(Error('forbidden'), { statusCode: 403 }));
    assert.equal(controller.getSnapshot().window, null); assert.equal(withdrawn, 1); assert.equal(timers.pending, 0); controller.dispose();
  } finally { timers.restore(); }
});

test('warm task cache aliases normalized apparatus and refuses a result after token ownership changes', async () => {
  const h = setup(), entries = new Map(); let reads = 0, resolve;
  const snapshots = { generation: 0, read: async (scope, key) => entries.get(scope + key) ?? null,
    write: async (scope, key, value) => { entries.set(scope + key, value); }, remove: async (scope, key) => { entries.delete(scope + key); } };
  const { MaterialTasksWarmStore } = h.load('material/materialTasksWarmStore');
  const store = new MaterialTasksWarmStore(h.session, snapshots, async () => { reads++; return h.window; }, () => true);
  const query = { kind: 'material', apparatus: '', limit: 10, search: '' };
  assert.equal(await store.read(query, () => true), h.window); assert.equal(await store.read(query, () => true), h.window); assert.equal(reads, 1);
  assert.equal(await store.read({ ...query, apparatus: h.window.apparatus_id }, () => true), h.window); assert.equal(reads, 1);
  const delayed = new MaterialTasksWarmStore(h.session, snapshots, () => new Promise(r => { resolve = r; }), () => true);
  const pending = delayed.read(query, () => true, true); await flush(); h.session.token = 'new'; resolve(h.window);
  await assert.rejects(pending, /hisob doirasi/);
});

test('task native transport builds the source endpoint and stops publication after cancellation', () => {
  const h = setup(), callbacks = [], stopped = [], opened = [];
  const native = { addListener: (_name, callback) => { callbacks.push(callback); return { remove() {} }; },
    openSupplyTasks: (origin, url) => { opened.push({ origin, url }); return 'one'; }, stop: id => stopped.push(id) };
  const load = loader({ './auth': { activeSessionToken: () => h.session.token }, '../auth': { activeSessionToken: () => h.session.token },
    '../../modules/accord-production-live/src/AccordProductionLiveModule': { productionLiveNativeModule: () => native } });
  const api = load('material/materialTaskLive'), received = [];
  const stop = api.subscribeMaterialTaskLive(h.session, h.window, () => true, { next: value => received.push(value), error: error => { throw error; }, done() {} });
  const url = new URL(opened[0].url); assert.equal(url.pathname, '/v1/mobile/production-tasks/live');
  assert.deepEqual(Object.fromEntries(url.searchParams), { kind: 'material', apparatus: h.window.apparatus_id, limit: '10', search: '', token: 'token',
    epoch: h.window.epoch, rev: String(h.window.revision), scope: h.window.scope });
  const ready = JSON.stringify({ ok: true, type: 'tasks_ready', epoch: h.window.epoch, scope: h.window.scope, rev: h.window.revision, version: h.window.version, resync: false });
  callbacks[0]({ session: 'one', type: 'message', value: ready }); assert.equal(received.length, 1);
  stop(); callbacks[0]({ session: 'one', type: 'message', value: ready }); assert.equal(received.length, 1); assert.deepEqual(stopped, ['one']);
});
