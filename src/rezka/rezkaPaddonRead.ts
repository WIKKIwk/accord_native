import { adminPaddons } from '../paddonManagementApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { guardedRezkaRequest, isRezkaSessionCurrent, RezkaScopeChanged, type RezkaSessionSnapshot } from './rezkaSessionGuard';

/** Read-only, unconnected adapter. A catalog consumer must additionally verify that the assigned machine is an active cutter. */
export async function readRezkaPaddons(snapshot: RezkaSessionSnapshot, apparatusId: string) {
  const apparatus = apparatusId.trim();
  const current = () => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddons) && !!apparatus &&
    snapshot.session.assigned_apparatus.some(id => id.trim() === apparatus);
  if (!current()) throw new RezkaScopeChanged(false);
  try {
    const result = await guardedRezkaRequest(snapshot.session, 'master', snapshot, false,
      beforeSend => adminPaddons(snapshot.session, { apparatus, beforeSend: () => {
        if (!current()) throw new RezkaScopeChanged(false);
        beforeSend();
      } }));
    if (!current()) throw new RezkaScopeChanged(false);
    return result;
  } catch (error) {
    // This includes a failure while decoding either a success or an error body.
    if (!current()) throw new RezkaScopeChanged(false);
    throw error;
  }
}
