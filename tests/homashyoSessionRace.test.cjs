// Session races use in-memory storage and deferred fake responses; no network or printer is contacted.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const fixture = require('./contracts/f11910bb/raw_material_split_test.json');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return m.exports; }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const record = (testName, pathPart) => fixture.records.find(r => r.test === testName && r.status === 200 && r.url.includes(pathPart));
const stockRecord = record('lost issue completion retries the same stock command including issue ID', '/split');
const issueRecord = fixture.records.filter(r => r.test === 'issue retry survives lost or invalid response and stays separate from stock' &&
  r.status === 200 && r.url.endsWith('/issues')).at(-1);
const sourceRecord = record('scan lookup and measured weights show 98 stock plus 2 waste', '/source');
const printRecord = record('printer failure and reprint do not submit stock again', '/print');
function setup(writeAllowed = true) {
  const session = { baseUrl: 'https://example.invalid', token: 'not-a-credential', profile: { role: 'homashyo_rezkachi', ref: 'same' },
    capabilities: ['raw_material.split'] }, replacement = { ...session, profile: { ...session.profile } }, saved = new Map(), calls = [];
  let current = session, epoch = 0, witnessCurrent = true, beforeSend, respond = async () => { throw new Error('No fake response provided'); };
  const store = { getItemAsync: async key => saved.get(key) ?? null,
    setItemAsync: async (key, value) => { saved.set(key, typeof value === 'function' ? value(saved.get(key) ?? null) : value); },
    removeItemAsync: async key => saved.delete(key) };
  const api = load('homashyo/rawSplitApi', { './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => writeAllowed }, 'expo-sqlite/kv-store': { default: store, __esModule: true },
    '../auth': { currentSession: () => current }, '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'), '../authorizedFetch': { authorizedFetch: async (s, url, init, guard) => {
      beforeSend = guard; guard(); calls.push({ s, url, init }); return respond(); } }, '../shared/mobileApiException': load('shared/mobileApiException'),
    './rawSplitModel': load('homashyo/rawSplitModel'), './rawSplitResultMatch': load('homashyo/rawSplitResultMatch', { './rawSplitModel': load('homashyo/rawSplitModel') }) });
  const ticket = api.createRawSplitSessionTicket(session, candidate => current === candidate ? epoch : null, () => witnessCurrent);
  return { api, store, saved, calls, session, ticket, replacement, switchSession: () => { current = replacement; epoch++; },
    bumpEpoch: () => { epoch++; }, setWitness: value => { witnessCurrent = value; }, restoreSameObject: () => { current = session; },
    setResponse: fn => { respond = fn; }, retryGuard: () => beforeSend() };
}
const fakeResponse = body => ({ status: 200, json: async () => body });
for (const kind of ['stock', 'issue']) test(`same-account new login during ${kind} pending storage read cannot return old data`, async () => {
  const h = setup(), gate = deferred(), reached = deferred();
  h.store.getItemAsync = async () => { reached.resolve(); await gate.promise; return JSON.stringify({ secret: 'old' }); };
  const pending = kind === 'stock' ? h.api.rawSplitPending(h.ticket) : h.api.rawSplitIssuePending(h.ticket);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0);
});
test('same-account new login during response JSON prevents old source from reaching a controller', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(sourceRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});
test('same-account new login while persisting a command stops before sending and leaves the exact pending command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  const set = h.store.setItemAsync; h.store.setItemAsync = async (key, value) => { await set(key, value); reached.resolve(); await gate.promise; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} response parse keeps the sent command, without retry`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => ({ status: 200, json: async () => { reached.resolve(); await gate.promise; return JSON.parse(rec.responseBody.text); } }));
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload) : h.api.rawSplitReportIssue(h.ticket, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
for (const [kind, rec] of [['stock', stockRecord], ['issue', issueRecord]]) test(`same-account new login during ${kind} pending-key removal restores the exact command`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(rec.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(rec.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload) : h.api.rawSplitReportIssue(h.ticket, payload);
  await reached.promise; h.switchSession(); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
test('restoring an uncertain key after logout never overwrites a newer command', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text), newer = { request_id: 'newer' };
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); h.saved.set(key, JSON.stringify(newer)); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), newer); assert.equal(h.calls.length, 1);
});
test('a failed pending-key deletion is conservatively restored and does not retry the write', async () => {
  const h = setup(), payload = JSON.parse(stockRecord.requestBody.text); h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { h.saved.delete(key); throw new Error('storage interrupted'); };
  await assert.rejects(h.api.rawSplitSave(h.ticket, payload), /storage interrupted/);
  assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); assert.equal(h.calls.length, 1);
});
test('same-account new login during print response JSON cannot report old print success or automatically reprint', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(printRecord.responseBody.text); } }));
  const input = { splitId: 'split-result', barcode: 'child1', driverUrl: 'http://printer', printer: 'zebra', printMode: 'label' };
  const pending = h.api.rawSplitPrint(h.ticket, input); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
});

