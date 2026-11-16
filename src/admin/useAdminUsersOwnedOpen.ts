import { useCallback } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminUsersScreenProps } from './AdminUsersScreenTypes';
import { useAdminOwnedNavigation } from './AdminOwnedNavigationContext';

/** The actual inner Users controller owns its ticket, including when AppRouter embeds Users as a missing-ref fallback. */
export function useAdminUsersOwnedOpen(current: () => boolean, interactive: () => boolean) {
  const { owner } = useAdminOwnedNavigation(), registry = owner.registry;
  return useCallback<AdminUsersScreenProps['onOpenUser']>((ticket, lifetime) => {
    if (!interactive() || !isSynchronouslyTrue(lifetime.isCurrent) || !isSynchronouslyTrue(lifetime.canInteract) || !interactive()) return Promise.resolve(false);
    return registry.open({ kind: 'user', ticket }, {
      isCurrent: () => current() && isSynchronouslyTrue(lifetime.isCurrent) && current(),
      canInteract: () => interactive() && isSynchronouslyTrue(lifetime.canInteract) && interactive(),
    });
  }, [registry, current, interactive]);
}
