const s = require('./adminProgressQrFallbackSupport.cjs');
function api(transport) {
  const production = s.load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': s.exception, '../workerControlsApi': s.controls });
  return s.load('admin/adminProgressQrMaterialApi', { '../authorizedFetch': transport, '../shared/camera/synchronousGuard': s.strict,
    './adminProductionRequest': production, './adminProgressQrFallbackModel': s.model, './dartJsonString': s.strings });
}
function fixture(t) {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const session = { token: 'old', baseUrl: 'https://erp.example' }, calls = [];
  let valid = true, joins = 0, legacy = 0, handler = async () => new Response('{}'), onJoin = () => {};
  const guard = () => { if (!valid) throw Error('original raw owner expired'); }, witness = () => { guard(); return true; };
  const transport = s.load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { legacy++; return false; },
    joinRefreshForGuardedRead: async (_session, _token, check) => { joins++; check(); await onJoin(); session.token = 'new'; check(); return true; } } });
  const client = api(transport); global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { ...s, session, calls, transport, client, guard, witness, retire: () => { valid = false; }, handler: value => { handler = value; }, onJoin: value => { onJoin = value; },
    joins: () => joins, legacy: () => legacy, read: (code = ' RAW ', originalWitness = witness) => client.adminProgressQrMaterialLookup(session, code, guard, originalWitness),
    direct: (code = 'RAW', originalGuard = guard, originalWitness = witness) => transport.authorizedRawMaterialLookupRead(session, code, originalGuard, originalWitness) };
}
function clock(t) {
  const set = global.setTimeout, clear = global.clearTimeout, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance'); let now = 0, serial = 0; const timers = new Map();
  t.after(() => { global.setTimeout = set; global.clearTimeout = clear; Object.defineProperty(globalThis, 'performance', descriptor); });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  global.setTimeout = (callback, delay) => { const id = ++serial; timers.set(id, { at: now + delay, callback, delay }); return id; }; global.clearTimeout = id => timers.delete(id);
  return { pending: () => [...timers.values()].map(value => ({ delay: value.delay, remaining: value.at - now })), jump: value => { now += value; }, now: () => now,
    async advance(duration) { const target = now + duration;
      while (true) { const next = [...timers.entries()].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].callback(); await s.flush(); }
      now = target; await s.flush();
    } };
}
module.exports = { ...s, api, fixture, clock };
