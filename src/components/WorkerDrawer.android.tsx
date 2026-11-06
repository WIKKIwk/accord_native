import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { workerDrawerItems, type WorkerDrawerProps } from './workerDrawerModel';

export function WorkerDrawer({ displayName, canTransfer = false, onSelect, ...props }: WorkerDrawerProps) {
  const select = (id: string) => {
    if (id === 'logout') confirmRoleDrawerLogout(() => onSelect(id));
    else onSelect(id);
  };
  return <RoleDrawer {...props} title="Bo‘limlar" items={workerDrawerItems(displayName, canTransfer)} onSelect={select}
    closeAccessibilityLabel="Menyuni yopish"
    footerAction={{ id: 'logout', label: 'Chiqish', symbol: 'rectangle.portrait.and.arrow.right', destructive: true }} />;
}
