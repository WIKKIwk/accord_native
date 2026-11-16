import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { activeSessionEpoch, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminCreateFactoryLocation, adminFactoryLocations, adminReplaceFactoryLocationApparatus, adminUpdateFactoryLocation } from './factoryLocationApi';
import { FactoryLocationController } from './factoryLocationController';

/** One screen owns the original session witness; an expired owner never recaptures it. */
export function createFactoryLocationSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  let retired = false;
  const current = () => {
    if (retired) return false;
    try {
      if (witness.session !== session || session.token === 'test-mode-token' || !isSessionWitnessCurrent(witness) ||
          !isSynchronouslyTrue(isCurrent) || !canOpenRoute(session, appRoutes.adminFactoryLocations)) retired = true;
    } catch { retired = true; }
    return !retired;
  };
  return new FactoryLocationController({ isCurrent: current, scope: () => sessionReadScope(session),
    generation: () => activeSessionEpoch(session), canManage: current,
    readLocations: guard => adminFactoryLocations(session, guard, () => { try { guard(); return current(); } catch { return false; } }),
    readApparatus: guard => adminApparatus(session, { limit: 10000, beforeSend: guard,
      readWitness: () => { try { guard(); return current(); } catch { return false; } } }),
    create: (name, ids, guard) => adminCreateFactoryLocation(session, name, ids, guard),
    replaceApparatus: (id, ids, guard) => adminReplaceFactoryLocationApparatus(session, id, ids, guard),
    update: (id, change, guard) => adminUpdateFactoryLocation(session, id, change, guard),
  });
}
