const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture(rows = []) {
  const filename = path.resolve(__dirname, '../src/shared/catalogApi.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === '../authorizedFetch' ? { authorizedFetch: async () => ({ status: 200, json: async () => rows }) }
    : name === './mobileApiException' ? { MobileApiException: class extends Error {} }
      : name === '../appPreferences' ? { appPreferences: {} }
        : name === './searchActivityStore' ? { SearchActivityStore: class { sortByItemCode(_session, items) { return items; } } } : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('exported supplier item decoder retains defaults and all field transformations', () => {
  const { supplierItemFromJson: parse } = fixture();
  assert.deepEqual(parse({}), { code: '', name: '', uom: '', warehouse: '', item_group: '', requires_dimensions: false,
    order_apparatus_options: {}, order_microns: [], customer_names: [] });
  const options = JSON.parse('{"__proto__":"safe","cut":4,"other":null}');
  const result = parse({ code: 'A', name: 'Name', uom: 'kg', warehouse: 'W', item_group: 'Group', requires_dimensions: true,
    order_apparatus_options: options, order_microns: [12, '13', 14.5, null], customer_names: [' A ', '', null, 7] });
  assert.deepEqual({ ...result, order_apparatus_options: undefined }, { code: 'A', name: 'Name', uom: 'kg', warehouse: 'W', item_group: 'Group',
    requires_dimensions: true, order_apparatus_options: undefined, order_microns: [12, 14.5], customer_names: ['A', 'null', '7'] });
  assert.equal(Object.hasOwn(result.order_apparatus_options, '__proto__'), true);
  assert.equal(result.order_apparatus_options.__proto__, 'safe'); assert.equal(result.order_apparatus_options.cut, '4');
  assert.equal(result.order_apparatus_options.other, 'null');
});

test('decoder retains existing malformed type and validation behavior', () => {
  const { supplierItemFromJson: parse } = fixture();
  for (const value of [null, [], false, 3, 'x']) assert.throws(() => parse(value), /Invalid object/);
  for (const field of ['code', 'name', 'uom', 'warehouse', 'item_group']) assert.throws(() => parse({ [field]: 3 }), /Invalid item string/, field);
  for (const field of ['order_microns', 'customer_names']) assert.throws(() => parse({ [field]: 'bad' }), /Invalid item list/, field);
  assert.throws(() => parse({ order_apparatus_options: [], code: 3 }), /Invalid object/);
  assert.equal(parse({ customer_names: ['\u0085A\u0085'] }).customer_names[0], '\u0085A\u0085');
});

test('existing GScale reader uses the same exported decoder', async () => {
  const rows = [{ code: 'A', order_microns: [2, '3'] }, { code: 'B', customer_names: [null] }];
  const api = fixture(rows);
  assert.deepEqual(await api.gscaleItemsPage({}, {}), rows.map(api.supplierItemFromJson));
  await assert.rejects(fixture([{} , null]).gscaleItemsPage({}, {}), /Invalid object/);
});
