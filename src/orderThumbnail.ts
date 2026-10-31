import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';

type CachedImage = { uri: string | null; expires: number };
type ImageCache = { entries: Map<string, CachedImage>; pending: Map<string, Promise<string | null>> };
const caches = new WeakMap<Session, ImageCache>();
const waiting: (() => void)[] = [];
let running = 0;

async function withThumbnailSlot<T>(load: () => Promise<T>): Promise<T> {
  if (running >= 4) await new Promise<void>(resolve => waiting.push(resolve));
  else running++;
  try { return await load(); }
  finally {
    const next = waiting.shift();
    if (next) next(); else running--;
  }
}

function asDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image read failed'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Fetch the same authorized, versioned thumbnail used by V2's worker list. */
export function loadOrderThumbnail(session: Session, orderId: string, imageId: string): Promise<string | null> {
  if (!activeSessionToken(session) || !orderId) return Promise.resolve(null);
  let cache = caches.get(session);
  if (!cache) { cache = { entries: new Map(), pending: new Map() }; caches.set(session, cache); }
  const currentCache = cache;
  const key = JSON.stringify([orderId, imageId]);
  const cached = cache.entries.get(key);
  if (cached && cached.expires > Date.now()) {
    cache.entries.delete(key);
    cache.entries.set(key, cached);
    return Promise.resolve(cached.uri);
  }
  cache.entries.delete(key);
  const pending = cache.pending.get(key);
  if (pending) return pending;

  const request = withThumbnailSlot(async () => {
    if (!activeSessionToken(session)) return null;
    const query = new URLSearchParams({ order_id: orderId, variant: 'thumb-v1' });
    if (imageId) query.set('image_id', imageId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/order-image/view?${query}`, { signal: controller.signal });
      if (!activeSessionToken(session)) return null;
      const missing = response.status === 404;
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      if (!missing && (!response.ok || !contentType.startsWith('image/'))) return null;
      const blob = missing ? null : await response.blob();
      // React Native's network Blob can omit the response MIME type.
      const uri = blob ? await asDataUri(blob.slice(0, blob.size, contentType)) : null;
      if (!activeSessionToken(session)) return null;
      const ttl = missing ? 15000 : imageId ? 86400000 : 30000;
      // Keep thumbnails session-local and bounded; large responses are displayed but not retained.
      if (!uri || uri.length <= 256 * 1024) {
        currentCache.entries.set(key, { uri, expires: Date.now() + ttl });
        while (currentCache.entries.size > 96) currentCache.entries.delete(currentCache.entries.keys().next().value!);
      }
      return uri;
    } catch { return null; }
    finally { clearTimeout(timeout); }
  }).finally(() => { currentCache.pending.delete(key); });
  cache.pending.set(key, request);
  return request;
}
