// Pure source-derived projections only. No customer API, picker owner or shared search store.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const filename = path.resolve(file.endsWith('.ts') || file.endsWith('.json') ? file : `${file}.ts`);
  if (filename.endsWith('.json')) return require(filename);
  if (cache.has(filename)) return cache.get(filename);
  const module = new Module(filename); module.filename = filename; module.paths = require.main.paths; cache.set(filename, module.exports);
  module.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  cache.set(filename, module.exports); return module.exports;
}
const api = load(path.resolve(__dirname, '../src/werka/werkaCustomerSearch.ts'));
const fixture = require('./contracts/f11910bb/werka_customer_search_oracle.json');

test('generated lowercase and source normalization match all Dart Unicode scalars', () => {
  const data = require('../src/werka/werkaDartLowercaseData.json');
  assert.deepEqual(data, fixture.lowercase); assert.equal(Object.keys(data).length, 1023);
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const value = String.fromCodePoint(code);
    assert.equal(api.werkaDartLowercase(value), fixture.lowercase[String(code)] ?? value, `U+${code.toString(16)}`);
    assert.equal(api.werkaCustomerSearchNormalize(value), fixture.normalizedScalars[String(code)] ?? value, `normalize U+${code.toString(16)}`);
  }
});

test('Dart whole-string lowercasing and source normalization replay seeded cases', () => {
  assert.equal(fixture.normalized.length, 716);
  for (const row of fixture.normalized) {
    assert.equal(api.werkaDartLowercase(row.input), row.lower, `lowercase ${JSON.stringify(row.input)}`);
    assert.equal(api.werkaCustomerSearchNormalize(row.input), row.normalized, `normalize ${JSON.stringify(row.input)}`);
  }
  assert.equal(api.werkaDartLowercase('ΟΣ'), 'οσ');
  assert.equal(api.werkaDartLowercase('İ'), 'i');
  assert.equal(api.werkaCustomerSearchNormalize('\u0085'), '');
});

test('source relevance scores match exact imported Dart samples', () => {
  assert.equal(fixture.scores.length, 5012);
  for (const row of fixture.scores) assert.equal(api.werkaCustomerSearchScore(row.query, row.primary, row.secondary), row.score,
    JSON.stringify({ query: row.query, primary: row.primary, secondary: row.secondary }));
  assert.equal(api.werkaCustomerSearchScore('abc', 'zzİabc'), 7200);
  assert.equal(api.werkaCustomerSearchScore('abc', 'none', ['abc']), 9000);
  assert.equal(api.werkaCustomerSearchScore('ای', 'ای'), 0);
});

test('single-query customer order matches source while retaining objects, ties and duplicates', () => {
  assert.equal(fixture.orders.length, 162);
  for (const row of fixture.orders) {
    const items = row.items.map(item => Object.freeze({ ...item })); Object.freeze(items);
    const ordered = api.werkaBatchCustomerSearchOrder(row.query, items);
    assert.deepEqual(ordered.map(item => items.indexOf(item)), row.indices, JSON.stringify(row.query));
    assert.notEqual(ordered, items);
  }
  const sample = fixture.orders[0], result = api.werkaBatchCustomerSearchOrder(sample.query, sample.items);
  assert.deepEqual(result.map(item => sample.items.indexOf(item)), [3, 2, 1, 0]);
});

test('appending a page ranks the complete raw accumulation rather than separately sorted pages', () => {
  const a = { ref: '1', name: 'Other', phone: '' }, b = { ref: '1', name: 'abc', phone: '' }, c = { ref: '2', name: 'abc', phone: '' };
  const firstPage = Object.freeze([a]), all = Object.freeze([a, b, c]);
  assert.deepEqual(api.werkaBatchCustomerSearchOrder('abc', firstPage), [a]);
  assert.deepEqual(api.werkaBatchCustomerSearchOrder('abc', all), [b, c, a]);
  assert.deepEqual(all, [a, b, c]);
});

test('the search projection has no owner, API or activity-store dependency', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/werka/werkaCustomerSearch.ts'), 'utf8');
  assert.doesNotMatch(source, /authorizedFetch|SearchActivityStore|werkaCustomers|expo-router/);
});
