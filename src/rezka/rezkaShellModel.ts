import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';
import { isCanonicalApparatusId } from '../workerControlsApi';

/** Only the master home uses this shell; common account routes are still guarded by its active session. */
export function canEnterRezkaShell(session: Session | null): session is Session {
  return !!session && session.profile.role === 'rezka_master' && canOpenRoute(session, appRoutes.apparatusQueue);
}
export function rezkaShellDrawerItems(session: Session, locale: string): RoleDrawerItem[] {
  return [
    { id: 'queue', label: localizedGetter('monitoringNavTitle', locale), symbol: { ios: 'list.bullet.rectangle', android: 'view_list' } },
    { id: 'workers', label: adminText('worker.title', locale), symbol: { ios: 'person.2', android: 'groups' } },
    ...(session.assigned_apparatus.some(isCanonicalApparatusId) ? [{ id: 'daily', label: productionText('worker.daily', locale),
      symbol: { ios: 'calendar' as const, android: 'today' as const } }] : []),
    { id: 'profile', label: localizedGetter('profileTitle', locale), symbol: { ios: 'person.crop.circle', android: 'person' } },
  ];
}
export function rezkaShellCanNavigate(session: Session, destination: string): boolean {
  if (!canEnterRezkaShell(session)) return false;
  const route = destination === 'queue' ? appRoutes.apparatusQueue : destination === 'workers' ? appRoutes.adminWorkerSettings
    : destination === 'daily' ? appRoutes.apparatusDailyWork : destination === 'profile' ? appRoutes.profile : null;
  return route !== null && canOpenRoute(session, route);
}