test('same-account new login during a failed response parse does not expose the old error body', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 400, json: async () => {
    reached.resolve(); await gate.promise; return { error: 'old account detail' }; } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.switchSession(); gate.resolve();
  await assert.rejects(pending, error => /Akkaunt o‘zgargan/.test(error.message) && !/old account detail/.test(error.message));
});

test('epoch zero is valid; missing, invalid, inactive and forged tickets fail closed', async () => {
  const h = setup(); assert.ok(h.api.rawSplitSessionIsCurrent(h.ticket));
  for (const value of [null, undefined, NaN, -1, 1.5])
    assert.throws(() => h.api.createRawSplitSessionTicket(h.session, () => value, () => true), /Akkaunt o‘zgargan/);
  assert.throws(() => h.api.createRawSplitSessionTicket(h.replacement, () => 0, () => true), /Akkaunt o‘zgargan/);
  await assert.rejects(h.api.rawSplitPending({ session: h.session, check() {} }), /Sessiya tekshiruvi kerak/);
});
test('a login attempt epoch change invalidates an old ticket even if the same object stays active or returns after rollback', async () => {
  const h = setup(), gate = deferred(), reached = deferred(); h.setResponse(async () => ({ status: 200, json: async () => {
    reached.resolve(); await gate.promise; return JSON.parse(sourceRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSource(h.ticket, 'parent'); await reached.promise; h.bumpEpoch(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1);
  const other = setup(); other.switchSession(); other.restoreSameObject();
  await assert.rejects(other.api.rawSplitPending(other.ticket), /Akkaunt o‘zgargan/);
});
test('epoch change during storage deletion preserves the exact sent command without automatic retry', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.bumpEpoch(); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
  assert.equal(h.calls.length, 1);
});

test('witness transition with the same session object stops a pending send and permanently retires the ticket', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  const save = h.store.setItemAsync; h.store.setItemAsync = async (key, value) => { await save(key, value); reached.resolve(); await gate.promise; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 0);
  assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); h.setWitness(true);
  assert.equal(h.api.rawSplitSessionIsCurrent(h.ticket), false); await assert.rejects(h.api.rawSplitPending(h.ticket), /Akkaunt o‘zgargan/);
});
test('witness change during a response parse preserves the sent command and never retries', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => ({ status: 200, json: async () => { reached.resolve(); await gate.promise; return JSON.parse(stockRecord.responseBody.text); } }));
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false); gate.resolve();
  await assert.rejects(pending, /Akkaunt o‘zgargan/); assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});
test('missing or asynchronous witness fails closed without unhandled rejections', async () => {
  const h = setup(); for (const witness of [undefined, () => false, () => Promise.resolve(true), () => Promise.reject(new Error('no'))])
    assert.throws(() => h.api.createRawSplitSessionTicket(h.session, () => 0, witness), /Akkaunt o‘zgargan/);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 0);
});
test('demo token blocks stock, issue and remote print before storage or network', async () => {
  const h = setup(); h.session.token = 'test-mode-token'; let storageCalls = 0;
  h.store.getItemAsync = async () => { storageCalls++; return null; };
  await assert.rejects(h.api.rawSplitSave(h.ticket, {}), /Demo\/test/);
  await assert.rejects(h.api.rawSplitReportIssue(h.ticket, {}), /Demo\/test/);
  await assert.rejects(h.api.rawSplitPrint(h.ticket, { splitId: 'x', barcode: 'x', driverUrl: 'x', printer: 'zebra', printMode: 'label' }), /Demo\/test/);
  assert.equal(storageCalls, 0); assert.deepEqual(h.calls, []);
});
test('demo token introduced during key removal restores the sent command without another send', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => fakeResponse(JSON.parse(stockRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const removed = h.saved.delete(key); reached.resolve(); await gate.promise; return removed; };
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.session.token = 'test-mode-token'; gate.resolve();
  await assert.rejects(pending, /Demo\/test/); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload); assert.equal(h.calls.length, 1);
});

