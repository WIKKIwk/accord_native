import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { usePreparationContext } from './PreparationContext.android';
import { preparationDrawerActive, preparationDrawerItems, preparationDrawerRoute } from './preparationDrawerModel';
import { openPreparationScale } from './preparationNavigation.android';
import { usePreparationText } from './PreparationUI.android';

export function PreparationDrawer({ children }: { children: ReactNode }) {
  const { session, home, onLogout } = usePreparationContext();
  const state = useRoleDrawerState(), pathname = usePathname(), t = usePreparationText();
  const items = preparationDrawerItems({ scale: canOpenRoute(session, appRoutes.gscaleMode),
    inventory: canOpenRoute(session, appRoutes.inventoryMovements) }, t);
  const select = (id: string) => {
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id === 'scale') { openPreparationScale({ warehouse: home.warehouse }); return; }
    const target = preparationDrawerRoute(id, 'android');
    if (!target) return;
    if (target.kind === 'push') router.push(target.path as Href);
    else if (target.kind === 'tab') router.navigate(target.path as Href);
    else if (id !== 'home' && preparationDrawerActive(pathname) === 'home') router.push(target.path as Href);
    else router.replace(target.path as Href);
  };
  return <RoleDrawer {...state} title={t('Tayyorlov bo‘limlari')} items={items} active={preparationDrawerActive(pathname)}
    onSelect={select} closeAccessibilityLabel={t('Menyuni yopish')}
    footerAction={{ id: 'logout', label: t('Chiqish'), destructive: true }}>
    {children}
  </RoleDrawer>;
}
