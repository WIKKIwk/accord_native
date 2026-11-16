import { fetch as imageFetch } from 'expo/fetch';
import type { Session } from '../auth';
import { authorizedImageFetch } from '../authorizedFetch';
import { peekScopedCachedOrderImageBytes, scopedCachedOrderImageBytes, type ScopedOrderImageResponse } from '../orderImageApi';
import { MobileApiException } from '../shared/mobileApiException';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { checkedAdminGuard } from './adminProductionRequest';

type Guard = () => void;
export type AdminItemDetailImageAuthority = Readonly<{ accountGuard: Guard; accountWitness: () => boolean; pageGuard: Guard }>;
function guards(authority: AdminItemDetailImageAuthority) {
  const original = checkedAdminGuard(authority.accountGuard), page = checkedAdminGuard(authority.pageGuard);
  if (!original || !page || typeof authority.accountWitness !== 'function') throw new TypeError('Item image requires its original account and page authorities');
  let expired = false;
  const account = () => {
    if (expired) throw new Error('Image account changed');
    try { original(); if (!isSynchronouslyTrue(authority.accountWitness)) throw new Error('Image account changed'); original(); }
    catch (error) { expired = true; throw error; }
  };
  return { account, page, current: () => { try { account(); return true; } catch { return false; } } };
}
async function externalImage(uri: URL, headers: Record<string, string>, guard: Guard, signal: AbortSignal): Promise<Response> {
  let current = uri, remaining = 5;
  while (true) {
    guard(); if (current.protocol !== 'https:' || current.username || current.password) throw new TypeError('Image redirect requires HTTPS');
    const response = await imageFetch(current.toString(), { method: 'GET', headers, redirect: 'manual', credentials: 'omit', signal }); guard();
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location'); if (!location) return response;
    if (response.body) { await response.arrayBuffer(); guard(); }
    const next = new URL(location, current); guard(); if (remaining-- <= 0) throw new TypeError('Too many image redirects'); current = next;
  }
}
/** Source image bytes share the original global account/session/URI/variant cache, never a new Admin cache namespace. */
export async function adminItemDetailImageBytes(session: Session, imageUrl: string, authority: AdminItemDetailImageAuthority): Promise<Uint8Array | null> {
  const { account, page, current } = guards(authority); page(); account();
  try {
    const bytes = await scopedCachedOrderImageBytes(session, imageUrl, true, { isCurrent: current, fetch: async (uri, etag): Promise<ScopedOrderImageResponse> => {
      account(); const internal = uri.origin === new URL(session.baseUrl).origin, headers: Record<string, string> = {};
      if (etag !== null) headers['If-None-Match'] = etag;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = internal ? await authorizedImageFetch(session, `${uri.pathname}${uri.search}`, { headers, signal: controller.signal }, { beforeSend: account, readWitness: current })
          : await externalImage(uri, headers, account, controller.signal);
        account(); const bytes = new Uint8Array(await response.arrayBuffer()); account();
        if (internal && response.status === 404 && !bytes.length) throw new MobileApiException({ code: 'production_map_order_image_route_missing', message: 'Rasm xizmati topilmadi — server yangilanmagan' });
        const result = { status: response.status, bytes, etag: response.headers.get('etag'), cacheControl: response.headers.get('cache-control') ?? '' }; account(); return result;
      } catch (error) { account(); throw error; } finally { clearTimeout(timer); }
    } });
    account(); page(); return bytes;
  } catch (error) { account(); page(); throw error; }
}
export function peekAdminItemDetailImageBytes(session: Session, imageUrl: string, authority: AdminItemDetailImageAuthority): Uint8Array | null {
  const { account, page, current } = guards(authority); account(); page(); const bytes = peekScopedCachedOrderImageBytes(session, imageUrl, true, current); account(); page(); return bytes;
}
