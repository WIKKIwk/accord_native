const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const errors = compile('shared/mobileApiException');
function setup(reader) {
  class Exception extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
  return compile('shared/rawMaterialAssignmentApi', { '../apparatusApi': { readApparatus: reader }, '../workerControlsApi': {
    isCanonicalApparatusId: value => /^apparatus:[a-z0-9_-]+:[a-z0-9_-]+$/.test(value),
    productionMapResponseError: (status, payload, fallback) => new Exception(payload?.error ?? fallback, 'server', status), WorkerControlException: Exception,
  }, './mobileApiException': errors });
}
const station = 'apparatus:default:asset-007';

// @v2-test test/admin_raw_material_api_test.dart
// These source-derived fixtures use V2 HttpOverrides rather than the recorder's MockClient hook.
test('candidate reader sends selected order and apparatus and decodes the V2 width match', async () => {
  const requests = [], api = setup(async (_session, url, retry) => { requests.push({ url, retry }); return { response: { status: 200 }, body: JSON.stringify([{
    barcode: 'RM-001', warehouse: 'Kalidor', item_code: 'ROLL-690', item_name: 'CPP 690/35', item_group: 'Rulon eni', qty: 11, uom: 'Kg',
    apparatus_options: [station, ` ${station} `], order_width_mm: 660, roll_width_mm: 690, leftover_width_mm: 30, match_type: 'closest_width',
  }]) }; });
  const values = await api.adminRawMaterialAssignmentCandidates({}, ' zakaz-1 ', ` ${station} `);
  assert.equal(requests[0].retry, false); assert.deepEqual(Object.fromEntries(new URL(requests[0].url, 'https://example.test').searchParams),
    { order_id: 'zakaz-1', apparatus: station });
  assert.equal(values[0].barcode, 'RM-001'); assert.deepEqual(values[0].apparatus_options, [station]);
  assert.equal(values[0].roll_width_mm, 690); assert.equal(values[0].leftover_width_mm, 30); assert.equal(values[0].match_type, 'closest_width');
  assert.equal(api.rawMaterialAssignmentCandidate({}).match_type, 'compatible');
});

test('diagnostic reader preserves mismatch dimensions and skips absent optional query fields', async () => {
  const requests = [], api = setup(async (_session, url) => { requests.push(url); return { response: { status: 200 }, body: JSON.stringify({
    barcode: 'RM-UNDER', compatible: false, reason: ' raw_material_roll_size_mismatch ', order_width_mm: 985, roll_width_mm: 970,
    minimum_width_mm: 975, maximum_width_mm: 1015, apparatus_options: ['apparatus:default:asset-005'],
  }) }; });
  const d = await api.adminRawMaterialAssignmentDiagnostics({}, ' RM-UNDER ', ' zakaz-1 ', 'apparatus:default:asset-005');
  assert.deepEqual(Object.fromEntries(new URL(requests[0], 'https://example.test').searchParams),
    { barcode: 'RM-UNDER', order_id: 'zakaz-1', apparatus: 'apparatus:default:asset-005' });
  assert.equal(d.reason, 'raw_material_roll_size_mismatch'); assert.equal(d.compatible, false);
  assert.deepEqual([d.order_width_mm, d.roll_width_mm, d.minimum_width_mm, d.maximum_width_mm], [985, 970, 975, 1015]);
  await api.adminRawMaterialAssignmentDiagnostics({}, 'x'); assert.deepEqual(Object.fromEntries(new URL(requests[1], 'https://example.test').searchParams), { barcode: 'x' });
});

test('invalid scope, malformed values, empty QR and server errors fail before producing data', async () => {
  let calls = 0; const api = setup(async () => { calls++; return { response: { status: 403 }, body: '{"error":"denied"}' }; });
  await assert.rejects(api.adminRawMaterialAssignmentCandidates({}, 'order', 'Bosma'), error => error.code === 'apparatus_id_invalid');
  await assert.rejects(api.adminRawMaterialAssignmentDiagnostics({}, ' '), error => error.code === 'raw_material_invalid_input');
  assert.throws(() => api.rawMaterialAssignmentCandidate({ qty: '11' }), TypeError);
  assert.throws(() => api.rawMaterialAssignmentDiagnostic({ apparatus_options: 'bad' }), error => error.code === 'apparatus_id_invalid');
  assert.throws(() => api.rawMaterialAssignmentDiagnostic({ apparatus_options: ['Bosma'] }), error => error.code === 'apparatus_id_invalid');
  assert.equal(calls, 0); await assert.rejects(api.adminRawMaterialAssignmentDiagnostics({}, 'x'), error => error.code === 'denied'); assert.equal(calls, 1);
});
