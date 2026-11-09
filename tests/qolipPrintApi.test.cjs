const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const printModels = load('printing/printModels.ts', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
const printTransport = load('printing/printTransport.ts');
const qr = load('qolip/qolipQrApi.ts', { '../auth': {}, '../authorizedFetch': {}, '../qolipCatalogApi': {},
  '../qolipProductsApi': {}, '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
  './qolipLocationsApi': {} });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function harness(response, options = {}) {
  const calls = [], applied = [], session = options.session ?? { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'one' } };
  const auth = { activeSessionToken: value => value.token || null }, scope = { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) };
  const request = { authorizedFetch: async (value, target, init = {}, guard) => {
    guard?.(); calls.push({ target, init });
    const result = typeof response === 'function' ? await response(value, target, init) : response;
    options.afterResponse?.(session);
    return result;
  } };
  const storage = load('qolip/qolipStorageApi.ts', { '../auth': auth, '../authorizedFetch': request, '../sessionReadScope': scope,
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: data => applied.push(data) }) } });
  const api = load('qolip/qolipPrintApi.ts', { '../auth': auth, '../authorizedFetch': request,
    '../printing/printModels': printModels, '../printing/printTransport': printTransport,
    './qolipApiCommon': common, './qolipQrApi': qr, './qolipStorageApi': storage });
  return { api, calls, applied, session };
}
const cell = { id: 'cell-1', block: 'B', warehouse: 'W', row_letter: ' a ', column_number: 12,
  location_label: 'original', qr_payload: 'qolip-cell:1' };
const block = { name: ' B ', warehouse: ' W ' };
const payload = (overrides = {}) => ({ ok: true, qr_payload: 'qolip-paddon:QP-00012',
  print: { qr_payload: 'qolip-paddon:QP-00012', label_kind: 'paddon_code' }, ...overrides });

test('cell print sends V2 normalized request and uses the existing print model', async () => {
  const { api, calls, session } = harness(json({ cell_qr: cell, print: { epc: 'epc', item_name: 'server',
    order_code: 'old', manufacturer_name: 'maker', label_kind: 'other', completed_at_unix: 42 } }));
  const result = await api.qolipPrintCellQr(session, { block, rowLetter: ' a ', columnNumber: 12,
    driverUrl: ' http://printer/// ', printer: ' zebra ', printMode: ' rfid ', printTransport: 'bluetooth' });
  assert.equal(calls[0].target, '/v1/mobile/qolip/cell-qr/print');
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { block: 'B', warehouse: 'W', row_letter: 'A', column_number: 12,
    driver_url: 'http://printer', printer: 'zebra', print_mode: 'rfid', print_transport: 'offline' });
  assert.equal(result.cellQr.id, 'cell-1');
  assert.equal(result.printJob.epc, 'epc');
  assert.equal(result.printJob.itemName, 'A12');
  assert.equal(result.printJob.orderCode, '');
  assert.equal(result.printJob.manufacturerName, '');
  assert.equal(result.printJob.completedAtUnix, 0);
  assert.equal(result.printJob.labelKind, 'qolip_cell');
});

test('cell print fallback uses QR, warehouse and cell label; wifi omits transport', async () => {
  const { api, calls, session } = harness(json({ cell_qr: { ...cell, row_letter: '', column_number: 0, location_label: ' C7 ' } }));
  const { printJob } = await api.qolipPrintCellQr(session, { block, rowLetter: 'c', columnNumber: 7, driverUrl: '' });
  assert.equal(printJob.epc, cell.qr_payload);
  assert.equal(printJob.itemCode, cell.qr_payload);
  assert.equal(printJob.itemName, 'C7');
  assert.equal(printJob.warehouse, 'W');
  assert.equal(printJob.labelKind, 'qolip_cell');
  assert.equal(printJob.progressQty, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { block: 'B', warehouse: 'W', row_letter: 'C', column_number: 7, driver_url: '' });
});

test('cell print rejects non-200 and malformed responses', async () => {
  let h = harness(json({}, 403));
  await assert.rejects(h.api.qolipPrintCellQr(h.session, { block, rowLetter: 'a', columnNumber: 1, driverUrl: '' }), /Qolip cell QR print failed/);
  h = harness(json({ cell_qr: null }));
  await assert.rejects(h.api.qolipPrintCellQr(h.session, { block, rowLetter: 'a', columnNumber: 1, driverUrl: '' }), TypeError);
});

// @v2-test test/qolip_paddon_print_api_test.dart
for (const [count, expected] of [[0, '0'], [3, '3'], [-1, '—'], [1.5, '—'], ['104', '—'], [null, '—']]) {
  test(`Bluetooth pallet count retains V2 value ${String(count)}`, async () => {
    const h = harness(json(payload({ paddon: { code: 'QP-00012', item_count: count } })));
    const job = await h.api.qolipPrintPaddonQr(h.session, { code: 'qp-00012', driverUrl: '', transport: 'bluetooth' });
    assert.deepEqual(job.paddonLabelLines, ['Qolip paddoni: QP-00012', `Qoliplar soni: ${expected}`]);
    assert.equal(job.epc, 'qolip-paddon:QP-00012');
    assert.equal(job.isPaddonCodeLabel, true);
    assert.equal('paddon_label_lines' in job.toJson(), false);
  });
}

