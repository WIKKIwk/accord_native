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
class ApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
const base = { '../shared/mobileApiException': { MobileApiException: ApiException },
  './rezkaSessionGuard': { currentRezkaScope: () => 'scope', guardedRezkaRequest: (_s, _access, _scope, _mutation, send) => send(() => {}) } };
const input = { source_barcode: ' B 1 ', source_stock_entry: ' SE ', source_line_index: 3, reason: ' test ',
  driver_url: ' http://printer/// ', printer: ' Zebra ', print_mode: ' label ', outputs: [{ item_code: ' I-1 ', item_name: ' Film ',
    qty: 2.5, uom: ' kg ', target_warehouse: ' WH ', reason: ' why ' }] };
const wire = { source_barcode: 'B 1', source_stock_entry: 'SE', source_line_index: 3, reason: 'test', driver_url: 'http://printer',
  printer: 'Zebra', print_mode: 'label', outputs: [{ item_code: 'I-1', item_name: 'Film', qty: 2.5, uom: 'kg',
    target_warehouse: 'WH', reason: 'why', print_qr: true }] };

test('selected V2 source: source query and all split paths, JSON and parsing', async () => {
  const sent = [];
  const api = load('rezka/rezkaSplitApi', { ...base, '../authorizedFetch': { authorizedFetch: async (_s, path, init = {}) => {
    sent.push({ path, ...init });
    return new Response(JSON.stringify(path.includes('/source?') ? { ok: true, source: { barcode: ' B1 ', line_index: '3.8', item_code: ' I-1 ', qty: '2.5', uom: ' kg ' } }
      : { ok: true, status: ' ready ', outputs: [{ epc: ' E1 ', qty: '2.5', print_qr: true }, { epc: ' E2 ', print_qr: false }] }), { status: 200 });
  } } });
  const source = await api.rezkaSource({}, ' B 1 ');
  assert.equal(new URL(sent[0].path, 'https://example.test').searchParams.get('barcode'), 'B 1');
  assert.equal(source.source.barcode, 'B1'); assert.equal(source.source.line_index, 3); assert.equal(source.source.qty, 2.5);
  const response = await api.rezkaSplit({}, input); await api.rezkaSplitClientPrintPrepare({}, input); await api.rezkaSplitClientPrintConfirm({}, input);
  assert.equal(response.status, 'ready'); assert.equal(response.outputs[0].epc, 'E1'); assert.equal(response.outputs[1].print_qr, false);
  assert.deepEqual(sent.slice(1).map(x => x.path), ['/v1/mobile/rezka/split', '/v1/mobile/rezka/split/client-print/prepare', '/v1/mobile/rezka/split/client-print/confirm']);
  for (const row of sent.slice(1)) { assert.equal(row.method, 'POST'); assert.equal(row.headers['Content-Type'], 'application/json'); assert.deepEqual(JSON.parse(row.body), wire); }
  assert.throws(() => api.withPreparedOutputs(input, response.outputs), /count mismatch/);
  const prepared = api.withPreparedOutputs(input, response.outputs.slice(0, 1));
  assert.deepEqual(api.splitRequestToJson(prepared).outputs, [{ epc: 'E1', ...wire.outputs[0] }]);
  assert.equal(input.outputs[0].epc, undefined);
});

test('V2 error fallbacks, strict status and malformed payload handling', async () => {
  let response = new Response(JSON.stringify({ error: ' bad_source ', detail: ' conflict ', message: 'later' }), { status: 409 });
  const api = load('rezka/rezkaSplitApi', { ...base, '../authorizedFetch': { authorizedFetch: async () => response } });
  await assert.rejects(api.rezkaSource({}, 'x'), e => e.code === 'bad_source' && e.message === 'conflict' && e.statusCode === 409);
  response = new Response('invalid', { status: 500 });
  await assert.rejects(api.rezkaSplit({}, input), e => e.code === 'rezka_split_failed' && e.message === 'Rezka split failed');
  response = new Response('invalid', { status: 200 });
  assert.deepEqual(await api.rezkaSplit({}, input), { ok: false, status: '', stock_entry_name: '', source_barcode: '', outputs: [] });
});

test('source model trims text, uses Dart-like number defaults and response filters non-objects', () => {
  const api = load('rezka/rezkaSplitApi', { ...base, '../authorizedFetch': {} });
  assert.deepEqual(api.sourceFromJson({ line_index: '-4.7', qty: '0x10', item_name: ' Film ', company: null }),
    { barcode: '', stock_entry_name: '', line_index: -4, item_code: '', item_name: 'Film', qty: 0, uom: '', warehouse: '', company: '' });
  assert.equal(api.splitResponseFromJson({ outputs: [false, null, { qty: '1e2' }] }).outputs[0].qty, 100);
  assert.equal(api.outputFromJson({ print_qr: 0 }).print_qr, true);
});

test('replays four calls captured from the custom V2 oracle at f11910bb', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'f11910bb/rezka_split_oracle_test', name = 'Rezka source and split requests and models at selected V2 baseline';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('rezka/rezkaSplitApi', { ...base, '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const source = await api.rezkaSource(session, ' B 1 ');
  assert.equal(source.source.qty, 2.5); assert.equal(source.source.line_index, 3);
  const response = await api.rezkaSplit(session, input);
  assert.equal(response.outputs[0].epc, 'E1');
  await api.rezkaSplitClientPrintPrepare(session, input);
  await api.rezkaSplitClientPrintConfirm(session, input);
  replay.assertDone();
});
