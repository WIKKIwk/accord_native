import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

/** A discovered/deep-linked route must pass the same V2 guard as drawer navigation. */
export function materialPathAllowed(session: Session, pathname: string) {
  const match = /^\/(?:ios|android)-material(?:\/(.*))?$/.exec(pathname);
  // A root-owned native sheet may cover this still-mounted role layout.
  if (!match) return true;
  const first = (match[1] ?? '').split('/')[0];
  const routes: Record<string, string> = { '': appRoutes.materialHome, history: appRoutes.materialHistory,
    tasks: appRoutes.materialTasks, sequence: appRoutes.supplySequence, receipt: appRoutes.gscaleMode,
    assignments: appRoutes.adminRawMaterialAssignments, movements: appRoutes.inventoryMovements,
    profile: appRoutes.profile, chat: appRoutes.chat };
  return Object.hasOwn(routes, first) && canOpenRoute(session, routes[first]);
}