test('pallet print validates summary and print identities without catalog mutation', async () => {
  let h = harness(json(payload({ paddon: { code: 'QP-00013', item_count: 12 } })));
  await assert.rejects(h.api.qolipPrintPaddonQr(h.session, { code: 'QP-00012', driverUrl: '', transport: 'bluetooth' }), /summary identity/);
  h = harness(json(payload({ paddon: { item_count: 104 } })));
  assert.deepEqual((await h.api.qolipPrintPaddonQr(h.session, { code: 'QP-00012', driverUrl: '', transport: 'bluetooth' })).paddonLabelLines,
    ['Qolip paddoni: QP-00012', 'Qoliplar soni: —']);
  assert.deepEqual(h.applied, []);
  for (const bad of [payload({ qr_payload: 'wrong' }), payload({ print: {} }),
    payload({ print: { epc: 'qolip-paddon:QP-00012', label_kind: 'other' } })]) {
    h = harness(json(bad));
    await assert.rejects(h.api.qolipPrintPaddonQr(h.session, { code: 'QP-00012', driverUrl: '' }), TypeError);
  }
});

test('pallet request keeps printer fields untrimmed and offline transport is distinct from wifi', async () => {
  for (const transport of ['wifi', 'offline', 'bluetooth']) {
    const h = harness(json(payload()));
    const job = await h.api.qolipPrintPaddonQr(h.session, { code: ' qp-00012 ', driverUrl: ' http://printer/// ',
      printer: ' zebra ', printMode: ' rfid ', transport });
    assert.equal(h.calls[0].target, '/v1/mobile/qolip/paddons/qr/print');
    assert.equal(new Headers(h.calls[0].init.headers).get('content-type'), 'text/plain; charset=utf-8');
    assert.deepEqual(JSON.parse(h.calls[0].init.body), { qolip_code: 'QP-00012', driver_url: 'http://printer',
      printer: ' zebra ', print_mode: ' rfid ', print_count: 1, ...(transport === 'wifi' ? {} : { print_transport: 'offline' }) });
    if (transport !== 'bluetooth') assert.deepEqual(job.paddonLabelLines, []);
  }
});

test('pallet print rejects account changes and all print functions reject deferred test mode', async () => {
  let h = harness(json(payload()), { afterResponse: s => { s.profile.ref = 'other'; } });
  await assert.rejects(h.api.qolipPrintPaddonQr(h.session, { code: 'QP-00012', driverUrl: '' }), error => error.code === 'session_scope_changed');
  h = harness(json(payload())); h.session.token = 'test-mode-token';
  await assert.rejects(h.api.qolipPrintPaddonQr(h.session, { code: 'QP-00012', driverUrl: '' }), /test mode/);
  await assert.rejects(h.api.qolipPrintCellQr(h.session, { block, rowLetter: 'A', columnNumber: 1, driverUrl: '' }), /test mode/);
  assert.equal(h.calls.length, 0);
});

const fixtureStem = 'f11910bb/qolip_paddon_print_api_test';
const replayCases = [
  ['Bluetooth mold pallet label includes its current count and typed QR', { code: 'qp-00012', driverUrl: '', transport: 'bluetooth' }, '104'],
  ...[[0, '0'], [3, '3'], [-1, '—'], [1.5, '—'], ['104', '—'], [null, '—']].map(([count, expected]) => [
    `Bluetooth mold pallet count uses a valid server value: (count: ${count}, expected: ${expected})`,
    { code: 'QP-00012', driverUrl: '', transport: 'bluetooth' }, expected,
  ]),
  ['Bluetooth pallet refuses a different response pallet identity', { code: 'QP-00012', driverUrl: '', transport: 'bluetooth' }, 'error'],
  ['Bluetooth pallet does not infer a count from a missing summary', { code: 'QP-00012', driverUrl: '', transport: 'bluetooth' }, '—'],
  ['PrintTransport.offline keeps the existing mold pallet print contract', { code: 'QP-00012', driverUrl: 'http://printer', transport: 'offline' }, null],
  ['PrintTransport.wifi keeps the existing mold pallet print contract', { code: 'QP-00012', driverUrl: 'http://printer', transport: 'wifi' }, null],
  ['printing uses scoped mold pallet endpoint without lifecycle writes', { code: ' qp-00012 ', driverUrl: 'http://printer/', transport: 'offline' }, null],
  ['mismatched QR response cannot be printed', { code: 'QP-00012', driverUrl: '' }, 'error'],
];

test('pallet print fixture identifies the selected f119 V2 baseline', () => {
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${fixtureStem}.json`), 'utf8'));
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.records.length, replayCases.length);
});
for (const [name, input, result] of replayCases) {
  test(`f119 replay: ${name}`, async () => {
    const replay = contractFetch(fixtureStem, name), session = { ...recordedSession(fixtureStem, name), profile: { ref: 'print-clerk' } };
    const h = harness((value, target, init) => {
      const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${value.token}`);
      return replay(new URL(target, value.baseUrl), { ...init, headers });
    }, { session });
    if (result === 'error') await assert.rejects(h.api.qolipPrintPaddonQr(session, input), TypeError);
    else {
      const job = await h.api.qolipPrintPaddonQr(session, input);
      assert.equal(job.epc, 'qolip-paddon:QP-00012');
      assert.equal(job.isPaddonCodeLabel, true);
      assert.deepEqual(job.paddonLabelLines, result === null ? [] : ['Qolip paddoni: QP-00012', `Qoliplar soni: ${result}`]);
    }
    replay.assertDone();
    assert.deepEqual(h.applied, []);
  });
}
