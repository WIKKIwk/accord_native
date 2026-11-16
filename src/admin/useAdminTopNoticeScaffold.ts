import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { useAdminTopNoticeTarget } from './AdminTopNoticeProvider';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

/** Required logical Source ancestor: pass null ONLY for a genuine Source route-root Scaffold. */
export function useAdminTopNoticeScaffold(ancestor: AdminTopNoticeScaffold | null) {
  const { messenger, progress } = useAdminTopNoticeTarget();
  const ticket = useMemo(() => messenger.createScaffold({}, ancestor), [messenger, ancestor]);
  useLayoutEffect(() => ticket ? messenger.attachScaffold(ticket) ?? undefined : undefined, [messenger, ticket]);
  const state = useSyncExternalStore(messenger.subscribe, messenger.getSnapshot, messenger.getSnapshot);
  return { messenger, progress, ticket, banner: ticket ? messenger.bannerFor(ticket) : null, accessibleNavigation: state.accessibleNavigation };
}
export type AdminTopNoticeScaffoldBinding = ReturnType<typeof useAdminTopNoticeScaffold>;
