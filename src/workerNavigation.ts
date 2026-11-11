import type { Session } from './auth';
import { isCanonicalApparatusId } from './workerControlsApi';
import { appRoutes, canOpenRoute } from './shared/appRoutes';

/** @v2 _AparatchiNavigationDrawerState */
export function workerDailyWorkVisible(session: Session): boolean {
  return (session.profile.role === 'aparatchi' || session.profile.role === 'rezka_master') &&
    session.assigned_apparatus.some(isCanonicalApparatusId);
}

export const workerInventoryVisible = (session: Session): boolean => canOpenRoute(session, appRoutes.inventoryMovements);