test('the same captured witness guards a later 401 retry before another send', async () => {
  const h = setup(), gate = deferred(), reached = deferred(), payload = JSON.parse(stockRecord.requestBody.text);
  h.setResponse(async () => { reached.resolve(); await gate.promise; return fakeResponse(JSON.parse(stockRecord.responseBody.text)); });
  const pending = h.api.rawSplitSave(h.ticket, payload); await reached.promise; h.setWitness(false);
  assert.throws(() => h.retryGuard(), /Akkaunt o‘zgargan/); gate.resolve(); await assert.rejects(pending, /Akkaunt o‘zgargan/);
  assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
});

test('internally consistent but unrelated split responses keep the exact pending command and never print', async () => {
  const original = JSON.parse(stockRecord.responseBody.text), payload = JSON.parse(stockRecord.requestBody.text);
  const variants = [
    row => { row.source.barcode = 'another-roll'; },
    row => { row.source.revision = '2.000000'; },
    row => { row.source.kg = '101'; row.source_kg = '101'; row.waste_kg = '2'; },
    row => { row.source.width_mm = '1001'; },
    row => { row.source.micron = '21'; row.outputs.forEach(output => { output.micron = '21'; }); },
    row => { row.outputs[0].width_mm = '450'; row.outputs[1].width_mm = '550'; },
    row => { row.outputs[0].gross_kg = '41'; row.outputs[0].bobina_kg = '2'; },
    row => { row.outputs[0].length_m = '1001'; },
    row => { row.outputs.reverse(); },
  ];
  for (const alter of variants) {
    const h = setup(), body = structuredClone(original); alter(body); h.setResponse(async () => fakeResponse(body));
    await assert.rejects(h.api.rawSplitSave(h.ticket, payload), /Boshqa bo‘lish natijasi/);
    assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse([...h.saved.values()][0]), payload);
  }
});
test('equivalent decimal precision and ASCII barcode case still match the source command', async () => {
  const h = setup(), body = JSON.parse(stockRecord.responseBody.text), payload = JSON.parse(stockRecord.requestBody.text);
  body.source.barcode = 'PARENT'; for (const field of ['kg', 'width_mm', 'micron']) body.source[field] += '.000000';
  body.source_kg += '.000000'; body.output_kg += '.000000'; body.waste_kg += '.000000';
  for (const output of body.outputs) for (const field of ['kg', 'width_mm', 'micron', 'gross_kg', 'bobina_kg', 'length_m']) output[field] += '.000000';
  h.setResponse(async () => fakeResponse(body)); const result = await h.api.rawSplitSave(h.ticket, payload);
  assert.equal(result.source.barcode, 'PARENT'); assert.equal(h.saved.size, 0); assert.equal(h.calls.length, 1);
});

for (const key of ['stock', 'issue']) test(`malformed persisted ${key} JSON makes the actual controller status fail closed until explicit repair and recheck`, async () => {
  const h = setup(), model = load('homashyo/rawSplitModel'), width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
  const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
  const sync = load('shared/camera/synchronousGuard');
  const { RawSplitController } = load('homashyo/rawSplitController', { './rawSplitApi': h.api, './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true }, '../shared/camera/synchronousGuard': sync,
    './rawSplitBarcode': { rawSplitBarcode: value => value }, './rawSplitDraft': draft, './rawSplitModel': model, './rawSplitWidthPlan': width });
  const scope = h.api.rawSplitScope(); h.saved.set(key === 'stock' ? scope : `${scope}:issue`, '{broken-json'); let picked = 0, printed = 0, writes = 0;
  const originalWrite = h.store.setItemAsync; h.store.setItemAsync = async (...args) => { writes++; return originalWrite(...args); };
  const c = new RawSplitController({ ticket: h.ticket, canMutate: () => true, selectPrinter: async () => { picked++; return null; },
    print: async () => { printed++; }, onMessage() {}, onIssueVisible() {}, printerSupported: () => true, onUnsupportedPrinter() {} });
  await c.recheckPending(); assert.equal(c.getSnapshot().pendingCheck, 'failed'); assert.equal(c.locked, true); assert.equal(c.getSnapshot().busy, false);
  await c.save(true); await c.saveIssue(true); await c.selectPrinter(); await c.lookup('parent');
  assert.deepEqual([h.calls.length, picked, printed, writes], [0, 0, 0, 0]); h.saved.delete(key === 'stock' ? scope : `${scope}:issue`);
  await c.recheckPending(); assert.equal(c.getSnapshot().pendingCheck, 'ready'); assert.equal(c.locked, false);
  assert.deepEqual([h.calls.length, picked, printed, writes], [0, 0, 0, 0]); c.dispose();
});
for (const kind of ['stock', 'issue', 'print']) test(`the original ${kind} action lease is checked again before a simulated 401 resend`, async () => {
  const h = setup(), gate = deferred(), reached = deferred(); let active = true;
  h.setResponse(async () => { reached.resolve(); await gate.promise; return fakeResponse(kind === 'stock' ? JSON.parse(stockRecord.responseBody.text) :
    kind === 'issue' ? JSON.parse(issueRecord.responseBody.text) : JSON.parse(printRecord.responseBody.text)); });
  const guard = () => { if (!active) throw new Error('pending lease expired'); };
  const op = kind === 'stock' ? h.api.rawSplitSave(h.ticket, JSON.parse(stockRecord.requestBody.text), guard) :
    kind === 'issue' ? h.api.rawSplitReportIssue(h.ticket, JSON.parse(issueRecord.requestBody.text), guard) :
      h.api.rawSplitPrint(h.ticket, { splitId: 'r', barcode: 'child1', driverUrl: 'https://printer.invalid', printer: 'zebra', printMode: 'label' }, guard);
  await reached.promise; active = false; assert.throws(() => h.retryGuard(), /pending lease expired/); gate.resolve();
  await assert.rejects(op, /pending lease expired/); assert.equal(h.calls.length, 1);
  if (kind !== 'print') assert.equal(h.saved.size, 1);
});

