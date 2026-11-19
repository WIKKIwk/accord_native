import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { adminAndroidDockItems } from './adminDockModel';
import { useAdminOwnedDock, type AdminOwnedDockProps } from './useAdminOwnedDock';
import { useAdminShellLayout } from './useAdminShellLayout';

/** Source dock destinations; the owning route separately supplies its genuine CreateHub primary action. */
export function AdminOwnedDock(props: AdminOwnedDockProps) {
  const model = useAdminOwnedDock(props), layout = useAdminShellLayout(true);
  if (layout.dockBottomInset === null) return null;
  return <RoleBottomBar compact items={adminAndroidDockItems(model.destinations, model.showChatBadge)}
    active={model.active} onSelect={model.select} bottomInset={layout.dockBottomInset} />;
}
