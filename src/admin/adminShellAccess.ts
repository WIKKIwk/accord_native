import type { Session } from '../auth';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';

/** V2 can select the Admin home by capability, not only by role name. */
export function adminShellMayEnter(session: Session | null): boolean {
  if (!session) return false;
  const home = homeRoute(session);
  return home === appRoutes.adminHome && canOpenRoute(session, home);
}

/** Only expose a destination when the owner explicitly enables a reviewed integration. */
export function adminDestinationPath(session: Session, route: string, platform: string, enabled: ReadonlySet<string>): string | null {
  if (!adminShellMayEnter(session) || !enabled.has(route) || !canOpenRoute(session, route)) return null;
  if (platform !== 'ios' && platform !== 'android') return null;
  if (route === appRoutes.profile) return `/${platform}-admin/profile`;
  if (route === appRoutes.gscaleMode) return `/${platform}-gscale`;
  return null;
}
