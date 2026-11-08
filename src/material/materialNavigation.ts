import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

/** Only home and the existing Profile are connected; held destinations are omitted. */
export function materialDrawerItems(session: Session, labels: { home: string; profile: string }): RoleDrawerItem[] {
  if (session.profile.role !== 'material_taminotchi' || !canOpenRoute(session, appRoutes.materialHome)) return [];
  return [
    { id: 'home', label: labels.home, symbol: { ios: 'house', android: 'home' } },
    { id: 'profile', label: labels.profile, symbol: { ios: 'person', android: 'person' } },
  ];
}
export function materialDrawerActive(path: string): string {
  const route = path.replace(/^\/(ios|android)-material\/?/, '');
  return route === 'history' ? 'history' : route === 'profile' ? 'profile' : route ? '' : 'home';
}
export function materialRoute(id: string, platform: 'ios' | 'android'): string | null {
  const base = `/${platform}-material`;
  return id === 'home' ? base : id === 'profile' ? `${base}/profile` : null;
}
