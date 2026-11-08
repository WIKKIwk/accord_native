const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
const worker = load('workerOrderLogic', { './workerControlsApi': {} });
const rules = load('boyoqchi/returnedPaintRules', { '../workerOrderLogic': worker, './returnedPaintModel': model });
const station = 'apparatus:default:bosma_7';
const request = (extra = {}) => ({ id: 'r1', order_id: 'o1', order_code: '1212', order_name: 'Estello',
  apparatus: station, sender_role: 'aparatchi', sender_ref: 'w1', sender_display_name: 'Bosmachi',
  created_at_unix: 100, items: [], ...extra });
const item = (usage, values, name = 'Oq') => ({ usage, category: 'colors', name, values });

// Source-derived from V2 test/returned_paint_models_test.dart; no V2 HTTP recording exists for these endpoints.
test('models reject noncanonical apparatus and unknown roles, and preserve image-only waiting reports', () => {
  assert.throws(() => model.returnedPaintRequestFromJson(request({ apparatus: '7 ta rangli bosma' })), /canonical apparatus/);
  assert.throws(() => model.returnedPaintRequestFromJson(request({ sender_role: 'unknown' })), /Unsupported user role/);
  const result = model.returnedPaintRequestFromJson(request({ apparatus: ` ${station} `, sender_role: ' OMBORCHI ',
    status: ' waiting_for_boyoqchi_input ', image: { image_id: 'image-1', image_name: 'qoldiq.jpg', image_mime: 'image/jpeg',
      image_size_bytes: 123.9, image_url: '/v1/mobile/returned-paint/images/view?id=image-1' } }));
  assert.equal(result.apparatus, station);
  assert.equal(result.sender_role, 'werka');
  assert.equal(result.status, 'waiting_for_boyoqchi_input');
  assert.equal(result.image.image_size_bytes, 123);
  assert.equal(result.image.image_url, '/v1/mobile/returned-paint/images/view?id=image-1');
  assert.equal(result.calculation, null);
  assert.equal(result.created_at.getTime(), 100_000);
});

test('models separate usage, coerce V2 values, parse totals and retain page defaults', () => {
  const parsed = model.returnedPaintRequestPageFromJson({ has_more: true, items: [null, request({
    items: [item('rasxot', { Mix: 3 }), item('astatka', { Mix: 1.5 })],
    calculation: { rasxot_mix_total: ' 3 ', final_used_alcohol: '0.45', final_used_paint: '1.05' },
  })] });
  assert.equal(parsed.has_more, true);
  assert.deepEqual(parsed.items[0].items.map(x => [x.usage, x.values.Mix]), [['rasxot', '3'], ['astatka', '1.5']]);
  assert.equal(parsed.items[0].calculation.rasxot_mix_total, '3');
  assert.equal(parsed.items[0].calculation.final_used_alcohol, '0.45');
  assert.equal(parsed.items[0].calculation.astatka_alcohol, '');
  assert.deepEqual(model.returnedPaintRequestPageFromJson({}), { items: [], has_more: false });
  assert.throws(() => model.returnedPaintRequestPageFromJson({ items: 'not-list' }), /Expected a list/);
  assert.throws(() => model.returnedPaintRequestFromJson(request({ created_at_unix: '100' })), /finite number/);
  assert.equal(model.returnedPaintStatusFromJson('WAITING_FOR_BOYOQCHI_INPUT'), 'completed');
});

test('submission serialization retains V2 field values and includes only a nonblank image id', () => {
  const value = { order_id: ' order ', order_code: '1212', order_name: 'Name', apparatus: station, image_id: ' img-1 ',
    items: [item('rasxot', { Mix: '1.50' })] };
  assert.deepEqual(model.returnedPaintSubmissionToJson(value), { ...value, image_id: 'img-1' });
  assert.equal(Object.hasOwn(model.returnedPaintSubmissionToJson({ ...value, image_id: '  ' }), 'image_id'), false);
  assert.deepEqual(model.returnedPaintCompleteToJson({ request_id: ' request ', items: value.items }),
    { request_id: ' request ', items: value.items });
});