for (const kind of ['stock', 'issue']) for (const newer of [false, true]) for (const rejected of [false, true])
  test(`${kind} ${rejected ? 'rejection' : 'success'} removal restores ${newer ? 'without replacing a newer key' : 'the key'} on the post-removal microtask`, async () => {
    const h = setup(), payload = JSON.parse((kind === 'stock' ? stockRecord : issueRecord).requestBody.text), scope = h.api.rawSplitScope();
    const key = kind === 'stock' ? scope : `${scope}:issue`, replacement = { request_id: 'newer' }; let removed = false, after = 0, revoked = false;
    h.store.removeItemAsync = async name => { removed = true; return h.saved.delete(name); };
    h.setResponse(async () => rejected ? { status: 400, clone: () => ({ json: async () => ({ code: 'raw_split_conflict' }) }), json: async () => ({ error: 'conflict' }) }
      : fakeResponse(JSON.parse((kind === 'stock' ? stockRecord : issueRecord).responseBody.text)));
    const guard = () => { if (revoked) throw new Error('lease expired'); if (removed && ++after === 2) queueMicrotask(() => {
      if (newer) h.saved.set(key, JSON.stringify(replacement)); revoked = true;
    }); };
    const op = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload, guard) : h.api.rawSplitReportIssue(h.ticket, payload, guard);
    await assert.rejects(op, /lease expired/); assert.equal(h.calls.length, 1);
    assert.deepEqual(JSON.parse(h.saved.get(key)), newer ? replacement : payload);
  });

test('production write policy blocks direct stock and issue API calls, including explicit retries, before storage or network', async () => {
  const policy = load('homashyo/rawSplitWritePolicy'); assert.equal(policy.rawSplitWriteDispatchAllowed(), false);
  const h = setup(policy.rawSplitWriteDispatchAllowed()); let storage = 0;
  h.store.getItemAsync = async () => { storage++; return null; }; h.store.setItemAsync = async () => { storage++; };
  for (const retry of [false, true]) {
    await assert.rejects(h.api.rawSplitSave(h.ticket, { request_id: 'old' }, () => {}, retry), /to‘xtatilgan/);
    await assert.rejects(h.api.rawSplitReportIssue(h.ticket, { command: { request_id: 'old' }, note: 'x' }, () => {}, retry), /to‘xtatilgan/);
  }
  assert.equal(storage, 0); assert.equal(h.calls.length, 0);
});
for (const kind of ['stock', 'issue']) for (const changed of ['missing', 'different'])
  test(`a ${kind} retry with a ${changed} durable key stops before POST and asks for a fresh status check`, async () => {
    const h = setup(), payload = JSON.parse((kind === 'stock' ? stockRecord : issueRecord).requestBody.text), scope = h.api.rawSplitScope();
    const key = kind === 'stock' ? scope : `${scope}:issue`; if (changed === 'different') h.saved.set(key, JSON.stringify({ request_id: 'newer' }));
    let writes = 0; const set = h.store.setItemAsync; h.store.setItemAsync = async (...args) => { writes++; return set(...args); };
    const op = kind === 'stock' ? h.api.rawSplitSave(h.ticket, payload, () => {}, true) : h.api.rawSplitReportIssue(h.ticket, payload, () => {}, true);
    await assert.rejects(op, error => error.code === 'raw_split_pending_changed'); assert.equal(writes, 0); assert.equal(h.calls.length, 0);
    if (changed === 'different') assert.deepEqual(JSON.parse(h.saved.get(key)), { request_id: 'newer' }); else assert.equal(h.saved.has(key), false);
  });
