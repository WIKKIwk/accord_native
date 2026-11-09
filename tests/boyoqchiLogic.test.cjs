const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
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
const logic = load('boyoqchi/boyoqchiLogic', { './returnedPaintModel': model, './returnedPaintRules': rules });
const request = { id: '', order_id: ' id ', order_code: ' 42 ', order_name: ' Name ', sender_display_name: ' ', sender_ref: 'worker:abc',
  created_at: new Date(2026, 10, 8, 10, 9, 4) };

test('request keys, labels and human-only apparatus/operator display follow V2 fallbacks', () => {
  assert.equal(logic.boyoqchiRequestKey(request), 'id|42|2026-11-08T10:09:04.000');
  assert.equal(logic.boyoqchiRequestKey({ ...request, id: ' r1 ' }), 'r1');
  assert.equal(logic.boyoqchiOrderLabel(request), 'Name — #42');
  assert.equal(logic.boyoqchiOrderLabel({ ...request, order_name: '' }), '#42');
  assert.equal(logic.boyoqchiOrderLabel({ ...request, order_name: '', order_code: '' }), 'id');
  assert.equal(logic.boyoqchiOperator(request), '—');
  assert.equal(logic.boyoqchiOperator({ ...request, sender_ref: 'Display' }), 'Display');
  assert.equal(logic.boyoqchiApparatusLabel('apparatus:default:one', []), '—');
  assert.equal(logic.boyoqchiApparatusLabel('apparatus:default:one', [{ id: 'apparatus:default:one', name: ' Press ' }]), 'Press');
  assert.equal(logic.boyoqchiDate(request.created_at), '08.11.2026 10:09');
});

test('Home groups nonempty values by category in order and formats fields', () => {
  const items = [ { usage: 'rasxot', category: 'colors', name: ' Oq ', values: { Mix: '1.2500', Empty: '' } },
    { usage: 'rasxot', category: 'solvents', name: 'Spirtlar', values: { Etil: '0.5' } },
    { usage: 'rasxot', category: 'colors', name: 'Ko‘k', values: { Qora: '2' } },
    { usage: 'astatka', category: 'colors', name: 'Oq', values: { Mix: '0' } },
    { usage: 'rasxot', category: ' ', name: 'ignore', values: { Mix: '3' } } ];
  const groups = logic.boyoqchiGroups(items, 'rasxot');
  assert.deepEqual(groups.map(x => [logic.boyoqchiCategoryLabel(x.category), x.items.length]), [['Ranglar', 2], ['Spirtlar', 1]]);
  assert.equal(logic.boyoqchiItemText(groups[0].items[0]), 'Oq: Mix — 1.25');
  assert.equal(logic.boyoqchiNumber('invalid'), 'invalid');
  assert.equal(logic.boyoqchiAmount('1.5000'), '1.5 kg');
  assert.equal(logic.boyoqchiAmount('0.000'), '0 kg');
  assert.equal(logic.boyoqchiAmount(''), '—');
});

test('sheet input and submission errors follow both usage counters', () => {
  for (const value of ['', '0', '12.', '12,5']) assert.equal(logic.boyoqchiInputAllowed(value), true);
  for (const value of ['.', '-1', '1,2,3', '1e3']) assert.equal(logic.boyoqchiInputAllowed(value), false);
  const draft = { values: { 'rasxot:Oq': ['1', '2', '3'], 'astatka:Oq': ['1', '2'] }, dynamic_field_labels: {} };
  assert.equal(logic.boyoqchiSaveInput(draft).error, 'Har bir tabda kamida 3 ta maydon to‘ldiring. Rasxot: 3/3, Astatka: 2/3.');
  draft.values['astatka:Oq'][2] = '3';
  assert.equal(logic.boyoqchiSaveInput(draft).error, '');
  draft.values['astatka:Oq'][0] = '1.123456789012';
  assert.equal(logic.boyoqchiSaveInput(draft).error, 'Qaytarilgan bo‘yoq qiymatlarini to‘g‘ri raqamda kiriting.');
});
