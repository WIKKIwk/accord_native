import { useWorkerOrderText } from './useWorkerOrderText';
import { workerPaddonListRoute } from '../workerPaddonNavigation';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { workerDrawerItems, type WorkerDrawerProps } from './workerDrawerModel';
import { router } from 'expo-router';
import { useWorkerPaddonNavigation } from './useWorkerPaddonNavigation';

export function WorkerDrawer({ displayName, canTransfer = false, showDailyWork = true, onSelect, paddons: suppliedPaddons, ...props }: WorkerDrawerProps) {
  const { t } = useWorkerOrderText();
  const fallbackPaddons = useWorkerPaddonNavigation(props.visible && suppliedPaddons === undefined);
  const paddons = suppliedPaddons ?? fallbackPaddons;
  const select = (id: string) => {
    if (id === 'logout') confirmRoleDrawerLogout(() => onSelect(id));
    else if (id.startsWith('paddons:')) router.push(workerPaddonListRoute(id.slice(8)));
    else onSelect(id);
  };
  return <RoleDrawer {...props} title={t('Bo‘limlar')} items={workerDrawerItems(displayName, canTransfer, paddons, t, showDailyWork)} onSelect={select}
    closeAccessibilityLabel={t('Menyuni yopish')}
    footerAction={{ id: 'logout', label: t('Chiqish'), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }} />;
}