for (const kind of ['stock', 'issue']) for (const newer of [false, true])
  test(`session change after ${kind} API resolution suppresses caller printing${newer ? ' and leaves a newer key untouched' : ''}`, async () => {
    const h = setup(), model = load('homashyo/rawSplitModel'), width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
    const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
    const sync = load('shared/camera/synchronousGuard'), payload = JSON.parse((kind === 'stock' ? stockRecord : issueRecord).requestBody.text);
    const key = h.api.rawSplitScope() + (kind === 'issue' ? ':issue' : ''), replacement = { request_id: 'newer' }; h.saved.set(key, JSON.stringify(payload));
    h.setResponse(async () => fakeResponse(JSON.parse((kind === 'stock' ? stockRecord : issueRecord).responseBody.text)));
    const operations = { ...h.api, rawSplitSnapshot: async () => new model.RawSplitSnapshot({ warehouses: [], history: [], issues: [] }) };
    const method = kind === 'stock' ? 'rawSplitSave' : 'rawSplitReportIssue', original = operations[method];
    operations[method] = async (...args) => { const result = await original(...args); queueMicrotask(() => {
      if (newer) h.saved.set(key, JSON.stringify(replacement)); h.switchSession();
    }); return result; };
    const { RawSplitController } = load('homashyo/rawSplitController', { './rawSplitApi': h.api, './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true },
      '../shared/camera/synchronousGuard': sync, './rawSplitBarcode': { rawSplitBarcode: value => value }, './rawSplitDraft': draft,
      './rawSplitModel': model, './rawSplitWidthPlan': width });
    let prints = 0, notices = 0; const c = new RawSplitController({ ticket: h.ticket, operations, canMutate: () => true,
      selectPrinter: async () => ({ transport: 'bluetooth', printer: {} }), print: async () => { prints++; }, onMessage: () => { notices++; },
      onIssueVisible() {}, printerSupported: () => true, onUnsupportedPrinter() {} });
    await c.recheckPending(); if (kind === 'stock') await c.save(true); else await c.saveIssue(true);
    assert.equal(h.calls.length, 1); assert.equal(prints, 0); assert.equal(notices, 0);
    if (newer) assert.deepEqual(JSON.parse(h.saved.get(key)), replacement); else assert.equal(h.saved.has(key), false);
    // No durable result acknowledgment exists; the production hold covers this boundary.
    c.dispose();
  });
for (const kind of ['stock', 'issue']) for (const changed of ['missing', 'different'])
  test(`controller holds ${kind} after its verified retry key becomes ${changed} until a user-initiated status recheck`, async () => {
    const h = setup(), model = load('homashyo/rawSplitModel'), width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
    const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
    const sync = load('shared/camera/synchronousGuard'), payload = JSON.parse((kind === 'stock' ? stockRecord : issueRecord).requestBody.text);
    const key = h.api.rawSplitScope() + (kind === 'issue' ? ':issue' : ''); h.saved.set(key, JSON.stringify(payload));
    const operations = { ...h.api, rawSplitSnapshot: async () => new model.RawSplitSnapshot({ warehouses: [], history: [], issues: [] }) };
    const { RawSplitController } = load('homashyo/rawSplitController', { './rawSplitApi': h.api, './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true },
      '../shared/camera/synchronousGuard': sync, './rawSplitBarcode': { rawSplitBarcode: value => value }, './rawSplitDraft': draft,
      './rawSplitModel': model, './rawSplitWidthPlan': width });
    let prints = 0, writes = 0; const original = h.store.setItemAsync; h.store.setItemAsync = async (...args) => { writes++; return original(...args); };
    const c = new RawSplitController({ ticket: h.ticket, operations, canMutate: () => true, selectPrinter: async () => ({ transport: 'bluetooth', printer: {} }),
      print: async () => { prints++; }, onMessage() {}, onIssueVisible() {}, printerSupported: () => true, onUnsupportedPrinter() {} });
    await c.recheckPending(); if (changed === 'missing') h.saved.delete(key); else h.saved.set(key, JSON.stringify({ request_id: 'newer' }));
    if (kind === 'stock') await c.save(true); else await c.saveIssue(true);
    assert.equal(c.getSnapshot().pendingCheck, 'failed'); assert.equal(c.locked, true); assert.equal(c.getSnapshot().busy, false);
    assert.deepEqual([h.calls.length, writes, prints], [0, 0, 0]); await c.recheckPending();
    assert.equal(c.getSnapshot().pendingCheck, 'ready'); assert.equal(c.locked, changed === 'different'); c.dispose();
  });
