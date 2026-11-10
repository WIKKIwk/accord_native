const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { WorkerActivePaddon, workerPaddonApparatus } = compile('workerActivePaddon.ts');
const tick = () => new Promise(setImmediate), deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const apparatus = 'apparatus:default:cut';
const row = (code, changes = {}) => ({ code, apparatus_id: apparatus, locked_at_unix: null, contains_peremotka: false, item_count: 2, ...changes });
function setup() {
  const h = { valid: true, code: null, rows: [row('00001'), row('00002')], events: [], failures: 0 };
  h.controller = new WorkerActivePaddon({ apparatus, current: () => h.valid,
    read: async valid => { assert(valid()); h.events.push('GET'); const result = h.read ? await h.read(valid) : h.code; if (!valid()) throw Error('stale'); return result; },
    list: async valid => { assert(valid()); h.events.push('LIST'); return h.list ? h.list(valid) : structuredClone(h.rows); },
    save: async (code, valid) => { assert(valid()); h.events.push(['PUT', code]); if (h.save) return h.save(code, valid); h.code = code; return code; },
    failed: () => h.failures++ });
  h.controller.setVisible(true); return h;
}

// @v2-test test/active_rezka_paddon_test.dart
test('server choice is restored, changed and cleared, and verified after each save', async () => {
  const h = setup(); await tick(); assert.equal(h.controller.getSnapshot().code, null);
  await h.controller.open(); await h.controller.choose('00001'); assert.equal(h.controller.getSnapshot().code, '00001');
  await h.controller.open(); await h.controller.choose('00002'); assert.equal(h.controller.getSnapshot().code, '00002');
  await h.controller.open(); await h.controller.choose(null); assert.equal(h.controller.getSnapshot().code, null);
  assert.deepEqual(h.events, ['GET', 'GET', 'LIST', ['PUT', '00001'], 'GET', 'GET', 'LIST', ['PUT', '00002'], 'GET', 'GET', 'LIST', ['PUT', null], 'GET']);
});
test('a competing device wins the verification GET rather than the acknowledged PUT value', async () => {
  const h = setup(); await h.controller.open(); h.save = async () => { h.code = '00002'; return '00001'; };
  await h.controller.choose('00001'); assert.equal(h.controller.getSnapshot().code, '00002');
});
test('failed read is unknown, never the no-pallet choice, and cannot authorize a write', async () => {
  const h = setup(); await tick(); h.read = async () => { throw Error('offline'); };
  await h.controller.open(); assert.equal(h.controller.getSnapshot().selection, 'error');
  await h.controller.choose(null); assert(!h.events.some(Array.isArray)); h.controller.close();
  h.read = async () => '00001'; await h.controller.open(); assert.equal(h.controller.getSnapshot().code, '00001');
});
test('failed list hides choices; rejected save retains server selection and emits only the V2 notice', async () => {
  const h = setup(); await tick(); h.list = async () => { throw Error('offline'); };
  await h.controller.open(); assert.equal(h.controller.getSnapshot().picker, 'error'); await h.controller.choose('00001');
  assert(!h.events.some(Array.isArray)); h.controller.close(); h.list = null; await h.controller.open();
  h.save = async () => { throw Error('locked'); }; await h.controller.choose('00001');
  assert.equal(h.failures, 1); assert.equal(h.controller.getSnapshot().code, null); assert.equal(h.controller.getSnapshot().busy, false);
});
test('successful save followed by a failed verification GET shows unknown without claiming a rejected save', async () => {
  const h = setup(); await h.controller.open(); h.save = async code => { h.code = code; h.read = async () => { throw Error('offline'); }; return code; };
  await h.controller.choose('00001'); assert.equal(h.code, '00001'); assert.equal(h.failures, 0); assert.equal(h.controller.getSnapshot().selection, 'error');
});
// @v2-test test/worker_paddon_apparatus_tabs_test.dart
test('only the selected assigned cut machine has a Paddon toolbar action', () => {
  const machines = [{ id: apparatus, operation: 'cut' }, { id: 'laminate', operation: 'laminate' }, { id: 'foreign', operation: 'cut' }];
  assert.equal(workerPaddonApparatus(machines, apparatus, [` ${apparatus} `]), machines[0]);
  for (const id of ['completed', 'laminate', 'foreign', 'missing']) assert.equal(workerPaddonApparatus(machines, id, [apparatus, 'laminate']), null);
});
test('picker excludes other machines, locked pallets and peremotka, preserving server order', async () => {
  const h = setup(); h.rows = [row('00002'), row('locked', { locked_at_unix: 0 }), row('held', { contains_peremotka: true }), row('foreign', { apparatus_id: 'other' }), row('00001')];
  await h.controller.open(); assert.deepEqual(h.controller.getSnapshot().paddons.map(row => row.code), ['00002', '00001']);
  for (const code of ['foreign', 'locked', 'held', 'invented']) await h.controller.choose(code);
  assert(!h.events.some(Array.isArray));
});
test('covered and background screens defer production notifications until visible and resumed', async () => {
  const h = setup(); await tick(); h.controller.setVisible(false); h.controller.notify(); await tick(); assert.deepEqual(h.events, ['GET']);
  h.controller.setForeground(false); h.controller.setVisible(true); await tick(); assert.deepEqual(h.events, ['GET']);
  h.code = '00002'; h.controller.setForeground(true); await tick(); assert.deepEqual(h.events, ['GET', 'GET']); assert.equal(h.controller.getSnapshot().code, '00002');
});
test('an owned open picker stays live, refreshes its rows and removes choices on read failure', async () => {
  const h = setup(); await h.controller.open(); h.code = '00002'; h.rows = [row('00002')]; h.controller.notify(); await tick();
  assert.equal(h.controller.getSnapshot().code, '00002'); assert.deepEqual(h.controller.getSnapshot().paddons.map(row => row.code), ['00002']);
  h.read = async () => { throw Error('offline'); }; h.controller.notify(); await tick(); assert.equal(h.controller.getSnapshot().selection, 'error');
  await h.controller.choose(null); assert(!h.events.some(Array.isArray));
});
test('double open and choose cannot duplicate list requests or writes', async () => {
  const h = setup(); await tick(); const read = deferred(); h.read = () => read.promise;
  const first = h.controller.open(), second = h.controller.open(); read.resolve(null); await Promise.all([first, second]);
  assert.equal(h.events.filter(value => value === 'LIST').length, 1); h.read = null;
  const write = deferred(); h.save = code => { h.code = code; return write.promise; };
  const chosen = h.controller.choose('00001'); await tick(); const duplicate = h.controller.choose('00002'); write.resolve('00001'); await Promise.all([chosen, duplicate]);
  assert.deepEqual(h.events.filter(Array.isArray), [['PUT', '00001']]);
});
test('notifications coalesce during a read and never replace the newer serialized selection', async () => {
  const h = setup(); await tick(); const delayed = deferred(); let first = true;
  h.read = async () => { if (first) { first = false; return delayed.promise; } return '00002'; };
  h.controller.notify(); h.controller.notify(); h.controller.notify(); delayed.resolve('00001'); await tick();
  assert.equal(h.controller.getSnapshot().code, '00002'); assert.equal(h.events.filter(value => value === 'GET').length, 3);
});
for (const label of ['account', 'capability', 'assignment', 'apparatus']) test(`${label} invalidation blocks a queued old choice and late reads`, async () => {
  const h = setup(); await h.controller.open(); const delayed = deferred(); h.read = () => delayed.promise;
  h.controller.notify(); h.valid = false; h.controller.invalidate(); await h.controller.choose('00001'); delayed.resolve('00002'); await tick();
  assert.equal(h.controller.getSnapshot().selection, 'loading'); assert.equal(h.controller.getSnapshot().code, null); assert(!h.events.some(Array.isArray));
});
test('save waits for the outstanding picker refresh and rechecks the scope before PUT', async () => {
  const h = setup(); await h.controller.open(); const delayed = deferred(); h.read = () => delayed.promise;
  h.controller.notify(); const selected = h.controller.choose('00001'); await tick(); assert(!h.events.some(Array.isArray));
  h.valid = false; delayed.resolve(null); await selected; assert(!h.events.some(Array.isArray)); assert.equal(h.failures, 0);
});
test('a late old-machine list cannot repopulate a closed or retired picker', async () => {
  const h = setup(); await tick(); const delayed = deferred(); h.list = () => delayed.promise;
  const open = h.controller.open(); await tick(); h.controller.close(); delayed.resolve([row('late')]); await open;
  assert.equal(h.controller.getSnapshot().picker, 'closed'); assert.deepEqual(h.controller.getSnapshot().paddons, []);
});