test('Astatka total matches V2 filtering, blanks, numeric parse and nonfinite guards', () => {
  assert.equal(model.returnedPaintAstatkaTotal([]), null);
  assert.equal(model.returnedPaintAstatkaTotal([item('rasxot', { Mix: '3' })]), 0);
  assert.equal(model.returnedPaintAstatkaTotal([item('rasxot', { Mix: '9' }), item(' ASTATKA ', { Mix: '1.25', Oq: '0.75' }),
    item('astatka', { Etil: '0.5' })]), 2.5);
  for (const invalid of ['', 'NaN', 'Infinity', '0x10', '1kg']) {
    assert.equal(model.returnedPaintAstatkaTotal([item('astatka', { Mix: invalid })]), null);
  }
  assert.equal(model.returnedPaintAstatkaTotal([item('astatka', { Mix: '1e2' })]), 100);
});

test('draft collection preserves both usage tabs, Pantone/Mix order and decimal normalization', () => {
  const draft = { values: { 'rasxot:Pantone': ['2'], 'rasxot:Pantone Mix': ['1,5'], 'rasxot:Oq': ['3', '', '', '', '', '', '', ''],
    'astatka:Spirtlar': ['0,25', '', '', '', ''] }, dynamic_field_labels: { 'rasxot:Pantone': ['Blue shade'],
    'rasxot:Pantone Mix': ['Recipe A'] } };
  const items = rules.returnedPaintItemsFromDraft(draft);
  assert.deepEqual(items, [item('rasxot', { 'Blue shade': '2' }, 'Pantone'), item('rasxot', { 'Recipe A': '1.5' }, 'Mix'),
    item('rasxot', { Mix: '3' }), { usage: 'astatka', category: 'solvents', name: 'Spirtlar', values: { Aralashmalar: '0.25' } }]);
  draft.values['rasxot:Oq'][0] = '-1';
  assert.equal(rules.returnedPaintItemsFromDraft(draft).some(x => x.name === 'Oq'), false);
});

test('report close rule requires three fields in each usage or a purely image-only input', () => {
  const r3 = item('rasxot', { Mix: '10', '1w Oq': '2', '7w Oq': '1' });
  const a3 = item('astatka', { Mix: '5', '1w Oq': '1', '7w Oq': '1' });
  assert.equal(rules.returnedPaintReportCanClose([], ' image-1 '), true);
  assert.equal(rules.returnedPaintReportCanClose([r3, a3], ''), true);
  assert.equal(rules.returnedPaintReportCanClose([r3], ''), false);
  assert.equal(rules.returnedPaintReportCanClose([item('rasxot', { Mix: '10' }), a3], 'image-1'), false);
  assert.equal(rules.returnedPaintFilledFieldCountForUsage([r3, a3], ' RASXOT '), 3);
});

test('draft numeric precision, malformed entries and Boyoqchi actor scope follow V2', () => {
  for (const text of ['.', '-1', '1.123456789012', '1000000000000000000', '999999999999999999.1', '1e2']) {
    assert.equal(rules.isValidReturnedPaintNumber(text), false, text);
  }
  for (const text of ['0', '1.', '1,25', '000000000000000000001.12345678901', '999999999999999999.000']) {
    assert.equal(rules.isValidReturnedPaintNumber(text), true, text);
  }
  const draft = { values: { 'rasxot:Oq': ['.'] }, dynamic_field_labels: {} };
  assert.equal(rules.returnedPaintDraftHasInvalidValues(draft), true);
  draft.values['rasxot:Oq'][0] = '1.25';
  assert.equal(rules.returnedPaintDraftHasInvalidValues(draft), false);
  assert.equal(rules.returnedPaintBoyoqchiDraftScope(' actor ', ' request '), 'boyoqchi:actor:request');
});
