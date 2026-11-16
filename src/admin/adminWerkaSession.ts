import * as Clipboard from 'expo-clipboard';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminSettings, updateAdminSettings } from './adminSettings';
import { adminRegenerateWerkaCode } from './adminWerkaApi';
import { AdminWerkaController } from './adminWerkaController';

export function createAdminWerkaSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const parentCurrent = createProfileSessionGuard(isCurrent);
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false;
  const current = () => {
    if (retired) return false;
    const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminWerka);
    if (!valid() || !parentCurrent() || !valid()) retired = true;
    return !retired;
  };
  return { current, controller: new AdminWerkaController({ isCurrent: current,
    read: (guard, readWitness) => adminSettings(session, guard, readWitness), write: (value, guard) => updateAdminSettings(session, value, guard),
    regenerate: guard => adminRegenerateWerkaCode(session, guard),
    copy: async (text, guard) => { guard(); const copied = await Clipboard.setStringAsync(text); guard(); if (!copied) throw new Error('Clipboard write failed'); },
  }) };
}
