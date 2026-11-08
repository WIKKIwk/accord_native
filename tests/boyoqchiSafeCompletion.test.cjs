const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename); return loaded.exports;
}
const controls = compile('workerControlsApi.ts', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = compile('boyoqchi/returnedPaintModel.ts', { '../workerControlsApi': controls });
const verifier = compile('boyoqchi/returnedPaintCompletion.ts');
const demo = compile('boyoqchi/returnedPaintDemoGuard.ts');
const input = [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { Mix: '0001.500', Qora: '0' } },
  { usage: 'astatka', category: 'lacquers', name: 'Lak', values: { 'OPV lak': '0.2500' } }];
const resultItems = [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { Qora: '0', Mix: '1.5' } },
  { usage: 'astatka', category: 'lacquers', name: 'Lak', values: { 'OPV lak': '0.25' } }];
const response = overrides => ({ id: 'request', status: 'completed', items: resultItems, apparatus: 'apparatus:default:bosma_7',
  sender_role: 'aparatchi', created_at_unix: 100, ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

function fixture(fetch, refreshSession = async () => false) {
  const session = { baseUrl: 'https://one.invalid', token: 'old-token' }, opened = [], cleared = [], refreshed = [], flushed = [];
  const draft = { values: {}, dynamic_field_labels: {}, image: null }, files = { current: 'original' };
  let active = session, epoch = 1, scope = 'original', failClear = false, failRefresh = false, clearWait = null, clearStarted = null;
  const auth = { activeSessionToken: value => value === active ? value.token : null, refreshSession };
  const transport = compile('authorizedFetch.ts', { './auth': auth });
  const api = compile('boyoqchi/returnedPaintApi.ts', { '../authorizedFetch': transport, '../workerControlsApi': controls, './returnedPaintModel': model, './returnedPaintDemoGuard': demo });
  const store = { isCurrent: () => active === session && epoch === 1 && scope === 'original', load: async () => draft,
    clear: async id => { if (!store.isCurrent()) throw new Error('stale'); if (failClear) throw new Error('disk');
      clearStarted?.resolve(); if (clearWait) await clearWait.promise; files.current = null; cleared.push(id); },
    flush: async id => { flushed.push(id); files.current = JSON.stringify(draft.values); } };
  const sheet = { isOpen: () => false, open: value => opened.push(value), close() {}, update() {} };
  const { useReturnedPaintForm } = compile('boyoqchi/useReturnedPaintForm.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    react: { useRef: value => ({ current: value }), useEffect: fn => { fn(); } },
    '../nativeSheet': { useNativeSheet: () => sheet }, './BoyoqchiForm': { BoyoqchiForm: 'BoyoqchiForm' },
    './returnedPaintApi': api, './returnedPaintCompletion': verifier, './returnedPaintDraftRuntime': { returnedPaintDraftStoreFor: () => store },
  });
  const originalFetch = global.fetch; global.fetch = fetch;
  const open = useReturnedPaintForm(session, { refresh: async () => { refreshed.push(true); if (failRefresh) throw new Error('offline'); } });
  return { session, opened, cleared, refreshed, flushed, draft, files, open: () => open({ id: 'request', image: null }),
    deferClear: () => { clearWait = deferred(); clearStarted = deferred(); return { wait: clearWait, started: clearStarted }; },
    changeScope: () => { scope = 'changed'; }, rollbackEpoch: () => { epoch++; active = {}; active = session; },
    failClear: () => { failClear = true; }, failRefresh: () => { failRefresh = true; }, restore: () => { global.fetch = originalFetch; } };
}
async function prepare(f) { await f.open(); assert.equal(f.opened.length, 1); return f.opened[0].props.save; }
function isReconciliation(error) { return error?.name === 'ReturnedPaintReconciliationError' && /Ro‘yxatni yangilab/.test(error.message); }

test('failed-login epoch rollback blocks a stale form before any POST', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return new Response('{}'); });
  try { const save = await prepare(f); f.rollbackEpoch(); await assert.rejects(save(input), /Sessiya tugagan/);
    assert.equal(calls, 0); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []); } finally { f.restore(); }
});

test('scope changes during 401 refresh prevent the second POST', async () => {
  let calls = 0; const wait = deferred(), started = deferred();
  const f = fixture(async () => { calls++; return new Response('{}', { status: 401 }); }, async session => {
    started.resolve(); await wait.promise; session.token = 'new-token'; return true;
  });
  try { const save = await prepare(f), saving = save(input); await started.promise; f.changeScope(); wait.resolve();
    await assert.rejects(saving, /Sessiya tugagan/); assert.equal(calls, 1); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []);
  } finally { f.restore(); }
});

test('same-session 401 refresh and normalized matching response clear exactly once', async () => {
  const calls = []; const f = fixture(async (_url, init) => {
    calls.push(init.headers.get('authorization'));
    return calls.length === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(response()), { status: 200 });
  }, async session => { session.token = 'new-token'; return true; });
  try { const save = await prepare(f); await save(input); assert.deepEqual(calls, ['Bearer old-token', 'Bearer new-token']);
    assert.deepEqual(f.cleared, ['request']); assert.deepEqual(f.refreshed, [true]); } finally { f.restore(); }
});

