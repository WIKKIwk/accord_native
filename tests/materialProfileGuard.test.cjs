const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(change = '') {
  const session = { baseUrl: 'https://example.test', token: 'normal', profile: { role: 'material_taminotchi', ref: 'one', display_name: 'Old' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: 'one' };
  const witness = { session }, calls = []; let valid = true, saves = 0;
  const auth = { activeSessionToken: s => s === session ? session.token : null, isSessionWitnessCurrent: w => w === witness && valid,
    saveSession: async () => { saves++; }, refreshSession: async () => {
      if (change === 'test-token') session.token = 'test-mode-token'; else session.token = 'refreshed';
      if (change === 'transition') valid = false;
      if (change === 'role') session.profile.role = 'admin';
      if (change === 'capability') session.capabilities = [];
      return true;
    } };
  const guard = compile('material/materialProfileGuard', { '../auth': auth, '../shared/appRoutes': compile('shared/appRoutes'),
    './materialTestSession': compile('material/materialTestSession') });
  const isCurrent = () => guard.materialProfileCurrent(session, witness);
  const authorized = compile('authorizedFetch', { './auth': auth }), profileGuard = compile('shared/profileSessionGuard');
  const parser = compile('authenticateAccount', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const reader = compile('profileApi', { './auth': auth, './authorizedFetch': authorized, './sessionReadScope': compile('sessionReadScope'),
    './workerControlsApi': { WorkerControlException: class extends Error {} }, './authenticateAccount': parser, './shared/profileSessionGuard': profileGuard });
  const editor = compile('shared/profileApi', { '../auth': auth, '../authorizedFetch': authorized, '../authenticateAccount': parser,
    './profileSessionGuard': profileGuard });
  const original = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url: String(url), init });
    if (calls.length === 1 && change) return new Response('', { status: 401 });
    return new Response(JSON.stringify({ role: 'material_taminotchi', ref: 'one', display_name: 'New', capabilities: ['raw_material.assign'],
      assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [] }), { status: 200 }); };
  return { session, witness, isCurrent, reader, editor, calls, invalidate: () => { valid = false; }, saves: () => saves, restore: () => { global.fetch = original; } };
}
test('Material profile guard checks exact witness, role, capability and reserved token', () => {
  for (const mutation of [h => { h.session.token = 'test-mode-token'; }, h => { h.session.profile.role = 'admin'; },
    h => { h.session.capabilities = []; }, h => h.invalidate(), h => { h.witness.session = {}; }]) {
    const h = setup(); try { assert.equal(h.isCurrent(), true); mutation(h); assert.equal(h.isCurrent(), false); } finally { h.restore(); }
  }
});
for (const operation of ['read', 'nickname', 'avatar']) {
  for (const change of ['test-token', 'transition']) test(`${operation} blocks 401 retry on ${change}`, async () => {
    const h = setup(change); try {
      const pending = operation === 'read' ? h.reader.profile(h.session, false, h.isCurrent)
        : operation === 'nickname' ? h.editor.updateNickname(h.session, 'New', undefined, h.isCurrent)
          : h.editor.uploadAvatar(h.session, Uint8Array.of(1), 'avatar.jpg', undefined, h.isCurrent);
      await assert.rejects(pending); assert.equal(h.calls.length, 1); assert.equal(h.saves(), 0); assert.equal(h.session.profile.display_name, 'Old');
    } finally { h.restore(); }
  });
  test(`${operation} refuses an initially invalid or test-token session before sending`, async () => {
    for (const invalid of ['transition', 'test-token']) {
      const h = setup(); try { if (invalid === 'transition') h.invalidate(); else h.session.token = 'test-mode-token';
        const pending = operation === 'read' ? h.reader.profile(h.session, false, h.isCurrent)
          : operation === 'nickname' ? h.editor.updateNickname(h.session, 'New', undefined, h.isCurrent)
            : h.editor.uploadAvatar(h.session, Uint8Array.of(1), 'avatar.jpg', undefined, h.isCurrent);
        await assert.rejects(pending); assert.equal(h.calls.length, 0); assert.equal(h.saves(), 0);
      } finally { h.restore(); }
    }
  });
}
test('normal same-session 401 refresh retains guarded Profile read', async () => {
  const h = setup('refresh'); try {
    await h.reader.profile(h.session, false, h.isCurrent); assert.equal(h.calls.length, 2); assert.equal(h.saves(), 1);
    assert.equal(h.calls[1].init.headers.get('authorization'), 'Bearer refreshed');
  } finally { h.restore(); }
});
test('Home refresh supplies the same live guard to the shared Profile reader', async () => {
  const h = setup(); let invoked = 0, captured;
  try {
    const hooks = { useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn };
    const { useMaterialScope } = compile('material/useMaterialScope', { react: hooks,
      '../auth': { registerSessionResetHook: () => () => {} }, '../profileApi': { profile: async (_session, changed, guard) => { invoked++; assert.equal(changed, false); captured = guard; } },
      './materialProfileGuard': { materialProfileCurrent: () => h.isCurrent() } });
    const scope = useMaterialScope(h.session, h.witness); await scope.refresh(); assert.equal(invoked, 1); assert.equal(captured(), true);
    h.session.token = 'test-mode-token'; assert.equal(captured(), false); await scope.refresh(); assert.equal(invoked, 1);
  } finally { h.restore(); }
});
