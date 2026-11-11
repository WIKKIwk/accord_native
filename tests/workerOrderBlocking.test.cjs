const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'),
  test = require('node:test'), ts = require('typescript'), vm = require('node:vm');
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

// Evaluate the actual screen conditions across a busy -> free -> stale transition.
const source = fs.readFileSync(path.resolve(__dirname, '../src/OrderScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('OrderScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selected = new Map();
(function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['allowed', 'busyNotice', 'waitingForSequence', 'showOutputProgress', 'showIntakeCandidates'].includes(node.name.text))
    selected.set(node.name.text, node.initializer.getText(ast));
  ts.forEachChild(node, visit);
})(ast);
assert.equal(selected.size, 5);
const code = ts.transpileModule([...selected].map(([name, value]) => `const ${name} = ${value};`).join('\n') +
  '\n({ allowed, busyNotice, waitingForSequence, showOutputProgress, showIntakeCandidates });', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function screen({ actions = [], reason = 'apparatus_busy', synchronized = true, isActiveOrder = true } = {}) {
  return vm.runInNewContext(code, { synchronized, isActiveOrder, safeStopRequest: null,
    control: { temporarily_paused: true, allowed_actions: actions }, interaction: { mode: 'paused', material_intake_allowed: true, blocking_reason_code: reason },
    detail: {}, scanningRequired: false, operation: 'print', showPreflightHold: false, showPreflightOutcome: false, showPreflightFreeze: false,
    apparatus: { name: '8 ta rangli bosma apparat' }, busyOrderTitle: 'shashoqcha', p: translate('uz'), workerOrderBusyText });
}
test('busy pause preserves server action denial and intake; a fresh resume permission restores resume/progress', () => {
  const busy = screen();
  assert.equal(busy.allowed.length, 0); assert.match(busy.busyNotice, /shashoqcha/);
  assert.equal(busy.showOutputProgress, false); assert.equal(busy.showIntakeCandidates, true);
  const free = screen({ actions: ['resume'], reason: '' });
  assert.deepEqual(Array.from(free.allowed), ['resume']); assert.equal(free.busyNotice, '');
  assert.equal(free.showOutputProgress, true); assert.equal(free.showIntakeCandidates, true);
});
test('synchronization loss or a frozen order cannot expose stale busy details or resume permission', () => {
  for (const change of [{ synchronized: false }, { isActiveOrder: false }]) {
    const state = screen({ actions: ['resume'], ...change });
    assert.equal(state.allowed.length, 0); assert.equal(state.busyNotice, ''); assert.equal(state.showOutputProgress, false);
  }
});
test('a paused order waiting for sequence retains its explicit server reason without gaining a resume action', () => {
  const state = screen({ reason: 'waiting_sequence' });
  assert.equal(state.waitingForSequence, true); assert.equal(state.allowed.length, 0);
  assert.equal(state.busyNotice, ''); assert.equal(state.showOutputProgress, false);
  assert.equal(screen().waitingForSequence, false);
});