for (const [label, body] of [
  ['wrong id', response({ id: 'other' })], ['missing status', response({ status: undefined })],
  ['unknown status', response({ status: 'in_progress' })], ['missing items', response({ items: undefined })],
  ['different stored values', response({ items: [{ ...resultItems[0], values: { Mix: '99', Qora: '0' } }, resultItems[1]] })],
  ['numeric JSON is not an exact decimal string', response({ items: [{ ...resultItems[0], values: { Mix: 1.5, Qora: '0' } }, resultItems[1]] })],
  ['malformed model after otherwise matching payload', response({ apparatus: 'not-canonical' })],
]) test(`200 ${label} retains the draft and asks for reconciliation`, async () => {
  let calls = 0; const f = fixture(async () => { calls++; return new Response(JSON.stringify(body), { status: 200 }); });
  try { const save = await prepare(f); await assert.rejects(save(input), isReconciliation);
    assert.equal(calls, 1); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []); } finally { f.restore(); }
});

test('timeout has an unknown outcome, preserves the draft and does not automatically retry', async () => {
  let calls = 0; const f = fixture(async () => { calls++; const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; });
  try { const save = await prepare(f); await assert.rejects(save(input), isReconciliation);
    assert.equal(calls, 1); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []); } finally { f.restore(); }
});

test('definite 4xx rejection preserves its server message without clearing or retrying', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return new Response('{"error":"invalid values"}', { status: 422 }); });
  try { const save = await prepare(f); await assert.rejects(save(input), error => error.name === 'MobileApiException' && error.message === 'invalid values');
    assert.equal(calls, 1); assert.deepEqual(f.cleared, []); } finally { f.restore(); }
});

test('confirmed server write with failed local cleanup is reported for reconciliation', async () => {
  const f = fixture(async () => new Response(JSON.stringify(response()), { status: 200 }));
  try { const save = await prepare(f); f.failClear(); await assert.rejects(save(input), isReconciliation);
    assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []); } finally { f.restore(); }
});

test('a refresh failure after confirmed save does not falsely report that the write failed', async () => {
  const f = fixture(async () => new Response(JSON.stringify(response()), { status: 200 }));
  try { const save = await prepare(f); f.failRefresh(); await save(input); assert.deepEqual(f.cleared, ['request']);
    assert.deepEqual(f.refreshed, [true]); } finally { f.restore(); }
});

test('exact decimal comparison does not collapse distinct large values into one JS double', () => {
  const submission = { request_id: 'request', items: [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { Mix: '999999999999999998' } }] };
  assert.throws(() => verifier.verifyReturnedPaintCompletion(response({ items: [{ ...submission.items[0], values: { Mix: '999999999999999999' } }] }), submission), isReconciliation);
});


test('draft changed during a pending POST is not cleared after the original response succeeds', async () => {
  const pending = deferred(), f = fixture(async () => pending.promise);
  try { const save = await prepare(f), saving = save(input); await tick();
    f.draft.values['rasxot:Oq'] = ['new value'];
    pending.resolve(new Response(JSON.stringify(response()), { status: 200 }));
    await assert.rejects(saving, isReconciliation); assert.deepEqual(f.cleared, []);
    assert.deepEqual(f.draft.values['rasxot:Oq'], ['new value']); assert.equal(f.files.current, 'original');
  } finally { f.restore(); }
});

test('draft changed while clear is pending is flushed again and requires reconciliation', async () => {
  const f = fixture(async () => new Response(JSON.stringify(response()), { status: 200 })), gate = f.deferClear();
  try { const save = await prepare(f), saving = save(input); await gate.started.promise;
    f.draft.values['rasxot:Oq'] = ['later edit']; gate.wait.resolve();
    await assert.rejects(saving, isReconciliation); assert.deepEqual(f.cleared, ['request']);
    assert.deepEqual(f.flushed, ['request']); assert.equal(f.files.current, JSON.stringify(f.draft.values));
    assert.deepEqual(f.refreshed, []);
  } finally { f.restore(); }
});

test('the fake demo token cannot send a real completion and reports demo unavailable', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return new Response('{}'); });
  try { f.session.token = 'test-mode-token'; const save = await prepare(f);
    await assert.rejects(save(input), error => error.name === 'BoyoqchiDemoUnavailableError' && /Demo rejimi/.test(error.message));
    assert.equal(calls, 0); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []);
  } finally { f.restore(); }
});

test('a 401 refresh that yields a fake demo token cannot send a second completion', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return new Response('{}', { status: 401 }); },
    async session => { session.token = 'test-mode-token'; return true; });
  try { const save = await prepare(f);
    await assert.rejects(save(input), error => error.name === 'BoyoqchiDemoUnavailableError');
    assert.equal(calls, 1); assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []);
  } finally { f.restore(); }
});
