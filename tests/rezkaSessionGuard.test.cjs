const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function loader(mocks) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '../src', `${relative}.ts`);
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = new Module(file, module); cache.set(file, loaded);
    loaded.filename = file; loaded.paths = module.paths;
    loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.')
      ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : require(id);
    loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return loaded.exports;
  }
  return load;
}
function session(role = 'rezka_master', capabilities = ['rezka.master.access']) {
  return { token: 'test-token', baseUrl: 'https://example.test', profile: { role, ref: 'operator' }, capabilities,
    assigned_apparatus: ['apparatus:default:1'], assigned_item_groups: [], assigned_warehouses: [] };
}
const request = { source_barcode: 'b', source_stock_entry: 's', source_line_index: 0, reason: '', driver_url: 'https://printer',
  printer: 'z', print_mode: 'label', outputs: [{ item_code: 'i', item_name: 'I', qty: 1, uom: 'kg', target_warehouse: 'w', reason: '' }] };
function setup(s, refresh = async () => true) {
  let active = s;
  const auth = { activeSessionToken: value => value === active ? value.token : null, refreshSession: refresh };
  const load = loader({ '../auth': auth, './auth': auth });
  return { api: load('rezka/rezkaMasterApi'), split: load('rezka/rezkaSplitApi'), printSide: load('rezka/rezkaPrintSide'), guard: load('rezka/rezkaSessionGuard'),
    switchTo: value => { active = value; } };
}
test('master mutation requires active exact session, role, capability and captured scope before initial send', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), scope = t.guard.currentRezkaScope(s);
    s.assigned_apparatus = ['apparatus:default:2'];
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], scope), e => e.name === 'RezkaScopeChanged' && !e.mayHaveExecuted);
    s.profile.role = 'aparatchi';
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], []), e => !e.mayHaveExecuted);
    s.profile.role = 'rezka_master'; s.capabilities = [];
    await assert.rejects(t.api.rezkaMasterSaveOrderSettings(s, 'o', true, true, false, false), e => !e.mayHaveExecuted);
    s.capabilities = ['rezka.master.access']; t.switchTo(session());
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], []), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
  } finally { global.fetch = previousFetch; }
});
test('401 retry is stopped if refresh changes master capability or scope', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(), t = setup(s, async () => { s.capabilities = []; return true; });
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], []), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});
test('switch after transmission yields uncertain outcome and does not retry or show success', async () => {
  const previousFetch = global.fetch; let count = 0; let release;
  global.fetch = async () => { count++; await new Promise(resolve => { release = resolve; }); return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s); const pending = t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], []);
    await Promise.resolve(); t.switchTo(session()); release();
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});
test('split enforces capability and V2 master allowlist on every attempt', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const master = session('rezka_master', ['rezka.master.access', 'rezka.split.manage']), m = setup(master);
    await assert.rejects(m.split.rezkaSplit(master, request), e => !e.mayHaveExecuted); assert.equal(count, 0);
    const admin = session('admin', ['rezka.split.manage']), t = setup(admin, async () => { admin.capabilities = []; return true; });
    await assert.rejects(t.split.rezkaSplit(admin, request), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});


test('print-side wrapper blocks revoked role or scope before send and 401 retry', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(), t = setup(s, async () => { s.capabilities = []; return true; });
    const staleScope = t.guard.currentRezkaScope(s); s.assigned_apparatus = ['apparatus:default:other'];
    await assert.rejects(t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false, staleScope), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
    await assert.rejects(t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});

test('print-side wrapper treats a changed account after transmission as uncertain', async () => {
  const previousFetch = global.fetch; let count = 0, release;
  global.fetch = async () => { count++; await new Promise(resolve => { release = resolve; }); return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), pending = t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false);
    await Promise.resolve(); t.switchTo(session()); release();
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted); assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});
