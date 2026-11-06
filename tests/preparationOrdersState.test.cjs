const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
class ApiError extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
const filename = path.resolve(__dirname, '../src/preparation/preparationOrdersState.ts'), mod = new Module(filename, module);
mod.require = id => id === '../workerControlsApi' ? { WorkerControlException: ApiError } : id === './preparationOrdersApi' ? {
  preparationOrderListWindowFromJson: event => event,
  preparationOrdersDelta: (before, event) => { if (event.base_version !== before.version) throw Error('stale'); return { ...event, rows: event.new_rows }; },
} : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
const window = (rows, cursor = null) => ({ scope: 's', epoch: 'e', rev: 7, version: 'v1', apparatus_id: 'machine', apparatus: [],
  rows: rows.map(id => ({ id })), next_cursor: cursor, total: 10, search: '' });
function setup(read) {
  const calls = [], store = { peek: () => null, restore: async () => null, remember: value => calls.push(['remember', value]),
    forget: async () => calls.push(['forget']), read };
  let emit, current = true, connections = 0;
  const state = new mod.exports.PreparationOrdersState(store, () => current, (win, search, length, event) => {
    connections++; emit = event; return () => {}; }, async () => null);
  return { state, calls, emit: event => emit(event), connections: () => connections, changeAccount: () => { current = false; state.sessionChanged(); } };
}
test('pagination appends visible rows and a refresh retains the full prefix', async () => {
  const requests = [];
  const x = setup(async options => { requests.push(options); return options.cursor ? window(['b']) : window(['a'], 'page2'); });
  await x.state.reload(); await x.state.loadMore(); assert.deepEqual(x.state.getSnapshot().rows.map(row => row.id), ['a', 'b']);
  await x.state.reload(); assert.deepEqual(x.state.getSnapshot().rows.map(row => row.id), ['a', 'b']);
  assert.deepEqual(requests.map(r => r.cursor), [null, 'page2', null, 'page2']); x.state.dispose();
});
test('live checkpoint keeps rows and a valid delta reorders them without reading again', async () => {
  let reads = 0; const x = setup(async () => { reads++; return window(['a', 'b']); });
  await x.state.reload();
  x.emit({ type: 'checkpoint', epoch: 'e', scope: 's', version: 'v1', rev: 8 });
  assert.equal(x.state.getSnapshot().window.rev, 8);
  x.emit({ ...window(['c', 'a']), type: 'list_delta', base_version: 'v1', version: 'v2', rev: 9, new_rows: [{ id: 'c' }, { id: 'a' }] });
  assert.deepEqual(x.state.getSnapshot().rows.map(row => row.id), ['c', 'a']); assert.equal(reads, 1); x.state.dispose();
});
test('authorization error withdraws rows and account changes reject late responses', async () => {
  let release, count = 0; const wait = new Promise(resolve => { release = resolve; });
  const x = setup(async () => { count++; if (count === 1) return window(['a']); await wait; return window(['old']); });
  await x.state.reload(); const pending = x.state.reload(); x.changeAccount(); release(); await pending;
  assert.deepEqual(x.state.getSnapshot().rows, []); assert.match(x.state.getSnapshot().error, /Akkaunt/); x.state.dispose();
  const y = setup(async () => { throw new ApiError('forbidden', 'Ruxsat yo‘q', 403); });
  await y.state.reload(); assert.equal(y.state.getSnapshot().error, 'Ruxsat yo‘q'); assert.ok(y.calls.some(call => call[0] === 'forget')); y.state.dispose();
});
test('session reset immediately clears the sequence before session replacement', async () => {
  const x = setup(async () => window(['a']));
  await x.state.reload(); x.state.sessionChanged(true);
  assert.deepEqual(x.state.getSnapshot().rows, []);
  await x.state.reload(); assert.deepEqual(x.state.getSnapshot().rows, []); x.state.dispose();
});
