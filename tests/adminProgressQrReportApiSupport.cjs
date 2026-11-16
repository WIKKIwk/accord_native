const base = require('./adminProgressQrReportSupport.cjs');
function api(transport) {
  const production = base.load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': base.exception, '../workerControlsApi': base.controls });
  const client = base.load('admin/adminProgressQrReportApi', { '../authorizedFetch': transport, './adminProductionRequest': production,
    './adminProgressQrReportModel': base.report, './dartJsonString': base.strings });
  return { client, production };
}
function apiFixture(handler) {
  const session = { baseUrl: 'https://erp.example', token: 'original' }, calls = []; let valid = true;
  const guard = () => { if (!valid) throw Error('original report expired'); }, witness = () => { guard(); return true; };
  const loaded = api({ authorizedProgressQrReportSnapshot: async (...args) => { calls.push(args); return handler(...args); } });
  return { ...loaded, session, calls, guard, witness, retire: () => { valid = false; }, read: (value = ' QR ') => loaded.client.adminProgressQrReport(session, value, guard, witness) };
}
function transportFixture(t) {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const session = { baseUrl: 'https://erp.example', token: 'old' }, calls = []; let valid = true, joins = 0, legacy = 0, joinAvailable = true, onJoin = () => {}, handler = async () => new Response(JSON.stringify({ scanned_batch: base.batch() }));
  const guard = () => { if (!valid) throw Error('original report expired'); }, witness = () => { guard(); return true; };
  const transport = base.load('authorizedFetch', { './auth': { activeSessionToken: () => session.token,
    refreshSession: async () => { legacy++; session.token = 'legacy-new'; return true; },
    joinRefreshForGuardedRead: async (_session, _token, current) => { joins++; current(); onJoin(); if (!joinAvailable) return false; session.token = 'new'; current(); return true; } } });
  const loaded = api(transport); global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { ...loaded, session, calls, transport, guard, witness, retire: () => { valid = false; }, handler: value => { handler = value; },
    joins: () => joins, legacy: () => legacy, joinAvailable: value => { joinAvailable = value; }, onJoin: value => { onJoin = value; },
    read: (value = ' QR ', originalWitness = witness) => loaded.client.adminProgressQrReport(session, value, guard, originalWitness),
    snapshot: (value = 'QR', originalWitness = witness) => transport.authorizedProgressQrReportSnapshot(session, value, guard, originalWitness) };
}
module.exports = { ...base, api, apiFixture, transportFixture };
