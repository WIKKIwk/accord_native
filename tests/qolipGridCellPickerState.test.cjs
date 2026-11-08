const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/'); if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
function harness(exclude) {
  let current = true; const listeners = new Set();
  const boundary = { current: () => current, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
  const owner = new (load('qolip/qolipGridCellPickerState.ts').QolipGridCellPickerState)(exclude, boundary);
  return { owner, listeners, boundary, invalidate: () => { current = false; for (const callback of [...listeners]) callback(); }, revive: () => { current = true; } };
}

test('grid picker starts at A, or the normalized excluded cell letter, with exact 1–13 options', () => {
  const a = harness(), c = harness(' c5 '); a.owner.activate(); c.owner.activate();
  assert.equal(a.owner.getSnapshot().selectedLetter, 'A'); assert.equal(a.owner.getSnapshot().grid.length, 13);
  assert.deepEqual(a.owner.getSnapshot().grid.slice(0, 2), [{ label: 'A1', excluded: false }, { label: 'A2', excluded: false }]);
  assert.equal(c.owner.getSnapshot().selectedLetter, 'C'); assert.equal(c.owner.getSnapshot().grid[4].excluded, true);
  assert.equal(c.owner.gridChoice('C5'), null); assert.equal(c.owner.gridChoice('C6'), 'C6'); a.owner.suspend(); c.owner.suspend();
});

test('source exclusion compares the trimmed uppercase raw value, not a normalized replacement', () => {
  const h = harness(' c-5 '); h.owner.activate(); assert.equal(h.owner.getSnapshot().selectedLetter, 'C');
  assert.equal(h.owner.getSnapshot().grid[4].excluded, false); assert.equal(h.owner.gridChoice('C5'), 'C5'); h.owner.suspend();
});

test('letter choice accepts only source letters and stale grid labels cannot be selected', () => {
  const h = harness(); h.owner.activate(); h.owner.selectLetter('Z'); assert.equal(h.owner.getSnapshot().selectedLetter, 'Z');
  assert.equal(h.owner.gridChoice('A1'), null); assert.equal(h.owner.gridChoice('Z13'), 'Z13'); h.owner.selectLetter('z');
  assert.equal(h.owner.getSnapshot().selectedLetter, 'Z'); h.owner.suspend();
});

test('search keeps raw input, limits to 24 after exclusion, and separates a normalized primary result', () => {
  const h = harness('A1'); h.owner.activate(); h.owner.setQuery(' 1 '); let snapshot = h.owner.getSnapshot();
  assert.equal(snapshot.query, ' 1 '); assert.equal(snapshot.searching, true); assert.equal(snapshot.results.length, 24);
  assert.equal(snapshot.results.includes('A1'), false); assert.equal(snapshot.primary, null); assert.deepEqual(snapshot.results, snapshot.otherResults);
  h.owner.setQuery('B-01'); snapshot = h.owner.getSnapshot(); assert.equal(snapshot.primary, 'B1'); assert.deepEqual(snapshot.otherResults, []);
  assert.equal(h.owner.resultChoice('B1'), 'B1'); assert.equal(h.owner.gridChoice('A2'), null); assert.equal(h.owner.submit(), 'B1');
  h.owner.setQuery('A1'); assert.equal(h.owner.submit(), null); assert.equal(h.owner.resultChoice('A1'), null); h.owner.suspend();
});

test('blank and nonmatching searches preserve source display modes without invented choices', () => {
  const h = harness(); h.owner.activate(); h.owner.setQuery(' \u0085 '); assert.equal(h.owner.getSnapshot().searching, false);
  h.owner.setQuery('not a cell'); assert.equal(h.owner.getSnapshot().searching, true); assert.deepEqual(h.owner.getSnapshot().results, []);
  assert.equal(h.owner.submit(), null); assert.equal(h.owner.resultChoice('A1'), null); h.owner.suspend();
});

test('boundary invalidation clears labels/query and permanently blocks old selection, including after ABA', () => {
  const h = harness(), seen = []; h.owner.subscribe(() => seen.push(h.owner.getSnapshot().invalid)); h.owner.activate(); h.owner.setQuery('C3');
  h.invalidate(); assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.owner.getSnapshot().query, ''); assert.deepEqual(h.owner.getSnapshot().grid, []);
  assert.equal(h.owner.submit(), null); h.revive(); h.owner.setQuery('D4'); assert.equal(h.owner.resultChoice('C3'), null);
  assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(seen.at(-1), true); assert.equal(h.listeners.size, 0); h.owner.suspend();
});
test('failing picker observers do not suppress later query and invalidation notifications', async () => {
  const h = harness(), seen = []; h.owner.subscribe(() => { throw new Error('observer'); });
  h.owner.subscribe(async () => { throw new Error('async observer'); }); h.owner.subscribe(() => seen.push(h.owner.getSnapshot().invalid));
  h.owner.activate(); h.owner.setQuery('A1'); h.invalidate(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, [false, true]); assert.equal(h.owner.getSnapshot().invalid, true); h.owner.suspend();
});

test('picker hook returns only a current source choice to its mandatory callback', () => {
  const effects = [], calls = [], h = harness(), filename = path.join(root, 'qolip/useQolipGridCellPicker.ts'), loaded = new Module(filename, module);
  const mocks = { react: { useMemo: fn => fn(), useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: fn => effects.push(fn) },
    './qolipGridCellPickerState': { QolipGridCellPickerState: class { constructor() { return h.owner; } } } };
  loaded.require = target => target in mocks ? mocks[target] : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const hook = loaded.exports.useQolipGridCellPicker({ boundary: h.boundary, select: label => calls.push(label) }), stop = effects[0]();
  hook.chooseGrid('A1'); h.owner.setQuery('B2'); hook.submit(); h.invalidate(); hook.chooseResult('B2');
  assert.deepEqual(calls, ['A1', 'B2']); stop();
});
