import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useRawSplitContext } from './RawSplitContext';
import { rawSplitDrawerItems } from './rawSplitNavigationModel';

export function RawSplitDrawer({ children }: { children: ReactNode }) {
  const state = useRoleDrawerState(), pathname = usePathname(), t = usePreparationText(), { onLogout } = useRawSplitContext();
  const root = Platform.OS === 'ios' ? '/ios-homashyo' : '/android-homashyo';
  const active = pathname.endsWith('/history') ? 'history' : pathname.endsWith('/profile') ? 'profile' : 'home';
  const select = (id: string) => {
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id === 'history') router.push(`${root}/history` as Href);
    else if (id === 'profile') router.navigate(`${root}/profile` as Href);
    else if (id === 'home') router.dismissTo(root as Href);
  };
  return <RoleDrawer {...state} title={t('Rezka')} items={rawSplitDrawerItems(t)} active={active} onSelect={select}
    closeAccessibilityLabel={t('Menyuni yopish')} footerAction={{ id: 'logout', label: t('Chiqish'), destructive: true,
      symbol: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' } }}>{children}</RoleDrawer>;
}
