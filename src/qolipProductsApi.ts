import { activeSessionToken, type Session } from './auth';
import { authorizedFetch, currentQueueSnapshotReadEpoch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
import { qolipAccountGuard, qolipProductFromJson } from './qolipCatalogApi';

type Product = ReturnType<typeof qolipProductFromJson>;
type Cache = { scope: string; products: Product[] | null; etag: string | null; storedAt: number; inflight: Promise<Product[]> | null; generation: number };
let snapshot: Cache | null = null;
let identityCounter = 0;
const identities = new WeakMap<object, number>();
function identity(value: object): number {
  let id = identities.get(value);
  if (id == null) { id = ++identityCounter; identities.set(value, id); }
  return id;
}
function scope(session: Session) {
  return JSON.stringify([session.baseUrl, activeSessionToken(session), identity(session), session.profile ? identity(session.profile) : null, session.profile, currentQueueSnapshotReadEpoch()]);
}
function cacheFor(session: Session) {
  const key = scope(session);
  if (!snapshot || snapshot.scope !== key) snapshot = { scope: key, products: null, etag: null, storedAt: 0, inflight: null, generation: 0 };
  return snapshot;
}
export function cachedQolipProducts(session: Session): Product[] | null {
  if (!activeSessionToken(session)) return null;
  const cache = cacheFor(session), age = Date.now() - cache.storedAt;
  return cache.products && age >= 0 && age < 120_000 ? cache.products : null;
}
/** @v2 qolipProducts */
export function qolipProducts(session: Session, input: { query?: string; limit?: number; with_qolip_only?: boolean } = {}): Promise<Product[]> {
  const search = (input.query ?? '').trim(), limit = input.limit ?? 50, only = input.with_qolip_only === true;
  const cache = !search && limit === 20000 && only ? cacheFor(session) : null;
  if (cache?.inflight) return cache.inflight;
  const previous = cache?.products ?? null, etag = cache?.etag ?? null, generation = cache ? ++cache.generation : 0;
  const initialScope = scope(session), guard = qolipAccountGuard(session);
  const pending = (async () => {
    const query = new URLSearchParams();
    if (search) query.set('q', search);
    if (limit > 0) query.set('limit', String(limit));
    if (only) query.set('with_qolip', 'true');
    const suffix = query.toString();
    try {
      const headers: Record<string, string> = {};
      if (previous && etag != null) headers['If-None-Match'] = etag;
      const path = '/v1/mobile/qolip/products';
      const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path, { headers }, guard);
      let products: Product[];
      if (response.status === 304 && previous) products = previous;
      else if (response.status === 200) {
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid Qolip products');
        const raw = (data as { products?: unknown }).products;
        products = Array.isArray(raw) ? raw.map(qolipProductFromJson) : [];
      } else throw new WorkerControlException('qolip_products_failed', 'Qolip products failed', response.status);
      guard();
      if (initialScope !== scope(session)) return await qolipProducts(session, input);
      if (cache && cache.generation === generation) {
        cache.products = products; cache.etag = response.headers.get('etag') ?? (response.status === 304 ? etag : null); cache.storedAt = Date.now();
      }
      return products;
    } catch (error) {
      if (cache && cache.generation === generation) { cache.products = null; cache.etag = null; cache.storedAt = 0; }
      throw error;
    }
  })();
  if (cache) {
    const tracked = pending.finally(() => { if (cache.inflight === tracked) cache.inflight = null; });
    cache.inflight = tracked;
    return tracked;
  }
  return pending;
}
