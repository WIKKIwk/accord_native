import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { AdminPresentationWindowOwner, type AdminPresentationWindowOwnerOptions } from './adminPresentationWindowOwner';

/** Options are captured for the original identity; a replacement window requires a new identity AND ticket. */
export function useAdminPresentationWindow(options: AdminPresentationWindowOwnerOptions, closing: boolean) {
  const { identity, observer, ticket } = options;
  // Original callbacks must never be replaced by a newer page/window's authority.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const owner = useMemo(() => new AdminPresentationWindowOwner(options), [identity, observer, ticket]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.attach(), [owner]);
  useLayoutEffect(() => { if (closing) owner.requestClose(); else owner.checkCurrent(); });
  return { owner, state };
}
