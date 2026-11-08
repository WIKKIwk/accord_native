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
  let active = s, epoch = 1;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    activeSessionEpoch: value => value === active ? epoch : null, refreshSession: refresh };
  const load = loader({ '../auth': auth, './auth': auth });
  return { api: load('rezka/rezkaMasterApi'), split: load('rezka/rezkaSplitApi'), printSide: load('rezka/rezkaPrintSide'), guard: load('rezka/rezkaSessionGuard'),
    switchTo: value => { active = value; }, bumpEpoch: () => { epoch++; } };
}
test('master mutation requires active exact session, role, capability and captured scope before initial send', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), scope = t.guard.captureRezkaSession(s);
    s.assigned_apparatus = ['apparatus:default:2'];
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], scope), e => e.name === 'RezkaScopeChanged' && !e.mayHaveExecuted);
    s.profile.role = 'aparatchi';
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], t.guard.captureRezkaSession(s)), e => !e.mayHaveExecuted);
    s.profile.role = 'rezka_master'; s.capabilities = [];
    await assert.rejects(t.api.rezkaMasterSaveOrderSettings(s, 'o', true, true, false, false, t.guard.captureRezkaSession(s)), e => !e.mayHaveExecuted);
    s.capabilities = ['rezka.master.access']; t.switchTo(session());
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], t.guard.captureRezkaSession(s)), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
  } finally { global.fetch = previousFetch; }
});
test('401 retry is stopped if refresh changes master capability or scope', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(), t = setup(s, async () => { s.capabilities = []; return true; });
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], t.guard.captureRezkaSession(s)), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});
test('switch after transmission yields uncertain outcome and does not retry or show success', async () => {
  const previousFetch = global.fetch; let count = 0; let release;
  global.fetch = async () => { count++; await new Promise(resolve => { release = resolve; }); return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s); const pending = t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], t.guard.captureRezkaSession(s));
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
    await assert.rejects(m.split.rezkaSplit(master, request, m.guard.captureRezkaSession(master)), e => !e.mayHaveExecuted); assert.equal(count, 0);
    const admin = session('admin', ['rezka.split.manage']), t = setup(admin, async () => { admin.capabilities = []; return true; });
    await assert.rejects(t.split.rezkaSplit(admin, request, t.guard.captureRezkaSession(admin)), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});


test('print-side wrapper blocks revoked role or scope before send and 401 retry', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(), t = setup(s, async () => { s.capabilities = []; return true; });
    const staleScope = t.guard.captureRezkaSession(s); s.assigned_apparatus = ['apparatus:default:other'];
    await assert.rejects(t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false, staleScope), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
    await assert.rejects(t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false, t.guard.captureRezkaSession(s)), e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});

test('print-side wrapper treats a changed account after transmission as uncertain', async () => {
  const previousFetch = global.fetch; let count = 0, release;
  global.fetch = async () => { count++; await new Promise(resolve => { release = resolve; }); return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), pending = t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false, t.guard.captureRezkaSession(s));
    await Promise.resolve(); t.switchTo(session()); release();
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted); assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});

test('failed-login rollback invalidates a pre-attempt snapshot even if the same object and scope return', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), snapshot = t.guard.captureRezkaSession(s);
    t.bumpEpoch(); // Auth increments epoch at login start, even when it later restores s.
    assert.equal(t.guard.isRezkaSessionCurrent(snapshot, 'master'), false);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], snapshot), e =>
      e.name === 'RezkaScopeChanged' && !e.mayHaveExecuted);
    assert.equal(count, 0); assert.equal(Object.isFrozen(snapshot), true);
  } finally { global.fetch = previousFetch; }
});

test('401 refresh cannot resend an old form after its epoch changes', async () => {
  const previousFetch = global.fetch; let count = 0, t;
  global.fetch = async () => { count++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(); t = setup(s, async () => { t.bumpEpoch(); return true; });
    const snapshot = t.guard.captureRezkaSession(s);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], snapshot), e =>
      e.name === 'RezkaScopeChanged' && e.mayHaveExecuted);
    assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});

test('epoch change after send remains uncertain even when session identity and scope are unchanged', async () => {
  const previousFetch = global.fetch; let count = 0, release;
  global.fetch = async () => { count++; await new Promise(resolve => { release = resolve; }); return new Response('{}', { status: 200 }); };
  try {
    const s = session(), t = setup(s), snapshot = t.guard.captureRezkaSession(s);
    const pending = t.printSide.rezkaMasterSavePrintSideGuarded(s, 'order', true, false, snapshot);
    await Promise.resolve(); t.bumpEpoch(); release();
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted); assert.equal(count, 1);
  } finally { global.fetch = previousFetch; }
});

test('same-session token refresh may retry when epoch, role and read scope stay stable', async () => {
  const previousFetch = global.fetch; const authorizations = [];
  global.fetch = async (_url, init) => {
    authorizations.push(init.headers.get('authorization'));
    return new Response('{}', { status: authorizations.length === 1 ? 401 : 200 });
  };
  try {
    const s = session(), t = setup(s, async () => { s.token = 'renewed'; return true; });
    await t.api.rezkaMasterAssignWorker(s, 'w', ['apparatus:default:1'], [], t.guard.captureRezkaSession(s));
    assert.deepEqual(authorizations, ['Bearer test-token', 'Bearer renewed']);
  } finally { global.fetch = previousFetch; }
});

test('missing, inactive, or another session snapshot fails closed before sending', async () => {
  const previousFetch = global.fetch; let count = 0;
  global.fetch = async () => { count++; return new Response('{}', { status: 200 }); };
  try {
    const s = session(), other = session(), t = setup(s), snapshot = t.guard.captureRezkaSession(s);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', [], [], undefined), e => !e.mayHaveExecuted);
    await assert.rejects(t.api.rezkaMasterAssignWorker(other, 'w', [], [], snapshot), e => !e.mayHaveExecuted);
    t.switchTo(other); const inactive = t.guard.captureRezkaSession(s); assert.equal(inactive.epoch, null);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', [], [], inactive), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
  } finally { global.fetch = previousFetch; }
});

test('documented epoch limits: same-epoch ABA and capture after login start are not detected', () => {
  const s = session(), other = session(), t = setup(s), before = t.guard.captureRezkaSession(s);
  t.switchTo(other); t.switchTo(s); assert.equal(t.guard.isRezkaSessionCurrent(before, 'master'), true);
  t.bumpEpoch(); const duringTransition = t.guard.captureRezkaSession(s);
  assert.equal(t.guard.isRezkaSessionCurrent(duringTransition, 'master'), true);
});
