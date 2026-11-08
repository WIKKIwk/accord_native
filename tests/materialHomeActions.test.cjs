const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup() {
  const session = { token: 'a', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'user' },
    capabilities: ['raw_material.assign', 'gscale.print', 'inventory.movement.manage'], assigned_apparatus: [], assigned_item_groups: ['group'], assigned_warehouses: [] };
  const calls = []; let active = true, live = true, epoch = 1;
  const api = compile('material/materialHomeActions', { '../auth': {
    activeSessionToken: s => active && s === session ? s.token : null,
    activeSessionEpoch: s => active && s === session ? epoch : null },
    '../sessionReadScope': compile('sessionReadScope'), '../shared/appRoutes': compile('shared/appRoutes'),
    '../shared/camera/synchronousGuard': compile('shared/camera/synchronousGuard'), './materialTestSession': compile('material/materialTestSession') });
  const handlers = { isCurrent: () => live, tasks: () => calls.push('tasks'), receipt: () => calls.push('receipt'),
    scan: () => calls.push('scan'), assignment: () => calls.push('assignment'), movement: () => calls.push('movement'),
    showMissingGroup: () => calls.push('group-warning') };
  return { session, api, handlers, calls, deactivate: () => { active = false; }, newEpoch: () => { epoch++; }, dispose: () => { live = false; } };
}
const ids = actions => actions.map(action => action.id);

test('V2 home and FAB order and labels are retained when handlers and capabilities are present', () => {
  const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers);
  assert.deepEqual(ids(menu.cards), ['tasks', 'receipt', 'assignment', 'movement']);
  assert.deepEqual(menu.cards.map(item => item.label), ['Vazifalar', 'Kirim', 'Homashyo biriktirish', 'Joylashtirish va transfer']);
  assert.deepEqual(ids(menu.fab), ['receipt', 'scan', 'assignment', 'movement']);
  assert.deepEqual(menu.fab.map(item => item.label), ['Kirim', 'QR skanerlash', 'Homashyo biriktirish', 'Joylashtirish va transfer']);
  for (const id of ids(menu.fab)) menu.select(id); menu.select('tasks'); menu.select('unknown');
  assert.deepEqual(h.calls, ['receipt', 'scan', 'assignment', 'movement', 'tasks']);
});

test('unimplemented or unauthorized destinations are omitted instead of becoming fake buttons', () => {
  const h = setup(); assert.deepEqual(h.api.materialHomeActions(h.session).cards, []);
  delete h.handlers.receipt; delete h.handlers.assignment; delete h.handlers.showMissingGroup;
  const menu = h.api.materialHomeActions(h.session, h.handlers);
  assert.deepEqual(ids(menu.cards), ['tasks', 'movement']); assert.deepEqual(ids(menu.fab), ['movement']);
  for (const id of ['receipt', 'assignment', 'scan']) menu.select(id);
  assert.deepEqual(h.calls, []);
  h.session.capabilities = ['gscale.print'];
  const next = h.api.materialHomeActions(h.session, h.handlers);
  assert.deepEqual(next.cards, []); assert.deepEqual(next.fab, []);
});

test('missing groups display the existing warning for assignment and scan but leave other actions available', () => {
  const h = setup(); h.session.assigned_item_groups = []; const menu = h.api.materialHomeActions(h.session, h.handlers);
  assert.deepEqual(ids(menu.cards), ['tasks', 'receipt', 'assignment', 'movement']);
  menu.select('assignment'); menu.select('scan'); menu.select('receipt');
  assert.deepEqual(h.calls, ['group-warning', 'group-warning', 'receipt']);
});

test('a nonempty group array preserves the V2 isNotEmpty check', () => {
  const h = setup(); h.session.assigned_item_groups = ['']; const menu = h.api.materialHomeActions(h.session, h.handlers);
  menu.select('assignment'); assert.deepEqual(h.calls, ['assignment']);
});

for (const change of ['role', 'identity', 'permission', 'groups', 'warehouses', 'epoch', 'account', 'screen']) {
  test(`a visible home action cannot invoke a stale handler after ${change} changes`, () => {
    const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers);
    if (change === 'role') h.session.profile.role = 'admin';
    if (change === 'identity') h.session.profile.ref = 'other';
    if (change === 'permission') h.session.capabilities = [];
    if (change === 'groups') h.session.assigned_item_groups = [];
    if (change === 'warehouses') h.session.assigned_warehouses = ['other'];
    if (change === 'epoch') h.newEpoch();
    if (change === 'account') h.deactivate();
    if (change === 'screen') h.dispose();
    for (const id of ['tasks', 'receipt', 'scan', 'assignment', 'movement']) menu.select(id);
    assert.deepEqual(h.calls, []);
  });
}

test('same-session token refresh keeps home actions usable', () => {
  const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers);
  h.session.token = 'refreshed'; menu.select('tasks');
  assert.deepEqual(h.calls, ['tasks']);
  h.newEpoch(); menu.select('tasks'); assert.deepEqual(h.calls, ['tasks']);
});

test('only synchronous true lifetime checks pass, including reentrant mutation', async () => {
  for (const guard of [() => 1, () => Promise.resolve(true), () => Promise.reject(Error('async guard')), () => { throw Error('guard'); }]) {
    const h = setup(); h.handlers.isCurrent = guard;
    assert.deepEqual(h.api.materialHomeActions(h.session, h.handlers).cards, []); assert.deepEqual(h.calls, []);
  }
  const h = setup(); h.handlers.isCurrent = () => { h.session.assigned_item_groups = []; return true; };
  assert.deepEqual(h.api.materialHomeActions(h.session, h.handlers).cards, []);
  await new Promise(resolve => setImmediate(resolve));
});

test('later handler replacement cannot make an already-rendered action invoke a different destination', () => {
  const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers);
  h.handlers.receipt = () => h.calls.push('replacement'); h.handlers.isCurrent = () => true;
  menu.select('receipt'); assert.deepEqual(h.calls, ['receipt']);
  h.dispose(); menu.select('receipt'); assert.deepEqual(h.calls, ['receipt']);
});

test('characterization: same-snapshot ABA remains a blocker to wiring', () => {
  const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers);
  h.session.capabilities = []; h.session.capabilities = ['raw_material.assign', 'gscale.print', 'inventory.movement.manage'];
  menu.select('receipt'); assert.deepEqual(h.calls, ['receipt']);
});


test('reserved test token never runs a home action even after a real-token view was created', () => {
  const h = setup(), menu = h.api.materialHomeActions(h.session, h.handlers); h.session.token = 'test-mode-token';
  for (const id of ['tasks', 'receipt', 'scan', 'assignment', 'movement']) menu.select(id);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.api.materialHomeActions(h.session, h.handlers).cards, []);
});
