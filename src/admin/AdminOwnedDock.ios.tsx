import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.ios';
import { roleTabIcons } from '../shared/navigation/RoleTabs.ios';
import { useAdminOwnedDock, type AdminOwnedDockProps } from './useAdminOwnedDock';
import { useAdminShellLayout } from './useAdminShellLayout';

/** Pushed Users pages retain source selection/history while the root Home/Activity native tab bar is hidden. */
export function AdminOwnedDock(props: AdminOwnedDockProps) {
  const model = useAdminOwnedDock(props), layout = useAdminShellLayout(true);
  if (layout.dockBottomInset === null) return null;
  return <RoleBottomBar active={model.active} onSelect={model.select} bottomInset={layout.dockBottomInset}
    items={model.destinations.map(item => {
      const icon = item.tab === 'home' ? roleTabIcons.home : item.tab === 'user' ? roleTabIcons.profile
        : item.tab === 'chat' ? roleTabIcons.chat : null;
      return { id: item.id, label: item.label, icon: icon?.default ?? 'clock.arrow.circlepath',
        selectedIcon: icon?.selected, showBadge: item.tab === 'chat' && model.showChatBadge };
    })} />;
}
