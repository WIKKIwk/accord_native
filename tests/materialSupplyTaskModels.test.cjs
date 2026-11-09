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
const controls = compile('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const apparatus = compile('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': controls });
const saved = compile('workerProductionMapSaved', { './workerControlsApi': controls });
const dart = compile('shared/dartApparatus', { '../workerControlsApi': controls });
const errors = compile('shared/mobileApiException');
const model = compile('shared/supplyTasks/supplyTaskModels', { '../../apparatusApi': apparatus, '../../workerProductionMapSaved': saved,
  '../dartApparatus': dart, '../mobileApiException': errors });
const golden = require('./contracts/f11910bb/material_supply_tasks.json');
function rowJson(row) {
  const { id, code, order_number, title, product_code, customer_name, image_id, position, apparatus_count, task_state } = row;
  return { id, code, order_number, title, product_code, customer_name, image_id, position, apparatus_count, task_state,
    ...(row.combo ? { combo: row.combo } : {}), ...(row.products.length ? { products: row.products } : {}) };
}
function summary(value) {
  const { kind, scope, epoch, revision, version, apparatus_id, limit, search, checked_count, missing_count } = value;
  return { kind, scope, epoch, revision, version, apparatus_id, limit, search, checked_count, missing_count,
    rows: value.rows.map(rowJson), apparatus_ids: value.apparatus.map(item => item.id) };
}
function outcome(fn) { try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, code: e.code ?? e.name }; } }

// @v2-test test/supply_tasks_api_test.dart
// These are source-derived cases evaluated by the adjacent f119 Dart oracle, not recorded HTTP traffic.
for (const [name, c] of Object.entries(golden.windows)) {
  if (name === 'floating_revision' || name === 'dart_unicode_apparatus') continue; // Explicit gaps are tested below.
  test(`f119 supply task window: ${name}`, () => {
    const actual = outcome(() => summary(model.supplyTaskWindowFromJson(c.input)));
    assert.deepEqual(actual, c.expected);
  });
}
for (const [name, c] of Object.entries(golden.messages)) {
  test(`f119 supply task message: ${name}`, () => {
    const baseline = model.supplyTaskWindowFromJson(golden.windows.material.input), before = summary(baseline);
    const actual = outcome(() => {
      const result = model.applySupplyTaskMessage(model.supplyTaskMessageFromJson(c.input), baseline);
      return { value: summary(result), same_object: result === baseline, baseline_rows: baseline.rows.map(row => row.id) };
    });
    const flattened = actual.ok ? { ok: true, ...actual.value } : actual;
    assert.deepEqual(flattened, c.expected); assert.deepEqual(summary(baseline), before, 'delta must not mutate baseline');
  });
}

test('task rows produce marked immutable presentation shells without graph or operations', () => {
  const window = model.supplyTaskWindowFromJson(golden.windows.material.input), row = window.rows[0];
  assert.equal(Object.isFrozen(window.rows), true); assert.equal(Object.isFrozen(window.apparatus), true);
  assert.equal(Object.isFrozen(window.apparatus[0]), true); assert.equal(Object.isFrozen(window.apparatus[0].capabilities), true);
  assert.throws(() => window.rows.push(row), TypeError);
  const shell = model.supplyTaskPresentationOrder(row);
  assert.equal(model.supplyTaskPresentationOrder(row), shell); assert.equal(model.isSupplyTaskPresentationOrder(shell), true);
  assert.equal(model.isSupplyTaskPresentationOrder({}), false);
  assert.deepEqual(shell.map.nodes, []); assert.deepEqual(shell.map.edges, []); assert.deepEqual(shell.program.operations, []);
  assert.equal(Object.isFrozen(shell), true); assert.equal(Object.isFrozen(shell.map), true);
  assert.throws(() => shell.map.nodes.push({}), TypeError); assert.throws(() => shell.program.operations.push({}), TypeError);
});

test('non-ASCII canonical apparatus is rejected until Dart/Hermes behavior is reviewed', () => {
  const value = golden.windows.dart_unicode_apparatus;
  assert.equal(value.expected.ok, true); // Actual f119 Dart result; native restriction is a false negative.
  assert.throws(() => model.supplyTaskWindowFromJson(value.input), error => error.code === 'supply_tasks_invalid');
});

test('floating cursor lexical form remains an explicit unported validation gap', () => {
  const text = fs.readFileSync(path.join(__dirname, 'contracts/f11910bb/material_supply_tasks.json'), 'utf8');
  assert.match(text, /"floating_revision"\s*:\s*\{[\s\S]*?"rev"\s*:\s*7\.0\s*,/);
  const value = golden.windows.floating_revision;
  assert.deepEqual(value.expected, { ok: false, code: 'supply_tasks_invalid' });
  // JSON.parse already erased the integer-vs-double distinction before this object-only parser receives it.
  assert.equal(model.supplyTaskWindowFromJson(value.input).revision, 7);
});
