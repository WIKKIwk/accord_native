import { createContext, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { useAdminTopNoticeTarget } from './AdminTopNoticeProvider';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

export const AdminRouteScaffoldContext = createContext<AdminTopNoticeScaffoldBinding | null>(null);

/** Required logical Source ancestor: pass null ONLY for a genuine Source route-root Scaffold. */
export function useAdminTopNoticeScaffold(ancestor: AdminTopNoticeScaffold | null): AdminTopNoticeScaffoldBinding {
  const { messenger, progress } = useAdminTopNoticeTarget();
  const route = useContext(AdminRouteScaffoldContext), inherited = ancestor === null && route?.messenger === messenger ? route.ticket : null;
  const ticket = useMemo(() => inherited ?? messenger.createScaffold({}, ancestor), [messenger, ancestor, inherited]);
  useLayoutEffect(() => ticket && !inherited ? messenger.attachScaffold(ticket) ?? undefined : undefined, [messenger, ticket, inherited]);
  const state = useSyncExternalStore(messenger.subscribe, messenger.getSnapshot, messenger.getSnapshot);
  return { messenger, progress, ticket, banner: ticket ? messenger.bannerFor(ticket) : null, accessibleNavigation: state.accessibleNavigation };
}
export type AdminTopNoticeScaffoldBinding = { messenger: ReturnType<typeof useAdminTopNoticeTarget>['messenger']; progress: ReturnType<typeof useAdminTopNoticeTarget>['progress']; ticket: AdminTopNoticeScaffold | null; banner: ReturnType<ReturnType<typeof useAdminTopNoticeTarget>['messenger']['bannerFor']>; accessibleNavigation: boolean | null };
