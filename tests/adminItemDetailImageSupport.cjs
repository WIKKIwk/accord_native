const crypto = require('node:crypto');
const base = require('./adminItemDetailSupport.cjs');
const { load, sync, exception, checked } = base;
const uri = load('orderImageUri'), cache = load('orderImageCacheCore'), scope = load('sessionReadScope'), routes = load('shared/appRoutes');
function fixture(t) {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const session = { token: 'original', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'account' }, capabilities: ['admin.access'] }, witness = { session };
  let active = session, epoch = 1, issued = true, now = 60_000, joins = 0, refreshes = 0, onJoin = () => {}, onRefresh = () => {}, handler = async () => new Response(new Uint8Array([1, 2, 3]));
  const calls = [], digests = [], resetHooks = [], diskValues = new Map(), writes = [];
  class Disk {
    async read(key) { return diskValues.get(key) ?? null; }
    async write(key, value) { writes.push(key); diskValues.set(key, value); }
    async remove(key) { diskValues.delete(key); }
    async clear() { diskValues.clear(); }
  }
  const auth = { activeSessionToken: value => value === active ? value.token : null, activeSessionEpoch: value => value === active ? epoch : null,
    isSessionWitnessCurrent: value => issued && value === witness,
    registerSessionResetHook: fn => { resetHooks.push(fn); return () => {}; },
    joinRefreshForGuardedRead: async (_session, _token, check) => { joins++; check(); onJoin(); session.token = 'refreshed'; check(); return true; },
    refreshSession: async () => { refreshes++; onRefresh(); session.token = 'refreshed'; return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  const images = load('orderImageApi', { 'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_algorithm, value) => { digests.push(value); return crypto.createHash('sha256').update(value).digest('hex'); } },
    './auth': auth, './authorizedFetch': transport, './workerControlsApi': { WorkerControlException: class extends Error {} }, './orderImageUri': uri,
    './orderImageCacheCore': { OrderImageCache: class extends cache.OrderImageCache { constructor(disk, digest) { super(disk, digest, () => now); } } },
    './orderImageDiskStore': { FileOrderImageDiskStore: Disk }, './shared/camera/synchronousGuard': sync });
  const api = load('admin/adminItemDetailImageApi', { '../authorizedFetch': transport, '../orderImageApi': images,
    '../shared/mobileApiException': exception, '../shared/camera/synchronousGuard': sync, './adminProductionRequest': checked });
  const providers = load('admin/adminItemDetailImageProvider', { '../auth': auth, '../orderImageApi': images, '../orderImageUri': uri,
    '../sessionReadScope': scope, '../shared/appRoutes': routes, '../shared/camera/synchronousGuard': sync, './adminItemDetailImageApi': api });
  global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { session, witness, calls, digests, diskValues, writes, images, api, transport,
    provider: (url, page = () => true) => providers.createAdminItemDetailImageProvider(session, witness, page, url, () => now),
    handler: value => { handler = value; }, advance: value => { now += value; }, joins: () => joins, refreshes: () => refreshes,
    onJoin: value => { onJoin = value; }, onRefresh: value => { onRefresh = value; },
    retire: () => { issued = false; epoch++; active = null; }, reset: async () => { for (const hook of resetHooks) await hook(); },
    authority: (page = () => {}) => ({ accountGuard: () => { if (!issued || active !== session) throw Error('account expired'); }, accountWitness: () => issued && active === session, pageGuard: page }) };
}
module.exports = { ...base, uri, fixture };
