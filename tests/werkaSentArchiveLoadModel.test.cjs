// Source-state descriptions only. No request, account, Flutter widget or native view is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const filename = [file, `${file}.ts`, path.join(file, 'index.ts')]
    .find(value => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!filename) throw Error(file);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const root = path.resolve(__dirname, '../src/werka');
const loadModel = load(path.join(root, 'werkaSentArchiveLoadModel.ts'));
const sent = load(path.join(root, 'werkaSentArchiveModel.ts'));
function date(year, month, day) {
  const value = new Date(0); value.setHours(12, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const calendar = () => sent.werkaSentArchiveInitial(date(2026, 11, 8));
const body = value => sent.werkaSentArchiveBody(value.loading, value.error, value.activeDays, value.activeMonths, value.activeYears);

test('three source starts share one loading flag and any single completion clears it', () => {
  let value = loadModel.werkaSentArchiveLoadInitial(); assert.equal(body(value), 'loading');
  for (let i = 0; i < 3; i++) value = loadModel.werkaSentArchiveLoadStarted(value);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'daily', [], calendar());
  value = loadModel.werkaSentArchiveLoadFinished(value);
  assert.equal(value.loading, false); assert.equal(body(value), 'content');
  // Monthly/yearly completions have not occurred; V2 does not track a pending count.
  assert.deepEqual([...value.activeMonths], []); assert.deepEqual([...value.activeYears], []);
});

test('first error survives another success until a new load starts', () => {
  const failure = Error('offline'); let value = loadModel.werkaSentArchiveLoadInitial();
  value = loadModel.werkaSentArchiveLoadStarted(value); value = loadModel.werkaSentArchiveLoadFailed(value, failure);
  value = loadModel.werkaSentArchiveLoadFinished(value); assert.equal(body(value), 'error');
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'monthly', ['2026-03-10'], calendar());
  value = loadModel.werkaSentArchiveLoadFinished(value);
  assert.equal(value.error, failure); assert.deepEqual([...value.activeMonths], [3]); assert.equal(body(value), 'content');
  const next = loadModel.werkaSentArchiveLoadStarted(value);
  assert.equal(next.error, null); assert.equal(next.loading, true); assert.deepEqual([...next.activeMonths], [3]);
});

test('daily, monthly and yearly successes replace only their own set, preserving source order and deduplication', () => {
  let value = loadModel.werkaSentArchiveLoadInitial(); const current = calendar();
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'daily', ['2026-11-08', '2026-11-02', '2026-11-08', '2026-10-31', 'bad'], current);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'monthly', ['2026-12-01', '2026-03-10', '2025-01-01'], current);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'yearly', ['2021-01-01', '2032-12-31', '2033-01-01'], current);
  assert.deepEqual([...value.activeDays], [8, 2]); assert.deepEqual([...value.activeMonths], [12, 3]);
  assert.deepEqual([...value.activeYears], [2021, 2032]);
  const replaced = loadModel.werkaSentArchiveLoadSucceeded(value, 'monthly', ['2026-06-01'], current);
  assert.deepEqual([...replaced.activeDays], [8, 2]); assert.deepEqual([...replaced.activeMonths], [6]);
  assert.deepEqual([...replaced.activeYears], [2021, 2032]); assert.deepEqual([...value.activeMonths], [12, 3]);
});

test('an old response is filtered against the page current at completion, as V2 does', () => {
  const original = calendar(), current = { ...original, displayMonth: date(2026, 12, 1), displayYear: 2027, firstYear: 2033 };
  let value = loadModel.werkaSentArchiveLoadInitial();
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'daily', ['2026-11-08'], current);
  assert.deepEqual([...value.activeDays], []);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'daily', ['2026-11-08', '2026-12-04'], current);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'monthly', ['2026-02-01', '2027-05-01'], current);
  value = loadModel.werkaSentArchiveLoadSucceeded(value, 'yearly', ['2021-01-01', '2034-01-01'], current);
  assert.deepEqual([...value.activeDays], [4]); assert.deepEqual([...value.activeMonths], [5]);
  assert.deepEqual([...value.activeYears], [2034]);
});

test('loading and error changes preserve existing content and do not mutate prior states', () => {
  const initial = loadModel.werkaSentArchiveLoadInitial(), current = calendar();
  const withDays = loadModel.werkaSentArchiveLoadSucceeded(initial, 'daily', ['2026-11-08'], current);
  const failure = Error('offline'), started = loadModel.werkaSentArchiveLoadStarted(withDays);
  const failed = loadModel.werkaSentArchiveLoadFailed(started, failure), finished = loadModel.werkaSentArchiveLoadFinished(failed);
  assert.equal(body(started), 'content'); assert.equal(body(finished), 'content');
  assert.equal(finished.error, failure); assert.deepEqual([...finished.activeDays], [8]);
  assert.deepEqual([...initial.activeDays], []); assert.equal(initial.error, null); assert.equal(initial.loading, true);
});

test('an unknown panel is rejected rather than treated as a yearly result', () => {
  assert.throws(() => loadModel.werkaSentArchiveLoadSucceeded(loadModel.werkaSentArchiveLoadInitial(), 'custom', [], calendar()), RangeError);
});
