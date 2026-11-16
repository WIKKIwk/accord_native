import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { orderImageCacheScope } from '../orderImageApi';
import { orderImageRequestUri } from '../orderImageUri';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminItemDetailImageBytes, peekAdminItemDetailImageBytes } from './adminItemDetailImageApi';

/** Byte-provider identity follows Source OrderImageProvider: account/token scope, normalized thumbnail URL and refresh epoch. */
export function createAdminItemDetailImageProvider(session: Session, witness: SessionWitness, isPageCurrent: () => boolean, imageUrl: string, now: () => number = Date.now) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), cacheScope = orderImageCacheScope(session);
  const uri = orderImageRequestUri(session.baseUrl, imageUrl, true), url = uri.toString();
  const refreshEpoch = uri.searchParams.get('id') || uri.searchParams.get('image_id') ? 0 : Math.trunc(now() / 30_000);
  let retired = false, checking = false;
  const accountCurrent = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      if (epoch === null || activeSessionEpoch(session) !== epoch || !activeSessionToken(session) || session.token === 'test-mode-token' || witness.session !== session ||
        !isSessionWitnessCurrent(witness) || sessionReadScope(session) !== scope || !canOpenRoute(session, appRoutes.adminItemDetail)) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const accountGuard = () => { if (!accountCurrent()) throw new Error('Image account changed'); };
  const authority = () => {
    let closed = false;
    const pageGuard = () => { if (closed || !isSynchronouslyTrue(isPageCurrent)) { closed = true; throw new Error('Image consumer changed'); } };
    return { accountGuard, accountWitness: accountCurrent, pageGuard };
  };
  const checkProvider = () => { accountGuard(); if (cacheScope !== orderImageCacheScope(session)) throw new Error('Image session changed'); };
  return Object.freeze({ url, thumbnail: true as const, cacheScope, refreshEpoch, key: JSON.stringify([url, cacheScope, true, refreshEpoch]), accountCurrent,
    load: async (): Promise<Uint8Array> => {
      checkProvider(); const bytes = await adminItemDetailImageBytes(session, url, authority());
      if (!bytes?.length) throw new Error('Order image unavailable'); return bytes;
    },
    peek: (): Uint8Array | null => { checkProvider(); return peekAdminItemDetailImageBytes(session, url, authority()); },
  });
}
