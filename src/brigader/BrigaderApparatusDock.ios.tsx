import { useAdminShellLayout } from '../admin/useAdminShellLayout';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.ios';
import { roleTabIcons } from '../shared/navigation/RoleTabs.ios';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { useBrigaderApparatusDock } from './useBrigaderApparatusDock';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
export function BrigaderApparatusDock({ primary = true,actions,active = '',beforeNavigate }: { primary?:boolean;actions?:readonly AdminMenuAction[];active?:string;beforeNavigate?:(navigate:()=>void)=>void }) {
  const model = useBrigaderApparatusDock(), layout = useAdminShellLayout(true);
  if (layout.dockBottomInset === null) return null;
  const onSelect = (id: string) => {
    const item = model.items.find(entry => entry.id === id);
    if (!item || id === active) return;
    if (beforeNavigate) beforeNavigate(() => model.open(item.route));
    else model.open(item.route);
  };
  const items = model.items.map(item => {
    const icon = item.id === 'home' ? roleTabIcons.home : roleTabIcons.profile;
    return { id: item.id, label: item.label, icon: icon.default, selectedIcon: icon.selected };
  });
  return <>
    {primary ? <BrigaderPrimaryAction isCurrent={model.page.current} canInteract={model.page.interactive} actions={actions ?? model.actions} /> : null}
    <RoleBottomBar active={active} items={items} onSelect={onSelect} bottomInset={layout.dockBottomInset} />
  </>;
}

/** Keeps the queue scanner callback and the genuine source create-menu owner. */
export function BrigaderApparatusPrimary({ scan }: { scan: () => void }) {
  const model = useBrigaderApparatusDock();
  return <BrigaderPrimaryAction isCurrent={model.page.current} canInteract={model.page.interactive} actions={model.actions.map(action => action.id === 'scan' ? { ...action, onPress: scan } : action)} />;
}
