import type { AdminUsersScreenProps } from './AdminUsersScreenTypes';
import { AdminUsersRoute } from './AdminUsersRoute.android';
import { useAdminUsersOwnedOpen } from './useAdminUsersOwnedOpen';

/** AppRouter returns the real Users widget when Customer/Supplier arguments have an empty trimmed ref. */
export function AdminOwnedUsersFallback(props: Omit<AdminUsersScreenProps, 'onOpenUser'> & { isCurrent: () => boolean; canInteract: () => boolean }) {
  const onOpenUser = useAdminUsersOwnedOpen(props.isCurrent, props.canInteract);
  return <AdminUsersRoute {...props} onOpenUser={onOpenUser} />;
}
