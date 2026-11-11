const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'),
  test = require('node:test'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/workerOrderBlocking.ts'), mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { workerOrderBusyTitle, workerOrderBusyText } = mod.exports;
const machine = 'apparatus:default:bosma_8';
const order = (id, title = id) => ({ id, title, code: id, state: 'paused', imageId: '', customer: '', cardTone: 'paused' });
const queue = (states, controls = {}) => ({ snapshot: { queue_states: { [machine]: states }, queue_action_controls: { [machine]: controls } },
  orders: { [machine]: [order('0198', 'mofun keks'), order('0337', 'shashoqcha'), order('0304', 'keks')] } });
const production = require('../src/shared/localization/catalog.json').production;
const translate = locale => (key, values = {}) => {
  assert.ok(production[key], key);
  return production[key][locale].replace(/\{([^}]+)\}/g, (_match, name) => values[name] ?? `{${name}}`);
};

test('temporary pause resolves the other running order on the same apparatus, independently of display state', () => {
  const data = queue({ '0198': 'paused', '0337': 'in_progress', '0304': 'pending' });
  assert.equal(workerOrderBusyTitle(data, machine, '0198'), 'shashoqcha');
  assert.equal(workerOrderBusyTitle(data, 'another-machine', '0198'), '');
  assert.equal(workerOrderBusyTitle(data, machine, '0337'), '');
});
test('busy labels recover from running/freeze-requested controls when queue states have not arrived', () => {
  for (const mode of ['in_progress', 'freeze_requested']) assert.equal(workerOrderBusyTitle(queue({}, { '0337': { interaction: { mode } } }), machine, '0198'), 'shashoqcha');
  assert.equal(workerOrderBusyTitle(queue({ '0198': 'paused', '0337': 'paused' }), machine, '0198'), '');
});
test('missing queue/row/name data uses the V2 generic busy notice without inventing a label', () => {
  assert.equal(workerOrderBusyTitle(null, machine, '0198'), '');
  assert.equal(workerOrderBusyTitle(queue({ missing: 'in_progress' }), machine, '0198'), '');
  for (const labels of [['', 'shashoqcha'], ['8 ta rangli bosma apparat', '']])
    assert.equal(workerOrderBusyText('apparatus_busy', ...labels, translate('uz')), production['worker.waiting.apparatus_busy'].uz);
});
for (const locale of ['uz', 'en', 'ru', 'ur']) test(`${locale}: busy explanation uses the exact V2 localized apparatus/order text`, () => {
  const value = workerOrderBusyText(' APPARATUS_BUSY ', ' 8 ta rangli bosma apparat ', ' shashoqcha ', translate(locale));
  assert.equal(value, production['worker.waiting.apparatus_busy_detail'][locale].replace('{apparatus}', '8 ta rangli bosma apparat').replace('{order}', 'shashoqcha'));
  assert.equal(workerOrderBusyText('', 'machine', 'order', translate(locale)), '');
  assert.equal(workerOrderBusyText('waiting_sequence', 'machine', 'order', translate(locale)), '');
});

// Transition and visibility coverage now renders OrderScreen on both platforms in workerOrderStates.test.cjs.
