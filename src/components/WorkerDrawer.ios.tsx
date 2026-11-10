import { workerPaddonListRoute } from '../workerPaddonNavigation';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { workerDrawerItems, type WorkerDrawerProps } from './workerDrawerModel';
import { router } from 'expo-router';
import { useWorkerPaddonNavigation } from './useWorkerPaddonNavigation';

export function WorkerDrawer({ displayName, canTransfer = false, onSelect, ...props }: WorkerDrawerProps) {
  const paddons = useWorkerPaddonNavigation(props.visible);
  const select = (id: string) => {
    if (id === 'logout') confirmRoleDrawerLogout(() => onSelect(id));
    else if (id.startsWith('paddons:')) router.push(workerPaddonListRoute(id.slice(8)));
    else onSelect(id);
  };
  return <RoleDrawer {...props} title="Bo‘limlar" items={workerDrawerItems(displayName, canTransfer, paddons)} onSelect={select}
    closeAccessibilityLabel="Menyuni yopish"
    footerAction={{ id: 'logout', label: 'Chiqish', symbol: 'rectangle.portrait.and.arrow.right', destructive: true }} />;
}
