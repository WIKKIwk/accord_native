import { activeSessionToken, type Session } from '../auth';
import { appPreferences } from '../appPreferences';
import { sessionReadScope } from '../sessionReadScope';
import { assertQolipReadCurrent } from './qolipApiCommon';
import { qolipBlocksData } from './qolipBlocksApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipHomeBlockOrderKey } from './qolipHomeLogic';
import { QolipHomeOwnerState } from './qolipHomeOwnerState';
import { QolipHomeState } from './qolipHomeState';
import { qolipLocations } from './qolipLocationsApi';

/** Required original shared-witness boundary. This function never captures or substitutes a session witness. */
export function createQolipHomeOwner(session: Session, boundary: QolipHomeReadBoundary): QolipHomeOwnerState {
  const scope = sessionReadScope(session);
  const boundaryCurrent = () => boundary.current();
  let expired = false;
  const current = () => {
    if (expired) return false;
    try {
      const allowed = () => sessionReadScope(session) === scope && session.profile.role === 'qolipchi' &&
        session.capabilities.includes('qolip.manage') && !!activeSessionToken(session) && activeSessionToken(session) !== 'test-mode-token';
      if (!allowed()) { expired = true; return false; }
      assertQolipReadCurrent(boundaryCurrent);
      if (!allowed()) { expired = true; return false; }
      return !expired;
    } catch { expired = true; return false; }
  };
  const roleBoundary = { current, subscribe: (listener: () => void) => boundary.subscribe(listener) };
  return new QolipHomeOwnerState(roleBoundary, isCurrent => {
    const assertCurrent = () => { assertQolipReadCurrent(isCurrent); };
    return new QolipHomeState({
      blocks: () => qolipBlocksData(session, isCurrent),
      locations: block => qolipLocations(session, block, isCurrent),
      readOrder: async () => {
        assertCurrent();
        const raw = await appPreferences.getItem(qolipHomeBlockOrderKey);
        assertCurrent();
        if (raw === null) return [];
        const value: unknown = JSON.parse(raw);
        assertCurrent();
        if (!Array.isArray(value) || value.some(key => typeof key !== 'string')) throw new TypeError('Invalid saved block order');
        assertCurrent();
        return value;
      },
      valid: isCurrent,
    });
  });
}
