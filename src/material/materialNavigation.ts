import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

// Material entrypoints are intentionally absent until scope/session safety and
// the reachable destinations have been reviewed on both native platforms.
const materialRoutingEnabled: boolean = false;

/** Destinations without an audited native implementation are deliberately omitted. */
export function materialDrawerItems(session: Session, labels: { home: string; profile: string }): RoleDrawerItem[] {
  if (!materialRoutingEnabled) return [];
  return [
    { id: 'home', label: labels.home, symbol: { ios: 'house', android: 'home' } },
    ...(canOpenRoute(session, appRoutes.materialHistory) ? [{ id: 'history', label: 'Harakatlar tarixi',
      symbol: { ios: 'clock.arrow.circlepath' as const, android: 'history' as const } }] : []),
    { id: 'profile', label: labels.profile, symbol: { ios: 'person', android: 'person' } },
  ];
}
export function materialDrawerActive(path: string): string {
  const route = path.replace(/^\/(ios|android)-material\/?/, '');
  return route === 'history' ? 'history' : route === 'profile' ? 'profile' : route ? '' : 'home';
}
export function materialRoute(id: string, platform: 'ios' | 'android'): string | null {
  if (!materialRoutingEnabled) return null;
  const base = `/${platform}-material`;
  return id === 'home' ? base : id === 'history' ? `${base}/history` : id === 'profile' ? `${base}/profile` : null;
}