test('production policy blocks direct Wi-Fi print before its authenticated request', async () => {
  const h = setup(false); await assert.rejects(h.api.rawSplitPrint(h.ticket, { splitId: 's', barcode: 'b', driverUrl: 'https://printer.invalid', printer: 'zebra', printMode: 'label' }), /to‘xtatilgan/);
  assert.deepEqual(h.calls, []); assert.equal(h.saved.size, 0);
});
test('same-scope old issue removal can look clear, but the production hold blocks new stock and print until restoration settles', async () => {
  // Simulate a legacy in-flight owner with the policy mocked on; the new production owner stays held.
  const h = setup(true), payload = JSON.parse(issueRecord.requestBody.text), gate = deferred(), removed = deferred(), scope = h.api.rawSplitScope();
  h.setResponse(async () => fakeResponse(JSON.parse(issueRecord.responseBody.text)));
  h.store.removeItemAsync = async key => { const result = h.saved.delete(key); removed.resolve(); await gate.promise; return result; };
  const old = h.api.rawSplitReportIssue(h.ticket, payload); await removed.promise; h.switchSession();
  let newRequests = 0; const model = load('homashyo/rawSplitModel'), width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
  const sync = load('shared/camera/synchronousGuard'), draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
  const safeApi = load('homashyo/rawSplitApi', { './rawSplitWritePolicy': load('homashyo/rawSplitWritePolicy'),
    'expo-sqlite/kv-store': { default: h.store, __esModule: true }, '../auth': { currentSession: () => h.replacement },
    '../shared/camera/synchronousGuard': sync, '../authorizedFetch': { authorizedFetch: async () => { newRequests++; throw new Error('unexpected'); } },
    '../shared/mobileApiException': load('shared/mobileApiException'), './rawSplitModel': model,
    './rawSplitResultMatch': load('homashyo/rawSplitResultMatch', { './rawSplitModel': model }) });
  const ticket = safeApi.createRawSplitSessionTicket(h.replacement, () => 0, () => true);
  const { RawSplitController } = load('homashyo/rawSplitController', { './rawSplitApi': safeApi, './rawSplitWritePolicy': load('homashyo/rawSplitWritePolicy'),
    '../shared/camera/synchronousGuard': sync, './rawSplitBarcode': { rawSplitBarcode: value => value }, './rawSplitDraft': draft,
    './rawSplitModel': model, './rawSplitWidthPlan': width });
  let picks = 0, prints = 0; const c = new RawSplitController({ ticket, canMutate: () => true,
    selectPrinter: async () => { picks++; return null; }, print: async () => { prints++; }, onMessage() {}, onIssueVisible() {}, printerSupported: () => true, onUnsupportedPrinter() {} });
  await c.recheckPending(); assert.equal(c.getSnapshot().pendingCheck, 'ready'); assert.equal(c.getSnapshot().pendingIssue, null);
  await c.save(); await c.save(true); await c.saveIssue(); await c.saveIssue(true); await c.selectPrinter();
  await assert.rejects(safeApi.rawSplitSave(ticket, { request_id: 'new-stock' }), /to‘xtatilgan/);
  await assert.rejects(safeApi.rawSplitPrint(ticket, { splitId: 's', barcode: 'b', driverUrl: 'https://printer.invalid', printer: 'zebra', printMode: 'label' }), /to‘xtatilgan/);
  assert.deepEqual([newRequests, picks, prints, h.calls.length], [0, 0, 0, 1]); gate.resolve(); await assert.rejects(old, /Akkaunt o‘zgargan/);
  assert.deepEqual(JSON.parse(h.saved.get(`${scope}:issue`)), payload); c.dispose();
});
