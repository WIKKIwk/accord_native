const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminProgressQrReportSupport.cjs');

function fixture() {
  const session = { token: 'original', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'original' } }, witness = { session }, calls = [];
  let epoch = 1, account = session, scope = 'original', issued = true, allowed = true, owner = () => true, pending = async () => ({ report: true });
  const module = s.load('admin/adminProgressQrReportSession', {
    '../auth': { activeSessionEpoch: value => value === account ? epoch : null, activeSessionToken: value => value === account ? value.token : null,
      isSessionWitnessCurrent: value => issued && value === witness },
    '../sessionReadScope': { sessionReadScope: () => scope },
    '../shared/appRoutes': { appRoutes: { adminProgressQrScan: '/admin-progress-qr-scan' }, canOpenRoute: (value, route) => { assert.equal(value, session); assert.equal(route, '/admin-progress-qr-scan'); return allowed; } },
    '../shared/camera/synchronousGuard': s.load('shared/camera/synchronousGuard'),
    './adminProgressQrReportApi': { adminProgressQrReport: async (...args) => {
      calls.push(args); args[2](); assert.equal(args[3](), true); const result = await pending(); args[2](); return result;
    } },
  });
  const reader = module.createAdminProgressQrReportSession(session, witness, () => owner());
  return { reader, session, witness, calls, epoch: value => { epoch = value; }, account: value => { account = value; }, scope: value => { scope = value; },
    issued: value => { issued = value; }, allowed: value => { allowed = value; }, owner: value => { owner = value; }, pending: value => { pending = value; } };
}
test('report reader starts no camera/request, then forwards the exact original session and raw value to the genuine API seam', async () => {
  const f = fixture(); assert.equal(f.calls.length, 0); assert.equal(f.reader.current(), true);
  assert.deepEqual(await f.reader.read(' \u0085QR value\u0085 '), { report: true });
  assert.equal(f.calls[0][0], f.session); assert.equal(f.calls[0][1], ' \u0085QR value\u0085 ');
  assert.equal(f.calls[0][3], f.reader.current); assert.equal(f.calls.length, 1);
});
test('same-owner token refresh preserves original reads while epoch/scope/witness/capability/account loss permanently retires', async () => {
  const f = fixture(); f.session.token = 'refreshed'; assert.equal(f.reader.current(), true); await f.reader.read('QR');
  for (const change of [g => g.epoch(2), g => g.scope('other'), g => g.issued(false), g => g.allowed(false), g => g.account({ ...g.session }),
    g => { g.session.token = 'test-mode-token'; }, g => { g.session.token = ''; }]) {
    const g = fixture(); assert.equal(g.reader.current(), true); change(g); assert.equal(g.reader.current(), false);
    g.epoch(1); g.scope('original'); g.issued(true); g.allowed(true); g.account(g.session); g.session.token = 'original';
    assert.equal(g.reader.current(), false); assert.throws(() => g.reader.read('QR'), /owner changed/); assert.equal(g.calls.length, 0);
  }
});
test('original page disposal suppresses pending report settlement and never transfers its guard to a replacement reader', async () => {
  const f = fixture(), pending = s.deferred(); f.pending(() => pending.promise); const read = f.reader.read('QR');
  f.reader.dispose(); const next = fixture(); assert.deepEqual(await next.reader.read('fresh'), { report: true });
  pending.resolve({ originalPrivateReport: true }); await assert.rejects(read, /owner changed/);
  assert.equal(f.reader.current(), false); assert.equal(next.reader.current(), true);
});
test('async, reentrant and self-retiring original lifetime checks fail closed before dispatch', async () => {
  for (const change of [f => f.owner(() => Promise.reject(Error('async owner'))), f => f.owner(() => f.reader.current()),
    f => f.owner(() => { f.reader.dispose(); return true; }), f => f.owner(() => { f.scope('other'); return true; })]) {
    const f = fixture(); change(f); assert.equal(f.reader.current(), false); assert.throws(() => f.reader.read('QR'), /owner changed/); assert.equal(f.calls.length, 0);
  }
  await s.flush();
});
