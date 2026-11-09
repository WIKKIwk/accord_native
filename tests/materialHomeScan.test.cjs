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
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function setup(overrides = {}) {
  const session = { token: 'token-a', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'user-a' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: ['group-a'], assigned_warehouses: [] };
  let active = true, live = true, scans = 0, parses = 0;
  const auth = { activeSessionToken: s => active && s === session ? s.token : null };
  const dart = compile('shared/dartApparatus', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
  const api = compile('material/materialHomeScan', { '../auth': auth, '../sessionReadScope': compile('sessionReadScope'),
    '../shared/appRoutes': compile('shared/appRoutes'), '../shared/camera/synchronousGuard': compile('shared/camera/synchronousGuard'),
    '../shared/dartApparatus': dart });
  const options = { session, isCurrent: () => live, scan: async () => { scans++; return '  source-code  '; },
    barcodeFromQr: raw => { parses++; assert.equal(raw, '  source-code  '); return 'decoded'; }, ...overrides };
  return { session, options, api, scans: () => scans, parses: () => parses,
    deactivate: () => { active = false; }, dispose: () => { live = false; } };
}

test('required injected parser returns a prepared value and performs no navigation', async () => {
  const h = setup(); assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'ready', barcode: 'decoded' });
  assert.equal(h.scans(), 1); assert.equal(h.parses(), 1);
  const source = fs.readFileSync(path.resolve(__dirname, '../src/material/materialHomeScan.ts'), 'utf8');
  assert.doesNotMatch(source, /expo-router|router\.(?:push|replace|navigate)/);
});

test('missing parser or assignment permission fails before opening scanner', async () => {
  const a = setup({ barcodeFromQr: undefined });
  assert.deepEqual(await a.api.prepareMaterialHomeScan(a.options), { kind: 'invalidated' }); assert.equal(a.scans(), 0);
  const b = setup(); b.session.capabilities = [];
  assert.deepEqual(await b.api.prepareMaterialHomeScan(b.options), { kind: 'invalidated' }); assert.equal(b.scans(), 0);
  const c = setup(); c.session.profile.role = 'admin';
  assert.deepEqual(await c.api.prepareMaterialHomeScan(c.options), { kind: 'invalidated' }); assert.equal(c.scans(), 0);
});

test('missing material groups requests the V2 warning without scanning or parsing', async () => {
  const h = setup(); h.session.assigned_item_groups = [];
  assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'scope_required' });
  assert.equal(h.scans(), 0); assert.equal(h.parses(), 0);
});

test('cancel and Dart-whitespace-only scans do not call the parser', async () => {
  for (const raw of [null, '', '  ', '\u0085', '\u2000']) {
    let called = false; const h = setup({ scan: async () => raw, barcodeFromQr: () => { called = true; return 'decoded'; } });
    assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'cancelled' }); assert.equal(called, false);
  }
});

test('a nonempty source group array preserves V2 isNotEmpty semantics', async () => {
  const h = setup(); h.session.assigned_item_groups = [''];
  assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'ready', barcode: 'decoded' });
});

for (const change of ['role', 'identity', 'permission', 'group', 'warehouse', 'token', 'account', 'screen']) {
  test(`scan result is invalidated if ${change} changes before the scanner resolves`, async () => {
    const wait = deferred(); let parsed = false, opened = 0;
    const h = setup({ scan: () => { opened++; return wait.promise; }, barcodeFromQr: () => { parsed = true; return 'decoded'; } });
    const pending = h.api.prepareMaterialHomeScan(h.options); assert.equal(opened, 1);
    if (change === 'role') h.session.profile.role = 'admin';
    if (change === 'identity') h.session.profile.ref = 'other';
    if (change === 'permission') h.session.capabilities = [];
    if (change === 'group') h.session.assigned_item_groups = ['other'];
    if (change === 'warehouse') h.session.assigned_warehouses = ['other'];
    if (change === 'token') h.session.token = 'token-b';
    if (change === 'account') h.deactivate();
    if (change === 'screen') h.dispose();
    wait.resolve('raw'); assert.deepEqual(await pending, { kind: 'invalidated' }); assert.equal(parsed, false);
  });
}

test('guard is strictly synchronous and cannot change the scope reentrantly', async () => {
  for (const guard of [() => 1, () => Promise.resolve(true), () => Promise.reject(Error('async guard')), () => { throw Error('guard'); }]) {
    const h = setup({ isCurrent: guard });
    assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'invalidated' }); assert.equal(h.scans(), 0);
  }
  const h = setup(); h.options.isCurrent = () => { h.session.assigned_item_groups = ['other']; return true; };
  assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'invalidated' }); assert.equal(h.scans(), 0);
  await new Promise(resolve => setImmediate(resolve));
});

test('async, rejected, invalid and empty parser results cannot authorize a value', async () => {
  for (const value of [() => Promise.resolve('decoded'), () => Promise.reject(Error('async parser')), () => true,
    () => 7, () => null, () => '', () => '\u0085', () => { throw Error('bad parser'); }]) {
    const h = setup({ barcodeFromQr: value });
    assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'invalidated' }); assert.equal(h.scans(), 1);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('changes inside the parser are checked again before any prepared result', async () => {
  for (const change of ['role', 'permission', 'group', 'token', 'account', 'screen']) {
    const h = setup(); h.options.barcodeFromQr = () => {
      if (change === 'role') h.session.profile.role = 'admin';
      if (change === 'permission') h.session.capabilities = [];
      if (change === 'group') h.session.assigned_item_groups = [];
      if (change === 'token') h.session.token = 'other';
      if (change === 'account') h.deactivate();
      if (change === 'screen') h.dispose();
      return 'decoded';
    };
    assert.deepEqual(await h.api.prepareMaterialHomeScan(h.options), { kind: 'invalidated' }, change);
  }
});

test('in-flight scanner retains its original injected parser and lifetime callback', async () => {
  const wait = deferred(); let calls = 0;
  const h = setup({ scan: () => wait.promise, barcodeFromQr: () => { calls++; return 'original'; } });
  const pending = h.api.prepareMaterialHomeScan(h.options);
  h.options.barcodeFromQr = () => 'replacement'; h.options.isCurrent = () => true;
  wait.resolve('raw'); assert.deepEqual(await pending, { kind: 'ready', barcode: 'original' }); assert.equal(calls, 1);

  const wait2 = deferred(), k = setup({ scan: () => wait2.promise, barcodeFromQr: () => 'original' });
  const cancelled = k.api.prepareMaterialHomeScan(k.options); k.dispose(); k.options.isCurrent = () => true;
  wait2.resolve('raw'); assert.deepEqual(await cancelled, { kind: 'invalidated' });
});

test('scanner rejection propagates and never invokes parser', async () => {
  let parsed = false; const h = setup({ scan: async () => { throw Error('scanner failed'); }, barcodeFromQr: () => { parsed = true; return 'decoded'; } });
  await assert.rejects(h.api.prepareMaterialHomeScan(h.options), /scanner failed/); assert.equal(parsed, false);
});

test('characterization: a change away and back to the same snapshot is not detected', async () => {
  const wait = deferred(); const h = setup({ scan: () => wait.promise, barcodeFromQr: () => 'decoded' });
  const pending = h.api.prepareMaterialHomeScan(h.options); h.session.capabilities = []; h.session.capabilities = ['raw_material.assign'];
  wait.resolve('raw'); assert.deepEqual(await pending, { kind: 'ready', barcode: 'decoded' });
});
