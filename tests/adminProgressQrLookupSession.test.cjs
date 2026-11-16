const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrLookupSupport.cjs'), users = require('./adminUsersSupport.cjs');
function fixture({ scanOnly = false, role = 'admin' } = {}) {
  const session = { token: 'old', baseUrl: 'https://erp.example', profile: { role, ref: 'original' }, capabilities: ['production.read'], assigned_apparatus: [], imageCacheScope: 'image' }, witness = { session }, calls = [];
  let account = session, epoch = 1, issued = true, allowed = true, parent = () => true, focused = true, catalog = async () => [], pending = async kind => kind === 'primary' ? s.report('actual') : kind === 'paddon' ? s.paddon('12345') : kind === 'opening' ? s.opening('opening') : s.material('raw');
  const invoke = async (kind, ...args) => { calls.push([kind, ...args]); args[2](); assert.equal(args[3](), true); const result = await pending(kind, ...args); args[2](); return result; };
  const module = s.load('admin/adminProgressQrLookupSession', {
    '../apparatusApi': { adminApparatus: async (...args) => { calls.push(['apparatus', ...args]); args[1].beforeSend(); assert.equal(args[1].readWitness(), true); const result = await catalog(); args[1].beforeSend(); return result; } },
    '../auth': { activeSessionEpoch: value => value === account ? epoch : null, activeSessionToken: value => value === account ? value.token : null, isSessionWitnessCurrent: value => issued && value === witness },
    '../sessionReadScope': s.load('sessionReadScope'), '../shared/appRoutes': { appRoutes: { adminProgressQrScan: '/qr' }, canOpenRoute: (value, route) => { assert.equal(value, session); assert.equal(route, '/qr'); return allowed; } },
    '../shared/profileSessionGuard': s.load('shared/profileSessionGuard'), './adminProgressQrLookupController': s.controllerModule, './adminUsersModel': users.model,
    './adminProgressQrReportApi': { adminProgressQrReport: (...args) => invoke('primary', ...args) }, './adminProgressQrFallbackApi': { adminProgressQrPaddonReport: (...args) => invoke('paddon', ...args), adminProgressQrOpeningWipReport: (...args) => invoke('opening', ...args) },
    './adminProgressQrMaterialApi': { adminProgressQrMaterialLookup: (...args) => invoke('material', ...args) },
  });
  const owner = module.createAdminProgressQrLookupSession({ session, witness, isCurrent: () => parent(), scanOnly, canInteract: () => focused, scanner: null,
    returnScan: (...args) => { calls.push(['return', ...args]); args[1](); }, replaceWorkerQueue: (...args) => { calls.push(['queue', ...args]); args[1](); } });
  return { owner, session, witness, calls, epoch: value => { epoch = value; }, account: value => { account = value; }, issued: value => { issued = value; }, allowed: value => { allowed = value; }, parent: value => { parent = value; }, focus: value => { focused = value; }, pending: value => { pending = value; }, catalog: value => { catalog = value; }, module };
}
test('session wires actual Source API branches to original session, checked guards/witnesses, and catalog limit10000 without constructor side effects', async () => {
  const f = fixture(); assert.deepEqual(f.calls, []); f.pending(async kind => { if (kind !== 'material') throw s.apiError(); return s.material('raw'); }); f.owner.controller.start(); await s.flush();
  assert.equal(f.calls[0][0], 'apparatus'); assert.equal(f.calls[0][1], f.session); assert.equal(f.calls[0][2].limit, 10000);
  await f.owner.controller.detectNormalized('12345'); assert.deepEqual(f.calls.map(([kind]) => kind), ['apparatus', 'primary', 'paddon', 'opening', 'material']);
  for (const [, session, payload, guard, witness] of f.calls.slice(1)) { assert.equal(session, f.session); assert.equal(payload, '12345'); assert.equal(typeof guard, 'function'); assert.equal(typeof witness, 'function'); assert.throws(guard, /settled/); }
  assert.equal(f.owner.controller.getSnapshot().rawMaterialReport.barcode, 'raw');
});
test('original Source enum parsing normalizes aparatchi only while rezka_master/operator capability and omborchi never become aparatchi', async () => {
  for (const [role, queue] of [[' \u0085 APARATCHI \u0085 ', true], ['rezka_master', false], ['omborchi', false], ['qolipchi', false]]) { const f = fixture({ role }); f.owner.controller.start(); await s.flush(); await f.owner.controller.detectNormalized('QR'); assert.equal(f.calls.some(([kind]) => kind === 'queue'), queue); }
  assert.throws(() => fixture({ role: 'worker' }), /Unsupported user role/);
});
test('same-account token refresh and expected page blur retain read authority; focus only gates new interaction', async () => {
  const f = fixture(), pending = s.deferred(); f.pending(() => pending.promise); f.owner.controller.start(); await s.flush(); const reading = f.owner.controller.detectNormalized('QR'); await s.flush(); f.session.token = 'refreshed'; f.focus(false); assert.equal(f.owner.current(), true); pending.resolve(s.report('private')); await reading;
  assert.equal(f.owner.controller.getSnapshot().report.scanned_batch.batch_id, 'private'); assert.equal(f.owner.controller.canInteract(), false); assert.equal(f.owner.current(), true);
});
test('original epoch/scope/witness/capability/account/parent loss permanently retires API and callback authority without adopting restoration', async () => {
  const changes = [f => f.epoch(2), f => f.issued(false), f => f.allowed(false), f => f.account({ ...f.session }), f => f.parent(() => false), f => { f.session.capabilities.push('new.scope'); }, f => { f.session.token = 'test-mode-token'; }];
  for (const change of changes) { const f = fixture(); f.owner.controller.start(); await s.flush(); change(f); assert.equal(f.owner.current(), false); f.epoch(1); f.issued(true); f.allowed(true); f.account(f.session); f.parent(() => true); f.session.capabilities = ['production.read']; f.session.token = 'old'; assert.equal(f.owner.current(), false);
    const count = f.calls.length; await f.owner.controller.detectNormalized('QR'); assert.equal(f.calls.length, count); assert.equal(f.owner.controller.getSnapshot().valid, false);
  }
});
test('original account expiry at each pending fallback await suppresses old reports, further fallback requests and native commands', async () => {
  for (const blocked of ['primary', 'paddon', 'opening', 'material']) { const f = fixture(), pending = s.deferred(); f.pending(async kind => { if (kind === blocked) return pending.promise; throw s.apiError(); }); f.owner.controller.start(); await s.flush(); const reading = f.owner.controller.detectNormalized('12345'); await s.flush(); assert.equal(f.calls.at(-1)[0], blocked); f.issued(false); pending.resolve(blocked === 'primary' ? s.report('private') : blocked === 'paddon' ? s.paddon('12345') : blocked === 'opening' ? s.opening('private') : s.material('private')); await reading;
    assert.equal(f.owner.controller.getSnapshot().valid, false); assert.equal(f.owner.controller.getSnapshot().report, null); assert.equal(f.calls.at(-1)[0], blocked); assert.equal(f.calls.some(([kind]) => kind === 'return' || kind === 'queue'), false);
  }
});
test('factory rejects async, self-retiring and recursive parent authority and does not recover after a caught reentrant result', async () => {
  for (const authority of [f => () => Promise.reject(Error('async')), f => () => f.owner.current(), f => () => { f.allowed(false); return true; }]) { const f = fixture(); f.parent(authority(f)); assert.equal(f.owner.current(), false); f.parent(() => true); f.allowed(true); assert.equal(f.owner.current(), false); f.owner.controller.start(); assert.deepEqual(f.calls, []); }
  await s.flush();
});
test('scanOnly session skips catalog/APIs, returns exact Source-normalized result and fences replayed manual tickets after cleanup', async () => {
  const f = fixture({ scanOnly: true }); f.owner.controller.start(); const ticket = f.owner.controller.issueManual(); f.focus(false); await f.owner.controller.completeManual(ticket, ' \u0085 payload \u0085 '); assert.deepEqual(f.calls.map(([kind]) => kind), ['return']); assert.equal(f.calls[0][1], 'payload');
  f.owner.controller.detach(); f.owner.controller.start(); await f.owner.controller.completeManual(ticket, 'old'); assert.equal(f.calls.length, 1);
});
test('Source apparatus catalog is independent: late display data can join a report, failure is silent, and original owner loss suppresses the catalog', async () => {
  const f = fixture(), pending = s.deferred(), apparatus = Object.freeze({ id: 'factory:cut', label: 'Cutting' }); f.catalog(() => pending.promise); f.owner.controller.start(); await f.owner.controller.detectNormalized('QR'); assert.equal(f.owner.controller.getSnapshot().report.scanned_batch.batch_id, 'actual'); pending.resolve([apparatus]); await s.flush(); assert.equal(f.owner.controller.getSnapshot().apparatus[0], apparatus);
  const failed = fixture(); failed.catalog(async () => { throw Error('projection unavailable'); }); failed.owner.controller.start(); await s.flush(); assert.equal(failed.owner.controller.getSnapshot().status, 'prompt'); assert.deepEqual(failed.owner.controller.getSnapshot().apparatus, []); await failed.owner.controller.detectNormalized('QR'); assert.equal(failed.owner.controller.getSnapshot().status, 'reportReady');
  const retired = fixture(), old = s.deferred(); retired.catalog(() => old.promise); retired.owner.controller.start(); retired.issued(false); old.resolve([apparatus]); await s.flush(); assert.equal(retired.owner.controller.getSnapshot().valid, false); assert.deepEqual(retired.owner.controller.getSnapshot().apparatus, []);
});
