const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), m = new Module(filename, module);
  m.require = id => id in mocks ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const stateModule = load('qolip/qolipBlockCreateState.ts', { './qolipApiCommon': common, './qolipBlocksApi': {} });
const { QolipBlockCreateState } = stateModule;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}, create) {
  let current = true; const listeners = new Set(), calls = [];
  const boundary = { current: () => current, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const state = new QolipBlockCreateState({ warehouses: [' W ', 'B'], ...options }, boundary, async (input, guard) => {
    common.assertQolipReadCurrent(guard); calls.push(input); return create ? create(input, guard) : { name: input.block, warehouse: input.warehouse };
  });
  return { state, calls, listeners, boundary, invalidate: () => { current = false; [...listeners].forEach(fn => fn()); }, revive: () => { current = true; } };
}
test('block form uses trimmed explicit initial warehouse or exact first source value and retains hidden-field rules', () => {
  for (const [options, expected] of [[{}, ' W '], [{ initialWarehouse: '\u0085 B ' }, 'B'], [{ warehouses: [] }, null], [{ warehouses: [''] }, ''], [{ showWarehouseField: false, initialWarehouse: 'B' }, 'B']]) {
    const h = harness(options); assert.equal(h.state.getSnapshot().warehouse, expected); assert.equal(h.state.getSnapshot().name, ''); assert.equal(h.state.canSave, false);
    assert.equal(h.state.showWarehouseField, options.showWarehouseField ?? true); assert.equal(h.calls.length, 0); assert.equal(h.listeners.size, 0);
  }
});
test('block form validates trimmed nonempty warehouse/name without adding uppercase conversion or a length limit', async () => {
  const h = harness(); h.state.activate(); h.state.setName(' \u0085 '); assert.equal(h.state.canSave, false); assert.equal(await h.state.save(), null);
  h.state.setWarehouse(null); h.state.setName('mixed case'); assert.equal(h.state.canSave, false);
  h.state.setWarehouse(' \u0085 W '); h.state.setName(' a mixed '+ 'x'.repeat(200) + '\u0085'); assert.equal(h.state.canSave, true);
  const result = await h.state.save(); assert.equal(result.name, 'a mixed '+ 'x'.repeat(200)); assert.equal(result.warehouse, 'W');
  assert.deepEqual(h.calls, [{ warehouse: 'W', block: result.name }]); h.state.suspend();
});
test('save snapshots trimmed input once, blocks duplicate dispatch and leaves both fields editable while pending', async () => {
  const pending = deferred(), h = harness({}, () => pending.promise); h.state.activate(); h.state.setName(' old '); const saving = h.state.save();
  assert.equal(h.state.getSnapshot().saving, true); assert.equal(await h.state.save(), null);
  h.state.setName('new'); h.state.setWarehouse('B'); assert.equal(h.state.getSnapshot().name, 'new'); assert.equal(h.state.getSnapshot().warehouse, 'B');
  assert.deepEqual(h.calls, [{ warehouse: 'W', block: 'old' }]); pending.resolve({ name: 'old', warehouse: 'W' }); assert.deepEqual(await saving, { name: 'old', warehouse: 'W' });
  assert.equal(h.state.getSnapshot().saving, false); assert.equal(h.state.getSnapshot().name, 'new'); h.state.suspend();
});
test('a failed or uncertain response clears source saving state but adds no error UI and never automatically resends', async () => {
  const h = harness({}, async () => { throw new Error('uncertain sent request'); }); h.state.activate(); h.state.setName('A');
  await assert.rejects(h.state.save(), /uncertain/); assert.equal(h.state.getSnapshot().saving, false); assert.equal(h.state.canSave, true);
  assert.equal('error' in h.state.getSnapshot(), false); await tick(); assert.equal(h.calls.length, 1, 're-enabled source controls are not settlement or safe-retry evidence'); h.state.suspend();
});
test('original boundary invalidation blanks private input and cannot revive the sheet or unsent save across ABA', async () => {
  const h = harness(); h.state.activate(); h.state.setName('private'); h.invalidate(); assert.deepEqual(h.state.getSnapshot(), { warehouse: null, name: '', saving: false, invalid: true });
  h.revive(); h.state.activate(); assert.equal(await h.state.save(), null); assert.equal(h.state.canAct(), false); assert.equal(h.calls.length, 0); assert.equal(h.listeners.size, 0);
});
test('invalidation after dispatch suppresses the old result without pretending that the server write was cancelled', async () => {
  const pending = deferred(), h = harness({}, () => pending.promise); h.state.activate(); h.state.setName('A'); const saving = h.state.save();
  h.invalidate(); pending.resolve({ name: 'A', warehouse: 'W' }); assert.equal(await saving, null); assert.equal(h.calls.length, 1); assert.equal(h.state.getSnapshot().invalid, true);
});
test('normal dismissal is allowed during saving and late success/failure cannot reactivate the dismissed operation', async () => {
  for (const failure of [false, true]) {
    const pending = deferred(), h = harness({}, () => pending.promise); h.state.activate(); h.state.setName('A'); const saving = h.state.save(); h.state.suspend();
    h.state.activate(); assert.equal(h.state.canAct(), false);
    if (failure) { pending.reject(new Error('late')); await assert.rejects(saving, /late/); }
    else { pending.resolve({ name: 'A', warehouse: 'W' }); assert.equal(await saving, null); }
    assert.equal(h.calls.length, 1); assert.equal(h.state.getSnapshot().invalid, true);
  }
});
test('strict effect setup/cleanup before any write may reactivate without resetting edited initial state', () => {
  const h = harness(); h.state.activate(); h.state.setName('A'); h.state.suspend(); assert.equal(h.state.canAct(), false); h.state.activate();
  assert.equal(h.state.getSnapshot().name, 'A'); assert.equal(h.state.canAct(), true); assert.equal(h.listeners.size, 1); h.state.suspend();
});
test('false, throwing and async original boundaries fail closed before form subscription or write', async () => {
  for (const current of [() => false, () => { throw new Error('guard'); }, async () => true, async () => { throw new Error('guard'); }]) {
    let calls = 0; const state = new QolipBlockCreateState({ warehouses: ['W'] }, { current, subscribe: () => { calls++; return () => {}; } }, async () => { calls++; });
    state.activate(); assert.equal(state.getSnapshot().invalid, true); assert.equal(await state.save(), null); assert.equal(calls, 0);
  }
});
test('subscription installation races and async cleanup contracts cannot leave an actionable form', async () => {
  let current = true, stops = 0;
  const state = new QolipBlockCreateState({ warehouses: ['W'] }, { current: () => current, subscribe: callback => { current = false; callback(); return () => { stops++; }; } }, async () => {});
  state.activate(); assert.equal(state.canAct(), false); assert.equal(stops, 1);
  const asyncState = new QolipBlockCreateState({ warehouses: ['W'] }, { current: () => true, subscribe: async () => () => { stops++; } }, async () => {});
  asyncState.activate(); await tick(); assert.equal(asyncState.canAct(), false); assert.equal(stops, 2);
});
test('forSession uses the real existing API and opt-in initial/resend/result guard without new endpoint/body fields', async () => {
  const calls = [], account = { token: 'mock-local' }, boundary = { current: () => true, subscribe: () => () => {} };
  const api = load('qolip/qolipBlocksApi.ts', { '../auth': { activeSessionToken: value => value.token }, '../authorizedFetch': { authorizedFetch: async (session, target, init, beforeSend) => {
    beforeSend(); calls.push({ session, target, init }); return new Response(JSON.stringify({ block: { name: 'A', warehouse: 'W' } }));
  } }, '../shared/mobileApiException': {}, './qolipApiCommon': common });
  const State = load('qolip/qolipBlockCreateState.ts', { './qolipApiCommon': common, './qolipBlocksApi': api }).QolipBlockCreateState;
  const state = State.forSession(account, boundary, { warehouses: ['W'] }); state.activate(); state.setName(' A '); assert.deepEqual(await state.save(), { name: 'A', warehouse: 'W' });
  assert.equal(calls.length, 1); assert.equal(calls[0].target, '/v1/mobile/qolip/blocks'); assert.equal(calls[0].init.method, 'POST'); assert.deepEqual(JSON.parse(calls[0].init.body), { warehouse: 'W', block: 'A' }); state.suspend();
});
test('create API rejects an invalidated 401 resend and JSON result, without establishing sent-write settlement', async () => {
  for (const invalidAt of ['resend', 'json']) {
    let current = true, dispatches = 0; const api = load('qolip/qolipBlocksApi.ts', { '../auth': { activeSessionToken: value => value.token }, '../authorizedFetch': { authorizedFetch: async (_s, _p, _i, beforeSend) => {
      beforeSend(); dispatches++;
      if (invalidAt === 'resend') { current = false; beforeSend(); dispatches++; }
      return { status: 200, json: async () => { current = false; return { block: { name: 'A', warehouse: 'W' } }; } };
    } }, '../shared/mobileApiException': {}, './qolipApiCommon': common });
    await assert.rejects(api.qolipCreateBlock({ token: 'mock-local' }, { warehouse: 'W', block: 'A' }, () => current), /qolip_read_expired/); assert.equal(dispatches, 1);
  }
});
