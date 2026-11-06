import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { usePreparationContext } from './PreparationContext';
import { preparationDrawerActive, preparationDrawerItems, preparationDrawerRoute } from './preparationDrawerModel';
import { openPreparationScale } from './PreparationRoutes';
import { usePreparationText } from './PreparationUI';

export function PreparationDrawer({ children }: { children: ReactNode }) {
  const { session, home, onLogout } = usePreparationContext();
  const state = useRoleDrawerState(), pathname = usePathname(), t = usePreparationText();
  const items = preparationDrawerItems({ scale: canOpenRoute(session, appRoutes.gscaleMode),
    inventory: canOpenRoute(session, appRoutes.inventoryMovements) }, t);
  const select = (id: string) => {
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id === 'scale') { openPreparationScale({ warehouse: home.warehouse }); return; }
    const target = preparationDrawerRoute(id, 'ios');
    if (!target) return;
    if (target.kind === 'push') router.push(target.path as Href);
    else if (target.kind === 'tab') router.navigate(target.path as Href);
    else router.dismissTo(target.path as Href);
  };
  return <RoleDrawer {...state} title={t('Tayyorlov bo‘limlari')} items={items} active={preparationDrawerActive(pathname)}
    swipeEnabled={state.visible || pathname !== '/ios-preparation/sequence'}
    onSelect={select} closeAccessibilityLabel={t('Menyuni yopish')}
    footerAction={{ id: 'logout', label: t('Chiqish'), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }}>
    {children}
  </RoleDrawer>;
}
