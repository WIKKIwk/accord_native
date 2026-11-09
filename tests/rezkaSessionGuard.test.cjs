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
      ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
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
  let active = s, epoch = 1, generation = 1, transitioning = false;
  const issued = new WeakSet(), scope = value => JSON.stringify([value.profile, value.capabilities, value.assigned_apparatus, value.assigned_item_groups, value.assigned_warehouses]);
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    activeSessionEpoch: value => value === active ? epoch : null, refreshSession: refresh,
    captureSessionWitness: value => { if (transitioning || value !== active) return null; const witness = { session: value, epoch, generation, scope: scope(value) }; issued.add(witness); return witness; },
    isSessionWitnessCurrent: witness => { if (!witness || !issued.has(witness)) return false; const valid = !transitioning && witness.session === active &&
      witness.epoch === epoch && witness.generation === generation && witness.scope === scope(witness.session); if (!valid) issued.delete(witness); return valid; } };
  const load = loader({ '../auth': auth, './auth': auth });
  return { apparatus: load('apparatusApi'), api: load('rezka/rezkaMasterApi'), split: load('rezka/rezkaSplitApi'), printSide: load('rezka/rezkaPrintSide'), guard: load('rezka/rezkaSessionGuard'),
    switchTo: value => { if (active !== value) generation++; active = value; }, bumpEpoch: () => { epoch++; generation++; },
    beginTransition: () => { transitioning = true; generation++; }, endTransition: () => { transitioning = false; generation++; } };
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

test('witness rejects same-epoch ABA and cannot be captured during a login transition', () => {
  const s = session(), other = session(), t = setup(s), before = t.guard.captureRezkaSession(s);
  t.switchTo(other); t.switchTo(s); assert.equal(t.guard.isRezkaSessionCurrent(before, 'master'), false);
  t.beginTransition(); const duringTransition = t.guard.captureRezkaSession(s);
  assert.equal(duringTransition.witness, null); assert.equal(t.guard.isRezkaSessionCurrent(duringTransition, 'master'), false);
  t.endTransition(); assert.equal(t.guard.isRezkaSessionCurrent(duringTransition, 'master'), false);
});

test('known fake test token cannot reach role reads, writes or split requests', async () => {
  const previousFetch = global.fetch; let count = 0; global.fetch = async () => { count++; return new Response('{}', { status: 200 }); };
  try {
    const master = session(); master.token = 'test-mode-token'; const t = setup(master), snapshot = t.guard.captureRezkaSession(master);
    await assert.rejects(t.api.rezkaMasterWorkers(master, snapshot), e => !e.mayHaveExecuted);
    await assert.rejects(t.api.rezkaMasterAssignWorker(master, 'w', [], [], snapshot), e => !e.mayHaveExecuted);
    await assert.rejects(t.printSide.rezkaMasterSavePrintSideGuarded(master, 'o', false, true, snapshot), e => !e.mayHaveExecuted);
    const admin = session('admin', ['rezka.split.manage']); admin.token = 'test-mode-token'; const split = setup(admin);
    await assert.rejects(split.split.rezkaSplit(admin, request, split.guard.captureRezkaSession(admin)), e => !e.mayHaveExecuted);
    assert.equal(count, 0);
  } finally { global.fetch = previousFetch; }
});

test('a role snapshot once observed invalid remains retired if a fake token or capability returns', () => {
  const s = session(), t = setup(s), first = t.guard.captureRezkaSession(s);
  s.token = 'test-mode-token'; assert.equal(t.guard.isRezkaSessionCurrent(first, 'master'), false);
  s.token = 'test-token'; assert.equal(t.guard.isRezkaSessionCurrent(first, 'master'), false);
  const second = t.guard.captureRezkaSession(s); s.capabilities = [];
  assert.equal(t.guard.isRezkaSessionCurrent(second, 'master'), false);
  s.capabilities = ['rezka.master.access']; assert.equal(t.guard.isRezkaSessionCurrent(second, 'master'), false);
});

test('shared apparatus read rejects a 401 retry after witness or scope changes', async () => {
  const original = global.fetch; let sends = 0, t;
  global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  try {
    const s = session(); t = setup(s, async () => { t.beginTransition(); return true; }); const snapshot = t.guard.captureRezkaSession(s);
    await assert.rejects(t.guard.guardedRezkaRequest(s, 'master', snapshot, false, beforeSend =>
      t.apparatus.adminApparatus(s, { limit: 500, beforeSend })), e => e.name === 'RezkaScopeChanged');
    assert.equal(sends, 1);
  } finally { global.fetch = original; }
});

test('split deep links reject protected roles even with overlapping capability', async () => {
  for (const role of ['aparatchi', 'tayyorlov_masteri']) {
    const s = session(role, ['rezka.split.manage']), t = setup(s);
    assert.equal(t.guard.isRezkaSessionCurrent(t.guard.captureRezkaSession(s), 'split'), false, role);
    let sends = 0;
    await assert.rejects(t.guard.guardedRezkaRequest(s, 'split', t.guard.captureRezkaSession(s), false,
      async beforeSend => { beforeSend(); sends++; }), error => error.name === 'RezkaScopeChanged');
    assert.equal(sends, 0, role);
  }
  const admin = session('admin', ['rezka.split.manage']), t = setup(admin);
  assert.equal(t.guard.isRezkaSessionCurrent(t.guard.captureRezkaSession(admin), 'split'), true);
});
