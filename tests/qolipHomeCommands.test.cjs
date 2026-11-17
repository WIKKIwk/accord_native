const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), moduleValue = new Module(filename, module);
  moduleValue.require = target => target in dependencies ? dependencies[target] : require(target);
  moduleValue._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return moduleValue.exports;
}
const locations = load('qolip/qolipLocationLogic.ts', { './qolipApiCommon': { trimDart: value => value.trim() } });
const commands = load('qolip/qolipHomeCommands.ts', { './qolipLocationLogic': locations });
const source = { id: 'source', block: 'Alpha', warehouse: 'W', item_name: 'Product', qolip_code: 'Q1', quantity: 3, location_label: 'A1' };
const target = { block: { name: 'Beta', warehouse: 'W2' }, rowLetter: 'B', columnNumber: 2 };
const moved = { ...source, id: 'moved', block: 'Beta', warehouse: 'W2', row_letter: 'B', column_number: 2, location_label: 'B2' };

test('Home move validates server location and fresh target contents before reporting success', async () => {
  const calls = [];
  const result = await commands.moveQolipHomeLocations([source], target, {
    current: () => true,
    single: async (item, destination, quantity) => { calls.push(['single', item.id, destination, quantity]); return moved; },
    multiple: async () => assert.fail('single move must not send a batch'),
    refresh: async name => { calls.push(['refresh', name]); return name === 'Beta' ? [moved] : []; },
  }, 2);
  assert.deepEqual(result, { kind: 'moved', target });
  assert.deepEqual(calls, [['single', 'source', target, 2], ['refresh', 'Alpha'], ['refresh', 'Beta']]);
});
test('Home move does not announce success for wrong server destination or absent readback', async () => {
  for (const rows of [[], [{ ...moved, id: 'other' }]]) {
    const result = await commands.moveQolipHomeLocations([source], target, { current: () => true, single: async () => moved,
      multiple: async () => [], refresh: async () => rows }, 1);
    assert.deepEqual(result, { kind: 'unconfirmed', location: 'Beta / B2' });
  }
  const wrong = { ...moved, block: 'Gamma' };
  const result = await commands.moveQolipHomeLocations([source], target, { current: () => true, single: async () => wrong,
    multiple: async () => [], refresh: async () => [wrong] }, 1);
  assert.deepEqual(result, { kind: 'unconfirmed', location: 'Gamma / B2' });
});
test('Home batch move keeps source quantities and verifies every selected mold code', async () => {
  const second = { ...source, id: 'source2', qolip_code: 'Q2', block: 'Gamma' }, next = { ...moved, id: 'moved2', qolip_code: 'Q2' };
  let request;
  const result = await commands.moveQolipHomeLocations([source, second], target, { current: () => true,
    single: async () => assert.fail('batch move must not send individual mutations'),
    multiple: async items => { request = items; return [next, moved]; }, refresh: async name => name === 'Beta' ? [moved, next] : [] });
  assert.deepEqual(request, [source, second]); assert.deepEqual(result, { kind: 'moved', target });
});
test('Home mutation result cannot trigger refresh or success after original session expires', async () => {
  let current = true;
  const result = await commands.moveQolipHomeLocations([source], target, { current: () => current,
    single: async () => { current = false; return moved; }, multiple: async () => [], refresh: async () => assert.fail('expired owner cannot refresh') }, 1);
  assert.equal(result, null);
});
test('Home issue preserves V2 one-unit sequential partial success and first failure', async () => {
  const rows = [source, { ...source, id: 'two' }, { ...source, id: 'three', block: 'Beta' }], calls = [], error = new Error('first');
  const result = await commands.issueQolipHomeSelection(rows, 'worker', { current: () => true,
    issue: async (item, worker) => { calls.push(['issue', item.id, worker]); if (item.id !== 'two') throw error; },
    refresh: async block => { calls.push(['refresh', block]); } });
  assert.equal(result.success, 1); assert.equal(result.failed, 2); assert.equal(result.firstError, error);
  assert.deepEqual(calls, [['issue', 'source', 'worker'], ['issue', 'two', 'worker'], ['issue', 'three', 'worker'], ['refresh', 'Alpha'], ['refresh', 'Beta']]);
});
test('Home issue stops remaining mutations when original account expires during a send', async () => {
  let current = true, writes = 0;
  const result = await commands.issueQolipHomeSelection([source, source], 'worker', { current: () => current,
    issue: async () => { writes++; current = false; }, refresh: async () => assert.fail('no expired refresh') });
  assert.equal(writes, 1); assert.equal(result, null);
});
test('Home quantity parsing keeps validation order and positive whole-stock bounds', () => {
  for (const input of ['', '0', '-1', '1.5', 'text']) assert.deepEqual(commands.qolipHomeQuantity(input, 3), { quantity: null, error: 'home.invalid_count' });
  assert.deepEqual(commands.qolipHomeQuantity('4', 3), { quantity: null, error: 'home.only_count' });
  assert.deepEqual(commands.qolipHomeQuantity(' 03 ', 3), { quantity: 3, error: null });
});
