const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(name, mocks = {}, cache = new Map()) {
  if (cache.has(name)) return cache.get(name);
  const file = path.resolve(__dirname, '../src', `${name}.ts`), mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.posix.join(path.posix.dirname(name), id), mocks, cache) : require(id);
  cache.set(name, mod.exports); mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file); return mod.exports;
}
const { WorkerPaddonDetail } = load('workerPaddonDetail'), { WorkerPaddonList } = load('workerPaddonList'), { WorkerPaddonTransfer } = load('workerPaddonTransfer'), { WorkerPaddonPrint } = load('workerPaddonPrint');
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const batch = (id, extra = {}) => ({ batch_id: id, qr_payload: id, wip_status: 'waiting', payload_json: {}, bobina_kg: 1, ...extra });
const snapshot = (items = [], extra = {}) => ({ paddon: { code: 'P1', apparatus_id: 'cut', locked_at_unix: null, created_by_ref: 'worker' },
  items, available_items: [batch('a'), batch('b'), batch('r', { wip_status: 'peremotka' })], can_manage_items: true, can_unlock: false, free_movement_enabled: false, ...extra });
function detail() {
  const h = { valid: true, saved: snapshot(), writes: [], reads: 0, changed: 0 };
  h.deps = { code: 'P1', current: () => h.valid, read: async current => { assert(current()); h.reads++; return h.saved; },
    add: async (ids, current) => { assert(current()); h.writes.push(['add', ids]); return snapshot(ids.map(id => batch(id))); },
    remove: async (ids, single, current) => { assert(current()); h.writes.push(['remove', ids, single]); return snapshot(); },
    lookup: async (qr, current) => { assert(current()); return batch(qr); }, unlock: async current => { assert(current()); return snapshot(); }, changed: () => h.changed++ };
  h.controller = new WorkerPaddonDetail(h.deps); return h;
}
// @v2-test test/paddon_transfer_test.dart
test('paddon editing preserves add/remove sets, bobina reset and peremotka conflict', async () => {
  const h = detail(), c = h.controller; await c.load(); c.edit('add'); c.toggle('a'); c.toggle('r');
  assert.deepEqual(c.getSnapshot().selected, ['a']); assert.equal(c.getSnapshot().error.code, 'paddon_roll_kind_conflict');
  c.filter(1_000_000); assert.deepEqual(c.getSnapshot().selected, []); c.toggle('a');
  assert(await c.add(['a'])); assert.equal(h.changed, 1); assert.equal(c.getSnapshot().mode, null);
  c.edit('remove'); c.toggle('a'); assert(await c.remove(['a'], true)); assert.deepEqual(h.writes[1], ['remove', ['a'], true]);
});
test('uncertain membership changes reconcile once and never resend the command', async () => {
  for (const applied of [true, false]) {
    const h = detail(), c = h.controller; await c.load();
    h.deps.add = async ids => { h.writes.push(ids); h.saved = snapshot(applied ? ids.map(id => batch(id)) : []); throw Error('timeout'); };
    assert.equal(await c.add(['a']), applied); assert.equal(h.reads, 2); assert.equal(h.writes.length, 1); assert.equal(h.changed, applied ? 1 : 0);
    assert.equal(c.getSnapshot().busy, false);
  }
});
test('printing excludes membership edits and camera staging until its owner releases the interlock', async () => {
  const h = detail(), c = h.controller; await c.load(); c.edit('add'); c.toggle('a'); c.setPrinting(true);
  c.toggle('b'); c.filter(1_000_000); c.startScan();
  assert.deepEqual(c.getSnapshot().selected, ['a']); assert.equal(c.getSnapshot().scanning, false);
  assert.equal(await c.add(['a']), false); assert.equal(h.writes.length, 0);
  c.setPrinting(false); assert(await c.add(['a']));
});
test('retirement publishes a new snapshot identity without permitting further operations', async () => {
  const h = detail(), c = h.controller; await c.load(); const before = c.getSnapshot(); let notifications = 0;
  c.subscribe(() => notifications++); c.invalidate(); assert.notEqual(c.getSnapshot(), before); assert.equal(notifications, 1);
  assert.equal(c.current(), false); assert.equal(await c.add(['a']), false); assert.equal(h.writes.length, 0);
});
test('old confirmations and account loss during a command cannot refresh or publish another account', async () => {
  const h = detail(), c = h.controller; await c.load(); const old = c.capture(); await c.load();
  assert.equal(await c.add(['a'], old), false); assert.equal(h.writes.length, 0);
  const pending = defer(); h.deps.add = () => pending.promise; const result = c.add(['a']); h.valid = false;
  pending.resolve(snapshot([batch('a')])); assert.equal(await result, false); assert.equal(h.changed, 0); assert.equal(h.reads, 2);
});
test('QR scanning serializes distinct detections, deduplicates pending and staged aliases, and rejects received WIP', async () => {
  const h = detail(), c = h.controller; await c.load(); c.startScan(); const first = defer(), calls = [];
  h.deps.lookup = async qr => { calls.push(qr); if (qr === 'A') return first.promise; return batch(qr === 'alias' ? 'A' : qr,
    qr === 'received' ? { payload_json: { received_warehouse: 'warehouse' } } : {}); };
  const a = c.stage('https://example.test/qr?qr=A'), duplicate = c.stage('a'), b = c.stage('B');
  await Promise.resolve(); assert.deepEqual(calls, ['A']); first.resolve(batch('A')); await Promise.all([a, duplicate, b]);
  assert.deepEqual(c.getSnapshot().scanned.map(row => row.batch_id), ['A', 'B']); assert.equal(c.getSnapshot().pending, 0);
  await c.stage('alias'); assert.equal(c.getSnapshot().feedback, 'worker.paddon.scan.duplicate');
  await c.stage('received'); assert.equal(c.getSnapshot().scanned.length, 2); assert.equal(c.getSnapshot().error.code, 'progress_batch_not_accepted');
  c.setReview(true); c.unstage('A'); c.setReview(false); assert(await c.confirmScan()); assert.equal(c.getSnapshot().scanning, false);
});
test('discarded QR queue cannot write staged results into a restarted scan', async () => {
  const h = detail(), c = h.controller; await c.load(); c.startScan(); const pending = defer(); h.deps.lookup = () => pending.promise;
  const operation = c.stage('A'); await Promise.resolve(); c.cancelScan(); c.startScan(); pending.resolve(batch('A')); await operation;
  assert.equal(c.getSnapshot().pending, 0); assert.deepEqual(c.getSnapshot().scanned, []);
});
test('QR input limit includes outstanding lookups and pending reviews block new detections', async () => {
  const h = detail(), c = h.controller; await c.load(); c.startScan(); const pending = defer(); h.deps.lookup = () => pending.promise;
  const jobs = Array.from({ length: 500 }, (_, id) => c.stage(String(id))); await c.stage('overflow');
  assert.equal(c.getSnapshot().pending, 500); assert.equal(c.getSnapshot().feedback, 'worker.paddon.scan.limit');
  c.cancelScan(); pending.resolve(batch('0')); await Promise.all(jobs); c.startScan(); c.setReview(true); await c.stage('ignored'); assert.equal(c.getSnapshot().pending, 0);
});
const session = { profile: { role: 'aparatchi', ref: 'worker' }, assigned_apparatus: ['cut', 'cut2', 'print'], capabilities: ['apparatus.queue.manage'] };
const catalog = ['cut', 'cut2', 'print'].map((id, index) => ({ id, name: id, operation: id === 'print' ? 'print' : 'cut', lifecycle_state: 'active', sort_order: index }));
test('paddon list resolves only assigned active cut machines and keeps every list read scoped', async () => {
  const calls = [], c = new WorkerPaddonList({ session, current: () => true, catalog: async () => catalog,
    list: async id => { calls.push(id); return [{ code: 'P1', apparatus_id: id }, { code: 'other', apparatus_id: 'outside' }]; }, create() {}, remove() {} });
  await c.load(); assert.equal(c.getSnapshot().apparatus, ''); assert.deepEqual(calls, []); await c.select('print'); assert.deepEqual(calls, []);
  await c.select('cut2'); assert.deepEqual(calls, ['cut2']); assert.deepEqual(c.getSnapshot().rows.map(row => row.code), ['P1']);
});
test('paddon list retains its last results while refreshing, but clears them when changing apparatus', async () => {
  let pending, rows = [{ code: 'P1', apparatus_id: 'cut' }];
  const c = new WorkerPaddonList({ session, apparatus: 'cut', current: () => true,
    catalog: async () => pending ? pending.promise : catalog,
    list: async id => rows.filter(row => row.apparatus_id === id), create() {}, remove() {} });
  await c.load();
  pending = defer(); rows = [{ code: 'P2', apparatus_id: 'cut' }];
  const refresh = c.load();
  assert.equal(c.getSnapshot().phase, 'ready'); assert.deepEqual(c.getSnapshot().rows.map(row => row.code), ['P1']);
  pending.resolve(catalog); await refresh;
  assert.equal(c.getSnapshot().phase, 'ready'); assert.deepEqual(c.getSnapshot().rows.map(row => row.code), ['P2']);
  pending = defer(); const change = c.select('cut2');
  assert.equal(c.getSnapshot().phase, 'loading'); assert.deepEqual(c.getSnapshot().rows, []);
  pending.resolve(catalog); await change;
  assert.equal(c.getSnapshot().apparatus, 'cut2'); assert.deepEqual(c.getSnapshot().rows, []);
});
test('paddon detail retains its snapshot during refresh while resetting the V2 selections', async () => {
  const h = detail(), c = h.controller; await c.load(); c.edit('add'); c.toggle('a'); c.filter(1_000_000);
  const old = c.getSnapshot().snapshot, pending = defer(); h.deps.read = () => pending.promise;
  const refresh = c.load();
  assert.equal(c.getSnapshot().phase, 'ready'); assert.equal(c.getSnapshot().snapshot, old);
  assert.equal(c.getSnapshot().bobina, null); assert.deepEqual(c.getSnapshot().selected, []);
  pending.resolve(snapshot([batch('new')])); await refresh;
  assert.deepEqual(c.getSnapshot().snapshot.items.map(row => row.batch_id), ['new']);
});
test('a detail refresh started before a confirmed edit cannot overwrite the edit', async () => {
  const h = detail(), c = h.controller; await c.load();
  const pending = defer(); h.deps.read = () => pending.promise;
  const refresh = c.load(); c.edit('add'); c.toggle('a');
  assert(await c.add(['a']));
  pending.resolve(snapshot()); await refresh;
  assert.deepEqual(c.getSnapshot().snapshot.items.map(row => row.batch_id), ['a']);
});
test('transfer reads each assigned cut list, restricts editing and resets both sides after an uncertain write', async () => {
  const lists = [], writes = [], reads = [], h = { fail: false };
  const c = new WorkerPaddonTransfer({ session, apparatus: 'cut2', current: () => true, catalog: async () => catalog,
    list: async id => { lists.push(id); return [{ code: id, apparatus_id: id, locked_at_unix: null }]; },
    read: async code => { reads.push(code); return snapshot([batch(code + '-roll')], { paddon: { code, apparatus_id: code, created_by_ref: 'worker', locked_at_unix: null } }); },
    move: async (...args) => { writes.push(args.slice(0, 3)); if (h.fail) throw Error('timeout'); }, changed() {} });
  await c.load(); assert.deepEqual(lists, ['cut', 'cut2']); assert.equal(c.getSnapshot().source.paddon.code, 'cut2');
  c.toggle('cut2', 'cut2-roll'); const permit = c.capture(); h.fail = true;
  assert.equal(await c.move('cut2', 'cut', ['cut2-roll'], permit), false); assert.deepEqual(c.getSnapshot().selected, []);
  assert.equal(writes.length, 1); assert.deepEqual(reads, ['cut2', 'cut', 'cut2', 'cut']); assert.equal(c.getSnapshot().busy, false);
  assert.equal(await c.move('cut2', 'cut', ['cut2-roll'], permit), false); assert.equal(writes.length, 1);
  const other = snapshot([], { paddon: { created_by_ref: 'other', locked_at_unix: null } }); assert.equal(c.editable(other), false);
  other.free_movement_enabled = true; assert.equal(c.editable(other), true); other.can_manage_items = false; assert.equal(c.editable(other), false);
});
test('local printing precedes confirmation; only a newly locked receipt may create a successor', async () => {
  for (const failure of ['print', 'confirm', 'next', 'none']) {
    const calls = [], notices = [], p = { code: 'P1', locked_at_unix: null };
    const workflow = new WorkerPaddonPrint({ code: 'P1', apparatus: 'cut', current: () => true, select: async () => ({ bluetooth: true }),
      prepare: async () => ({ ok: true, paddon: p, qr_payload: 'P1', can_close_after_print: true, print_job: { epc: 'P1', label_kind: 'paddon_code' } }),
      print: async () => { calls.push('print'); if (failure === 'print') throw Error('no paper'); },
      confirm: async () => { calls.push('confirm'); if (failure === 'confirm') throw Error('timeout'); return { newly_locked: true, paddon: p }; },
      refresh: async () => { calls.push('refresh'); }, changed() {}, chooseNext: async () => { calls.push('ask'); return 'cut'; },
      successor: async () => { calls.push('next'); if (failure === 'next') throw Error('timeout'); return { code: 'P2' }; }, notice: key => notices.push(key) });
    await workflow.run();
    assert.deepEqual(calls, failure === 'print' ? ['print'] : failure === 'confirm' ? ['print', 'confirm'] : ['print', 'confirm', 'refresh', 'ask', 'next']);
    assert.deepEqual(notices, [failure === 'print' ? 'worker.paddon.print_failed' : failure === 'confirm' ? 'worker.paddon.print_confirm_failed' : failure === 'next' ? 'worker.paddon.create_failed' : 'worker.paddon.next.created']);
  }
});
