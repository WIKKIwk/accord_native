import * as Crypto from 'expo-crypto';
import { activeSessionToken, registerSessionResetHook, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
import { adminProductionMapOrderImageUrl, orderImageRequestUri } from './orderImageUri';
import { OrderImageCache } from './orderImageCacheCore';
import { FileOrderImageDiskStore } from './orderImageDiskStore';

const imageCache = new OrderImageCache(new FileOrderImageDiskStore(), key => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key));
registerSessionResetHook(() => imageCache.clear());

/** @v2 adminProductionMapOrderImage */
export async function adminProductionMapOrderImage(session: Session, orderId: string,
  options: { image_id?: string; thumbnail?: boolean } = {}): Promise<Uint8Array | null> {
  const order = orderId.trim();
  if (!order) return null;
  const token = activeSessionToken(session);
  if (!token) throw new Error('Sessiya tugagan. Qayta kiring.');
  const uri = orderImageRequestUri(session.baseUrl,
    adminProductionMapOrderImageUrl(session.baseUrl, order, options.image_id ?? ''), options.thumbnail === true);
  const accountScope = () => JSON.stringify([session.baseUrl, session.profile?.role ?? null, session.profile?.ref ?? null]);
  const scope = accountScope();
  const key = JSON.stringify([JSON.stringify([scope, token]), uri.toString()]);
  const immutable = !!(uri.searchParams.get('id') || uri.searchParams.get('image_id'));
  return imageCache.load({ key, thumbnail: options.thumbnail === true, immutable,
    isCurrent: () => !!activeSessionToken(session) && accountScope() === scope,
    fetch: async etag => {
      const headers: Record<string, string> = {};
      if (etag != null) headers['If-None-Match'] = etag;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await authorizedFetch(session, `${uri.pathname}${uri.search}`, { headers, signal: controller.signal });
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (response.status === 404 && !bytes.length) {
          throw new WorkerControlException('production_map_order_image_route_missing', 'Rasm xizmati topilmadi — server yangilanmagan');
        }
        return { status: response.status, bytes, etag: response.headers.get('etag'), cacheControl: response.headers.get('cache-control') ?? '' };
      } finally { clearTimeout(timer); }
    },
  });
}

/** @v2 orderImageAccountScope */
export function orderImageAccountScope(session: Session): string {
  const roles: Record<string, string> = { tayyorlov_masteri: 'tayyorlovMasteri', material_taminotchi: 'materialTaminotchi',
    homashyo_rezkachi: 'homashyoRezkachi', sales_manager: 'salesManager', rezka_master: 'rezkaMaster' };
  const role = session.profile?.role;
  return JSON.stringify([session.baseUrl, typeof role === 'string' ? roles[role] ?? role : null, session.profile?.ref ?? null]);
}
/** @v2 orderImageCacheScope */
export function orderImageCacheScope(session: Session): string {
  return JSON.stringify([orderImageAccountScope(session), activeSessionToken(session)]);
}
function genericImageContext(session: Session, imageUrl: string, thumbnail: boolean) {
  const uri = orderImageRequestUri(session.baseUrl, imageUrl, thumbnail), internal = uri.origin === new URL(session.baseUrl).origin;
  const account = orderImageAccountScope(session), key = JSON.stringify([orderImageCacheScope(session), uri.toString()]);
  const immutable = internal && !!(uri.searchParams.get('id') || uri.searchParams.get('image_id'));
  return { uri, internal, key, immutable, isCurrent: () => orderImageAccountScope(session) === account };
}
/** @v2 peekCachedOrderImageBytes */
export function peekCachedOrderImageBytes(session: Session, imageUrl: string, thumbnail = false): Uint8Array | null {
  if (!imageUrl.trim()) return null;
  const { internal, key, immutable, isCurrent } = genericImageContext(session, imageUrl, thumbnail);
  if (internal && !activeSessionToken(session)) return null;
  return imageCache.peek(key, immutable, isCurrent);
}

// Arbitrary same-origin paths and test-mode requests still need V2 transport parity.
export async function cachedOrderImageBytes(session: Session, imageUrl: string, thumbnail = false): Promise<Uint8Array | null> {
  if (!imageUrl.trim()) return null;
  const { uri, internal, key, immutable, isCurrent } = genericImageContext(session, imageUrl, thumbnail);
  if (internal && !activeSessionToken(session)) throw new Error('No session token');
  return imageCache.load({ key, thumbnail, immutable, isCurrent, fetch: async etag => {
    const headers: Record<string, string> = {};
    if (etag != null) headers['If-None-Match'] = etag;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = internal
        ? await authorizedFetch(session, `${uri.pathname}${uri.search}`, { headers, signal: controller.signal })
        : await fetch(uri.toString(), { headers, signal: controller.signal });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (internal && response.status === 404 && !bytes.length)
        throw new WorkerControlException('production_map_order_image_route_missing', 'Rasm xizmati topilmadi — server yangilanmagan');
      return { status: response.status, bytes, etag: response.headers.get('etag'), cacheControl: response.headers.get('cache-control') ?? '' };
    } finally { clearTimeout(timer); }
  } });
}
