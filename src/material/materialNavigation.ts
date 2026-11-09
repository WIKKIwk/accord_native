import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

/** Destinations without a reviewed route remain omitted. */
export function materialDrawerItems(session: Session, labels: { home: string; profile: string }): RoleDrawerItem[] {
  if (session.profile.role !== 'material_taminotchi' || !canOpenRoute(session, appRoutes.materialHome)) return [];
  return [
    { id: 'home', label: labels.home, symbol: { ios: 'house', android: 'home' } },
    ...(canOpenRoute(session, appRoutes.materialTasks) ? [{ id: 'tasks', label: 'Vazifalar', symbol: { ios: 'checklist' as const, android: 'assignment' as const } }] : []),
    { id: 'profile', label: labels.profile, symbol: { ios: 'person', android: 'person' } },
  ];
}
export function materialDrawerActive(path: string): string {
  const route = path.replace(/^\/(ios|android)-material\/?/, '');
  return route === 'tasks' ? 'tasks' : route === 'history' ? 'history' : route === 'profile' ? 'profile' : route ? '' : 'home';
}
export function materialRoute(id: string, platform: 'ios' | 'android'): string | null {
  const base = `/${platform}-material`;
  return id === 'home' ? base : id === 'profile' || id === 'tasks' ? `${base}/${id}` : null;
}
