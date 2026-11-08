import { currentSession, type Session } from '../auth';
import { appPreferences } from '../appPreferences';
import { sessionReadScope } from '../sessionReadScope';
import { qolipBlocksData } from './qolipBlocksApi';
import { qolipHomeBlockOrderKey } from './qolipHomeLogic';
import { QolipHomeState } from './qolipHomeState';
import { qolipLocations } from './qolipLocationsApi';

/** Legacy unmounted runtime, not a session witness. The guarded owner uses qolipHomeOwnerRuntime instead. */
export function createQolipHomeState(session: Session): QolipHomeState {
  return new QolipHomeState({
    blocks: () => qolipBlocksData(session), locations: block => qolipLocations(session, block),
    readOrder: async () => {
      const raw = await appPreferences.getItem(qolipHomeBlockOrderKey);
      if (raw === null) return [];
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || value.some(key => typeof key !== 'string')) throw new TypeError('Invalid saved block order');
      return value;
    },
    saveOrder: keys => appPreferences.setItem(qolipHomeBlockOrderKey, JSON.stringify(keys)),
    scope: () => { const current = currentSession(); return current ? sessionReadScope(current) : ''; },
    valid: () => currentSession() === session && session.profile.role === 'qolipchi',
    // Two frames ensure the first frame completes before V2's post-frame refresh equivalent runs.
    afterFrame: callback => requestAnimationFrame(() => requestAnimationFrame(callback)),
  }, session.profile.role === 'qolipchi');
}
