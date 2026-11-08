const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '../src', `${relative}.ts`), loaded = new Module(file, module);
  loaded.filename = file; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id)), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return loaded.exports;
}
const { RezkaSplitController, rezkaSplitNoticeText } = load('rezka/rezkaSplitController', {
  '../authorizedFetch': {}, '../shared/mobileApiException': {}, './rezkaSessionGuard': {},
});
const source = { barcode: 'barcode', stock_entry_name: 'entry', line_index: 3, item_code: 'source-item', item_name: 'Film', qty: 10,
  uom: 'kg', warehouse: 'WH', company: '' };
const target = { transport: 'bluetooth', driver_url: 'http://local', printer: 'XP-P323B', print_mode: 'label' };
const label = (epc, print_qr = true) => ({ epc, item_code: 'item', item_name: 'Film', qty: 5, uom: 'kg', warehouse: 'WH', reason: '', print_qr });
const reply = outputs => ({ ok: true, status: 'ok', stock_entry_name: 's', source_barcode: 'barcode', outputs });
function setup(overrides = {}) {
  const calls = []; let current = true;
  const deps = { isCurrent: () => current, loadSource: async barcode => { calls.push(['source', barcode]); return { ok: true, source }; },
    resolvePrinter: async () => target, split: async req => { calls.push(['split', req]); return reply([label('e')]); },
    prepare: async req => { calls.push(['prepare', req]); return reply([label('e1'), label('e2')]); },
    print: async output => { calls.push(['print', output.epc]); return { ok: true }; }, confirm: async req => { calls.push(['confirm', req]); return reply([label('e1'), label('e2')]); }, ...overrides };
  return { controller: new RezkaSplitController(deps), calls, deactivate: () => { current = false; } };
}
async function fill(c) {
  c.setBarcode(' barcode '); await c.loadSource();
  c.editOutput(0, { item_code: 'item', item_name: 'Film', qty: '5' });
  c.editOutput(1, { item_code: 'item', item_name: 'Film', qty: '5' });
  c.setPrinter({ transport: 'bluetooth' });
}
test('source scan creates two drafts and keeps prior data on load error', async () => {
  const t = setup(); await t.controller.scan('https://host/lookup?barcode=abc');
  assert.deepEqual(t.calls, [['source', 'abc']]); assert.equal(t.controller.getSnapshot().outputs.length, 2);
  assert.equal(t.controller.getSnapshot().outputs[0].warehouse, 'WH');
  const bad = setup({ loadSource: async () => { throw new Error('bad'); } });
  bad.controller.setBarcode('abc'); await bad.controller.loadSource(); assert.equal(bad.controller.getSnapshot().notice.message, 'bad');
});
test('validation opens remainder action, adds scrap without sending, and blocks bad outputs', async () => {
  const t = setup(); await fill(t.controller); t.controller.editOutput(1, { qty: '4' }); await t.controller.submit();
  assert.equal(t.controller.getSnapshot().remainder.difference, 1); assert.equal(t.calls.filter(x => x[0] === 'prepare').length, 0);
  t.controller.chooseRemainder('scrap'); const last = t.controller.getSnapshot().outputs.at(-1);
  assert.equal(last.warehouse, 'brak - ombori - A'); assert.equal(last.print_qr, false);
  assert.equal(rezkaSplitNoticeText(t.controller.getSnapshot().notice), 'Qoldiq 1 kg brak sifatida brak - ombori - A omborga yozildi.');
  t.controller.editOutput(0, { item_code: '' }); await t.controller.submit();
  assert.equal(t.controller.getSnapshot().notice.kind, 'outputInvalid');
});
test('local flow prints only QR outputs then confirms exact EPCs once', async () => {
  const t = setup(); await fill(t.controller); t.controller.editOutput(1, { print_qr: false });
  const prepare = async req => { t.calls.push(['prepare', req]); return reply([label('e1'), label('e2', false)]); };
  const c = t.controller; c.deps.prepare = prepare; c.deps.confirm = async req => { t.calls.push(['confirm', req]); return reply([label('e1'), label('e2', false)]); }; await c.submit();
  assert.deepEqual(t.calls.map(row => row[0]), ['source', 'prepare', 'print', 'confirm']);
  assert.equal(t.calls[2][1], 'e1'); assert.deepEqual(t.calls[3][1].outputs.map(row => row.epc), ['e1', 'e2']);
  assert.equal(c.getSnapshot().notice.kind, 'success'); assert.equal(rezkaSplitNoticeText(c.getSnapshot().notice), '1 ta QR chiqarildi.');
});
test('failed physical print is uncertain, never confirms, retries or reports success', async () => {
  let prints = 0;
  const t = setup({ print: async () => { prints++; throw new Error('printer disconnected'); } });
  await fill(t.controller); await t.controller.submit(); assert.equal(t.controller.getSnapshot().uncertain, true);
  assert.equal(t.controller.getSnapshot().notice, null); assert.equal(t.calls.some(x => x[0] === 'confirm'), false);
  await t.controller.submit(); assert.equal(prints, 1); assert.equal(t.calls.filter(x => x[0] === 'prepare').length, 1);
});
test('uncertain remote network failure is not automatically repeated', async () => {
  let attempts = 0;
  const t = setup({ resolvePrinter: async () => ({ ...target, transport: 'wifi', printer: 'zebra' }), split: async () => { attempts++; throw new Error('network'); } });
  await fill(t.controller); t.controller.setPrinter({ transport: 'wifi', printer: 'zebra' }); await t.controller.submit(); await t.controller.submit();
  assert.equal(attempts, 1); assert.equal(t.controller.getSnapshot().uncertain, true); assert.equal(t.controller.getSnapshot().notice, null);
});
test('scope change before printer resolves clears data without claiming a request was sent', async () => {
  let resolveTarget; const t = setup({ resolvePrinter: () => new Promise(resolve => { resolveTarget = resolve; }) });
  await fill(t.controller); const pending = t.controller.submit(); t.deactivate(); resolveTarget(target); await pending;
  assert.equal(t.calls.filter(x => x[0] === 'prepare').length, 0); assert.equal(t.controller.getSnapshot().source, null);
  assert.equal(t.controller.getSnapshot().uncertain, false);
});
test('excluded GoDEX never causes a backend write or a made-up success', async () => {
  const t = setup({ resolvePrinter: async () => ({ ...target, printer: 'GoDEX' }) }); await fill(t.controller); await t.controller.submit();
  assert.equal(t.controller.getSnapshot().blockedPrinter, true);
  assert.equal(t.controller.getSnapshot().notice.kind, 'godexExcluded'); assert.equal(rezkaSplitNoticeText(t.controller.getSnapshot().notice), null);
  assert.equal(t.calls.some(x => x[0] === 'prepare' || x[0] === 'split'), false);
});
test('Wi-Fi uses the visible settings rather than a different injected printer target', async () => {
  let sent;
  const t = setup({ resolvePrinter: async () => { throw new Error('Wi-Fi must not discover a local printer'); },
    split: async req => { sent = req; return reply([label('e')]); } });
  await fill(t.controller); t.controller.setPrinter({ transport: 'wifi', driverUrl: ' http://chosen/ ', printer: ' zebra ', printMode: ' label ' });
  await t.controller.submit(); assert.equal(sent.driver_url, 'http://chosen/'); assert.equal(sent.printer, 'zebra'); assert.equal(sent.print_mode, 'label');
});
test('scope change during local print redacts state and never confirms', async () => {
  let release; const t = setup({ print: () => new Promise(resolve => { release = resolve; }) }); await fill(t.controller);
  const pending = t.controller.submit(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(typeof release, 'function'); t.deactivate(); release({ ok: true }); await pending;
  assert.equal(t.controller.getSnapshot().source, null); assert.equal(t.controller.getSnapshot().uncertain, true);
  assert.equal(t.calls.some(x => x[0] === 'confirm'), false);
});
test('explicit account reset during an in-flight print retains uncertain outcome', async () => {
  let release; const t = setup({ print: () => new Promise(resolve => { release = resolve; }) }); await fill(t.controller);
  const pending = t.controller.submit(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  t.controller.invalidate(); release({ ok: true }); await pending;
  assert.equal(t.controller.getSnapshot().uncertain, true); assert.equal(t.controller.getSnapshot().source, null);
  assert.equal(t.calls.some(x => x[0] === 'confirm'), false);
});
test('draft keys remain stable when another output is removed', async () => {
  const t = setup(); await fill(t.controller); t.controller.addOutput();
  const [first, second, third] = t.controller.getSnapshot().outputs.map(output => output.key);
  assert.equal(new Set([first, second, third]).size, 3);
  t.controller.editOutput(1, { qty: '3' }); t.controller.removeOutput(0);
  assert.deepEqual(t.controller.getSnapshot().outputs.map(output => output.key), [second, third]);
  assert.equal(t.controller.getSnapshot().outputs[0].qty, '3');
});


test('a false native print result never confirms or reports success', async () => {
  const t = setup({ print: async () => ({ ok: false }) }); await fill(t.controller); await t.controller.submit();
  assert.equal(t.controller.getSnapshot().uncertain, true); assert.equal(t.controller.getSnapshot().notice, null);
  assert.equal(t.calls.some(row => row[0] === 'confirm'), false);
});
test('false prepare and false remote result cannot become success', async () => {
  let prints = 0;
  const local = setup({ prepare: async () => ({ ...reply([label('x'), label('y')]), ok: false }), print: async () => { prints++; return { ok: true }; } });
  await fill(local.controller); await local.controller.submit(); assert.equal(prints, 0); assert.equal(local.controller.getSnapshot().uncertain, true);
  const remote = setup({ split: async () => ({ ...reply([]), ok: false }) }); await fill(remote.controller);
  remote.controller.setPrinter({ transport: 'wifi', printer: 'zebra' }); await remote.controller.submit();
  assert.equal(remote.controller.getSnapshot().uncertain, true); assert.equal(remote.controller.getSnapshot().notice, null);
});
test('GoDEX aliases and model identifiers are excluded before backend mutation', async () => {
  for (const model of ['Go-DEX G500', 'g500', 'GO_DEX']) {
    const t = setup({ resolvePrinter: async () => ({ ...target, printer: 'usb', model }) }); await fill(t.controller); await t.controller.submit();
    assert.equal(t.controller.getSnapshot().blockedPrinter, true, model); assert.equal(t.calls.some(row => row[0] === 'prepare'), false);
  }
});


test('incomplete or inconsistent prepared labels stop before physical printing and confirm', async () => {
  for (const outputs of [[label('only')], [label(''), label('e2')], [label('e1'), label('e2', false)]]) {
    let prints = 0, confirms = 0;
    const t = setup({ prepare: async () => reply(outputs), print: async () => { prints++; return { ok: true }; },
      confirm: async () => { confirms++; return reply([]); } });
    await fill(t.controller); await t.controller.submit();
    assert.equal(prints, 0); assert.equal(confirms, 0); assert.equal(t.controller.getSnapshot().uncertain, true);
  }
});
