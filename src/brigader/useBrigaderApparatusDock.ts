import { router, useNavigation, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Keyboard, Platform } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { adminRootNavigation, type AdminRootNavigationContext } from '../admin/adminRootNavigation';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
export function useBrigaderApparatusDock() {
  const page = useBrigaderFeature(appRoutes.apparatusQueue), navigation = useNavigation();
  const context = useMemo<AdminRootNavigationContext>(() => {
    const paths = () => { const state = navigation.getState(); return state?.routes.slice(0,state.index+1).map(route => route.name === 'index' ? `/${Platform.OS}-brigader` : `/${Platform.OS}-brigader/${route.name}`) ?? []; };
    return { isCurrent:page.interactive,destination:route => page.shell.destination(route,Platform.OS),currentPath:() => paths().at(-1) ?? null,containsPath:path => paths().includes(path),unfocus:() => Keyboard.dismiss(),popTo:path => router.dismissTo(path as Href),push:path => router.push(path as Href) };
  },[page.interactive,page.shell,navigation]);
  const open = (route:string) => { if (page.interactive()) adminRootNavigation.schedule(route,context); };
  const actions:AdminMenuAction[] = [
    { id:'scan',label:productionText('worker.action.scan',page.locale),route:appRoutes.adminProgressQrScan,icon:{ ios:'qrcode.viewfinder' as const,android:'qr_code_scanner' as const } },
    { id:'daily',label:productionText('worker.daily',page.locale),route:appRoutes.apparatusDailyWork,icon:{ ios:'calendar' as const,android:'today' as const } },
    { id:'paddons',label:productionText('worker.paddons',page.locale),route:appRoutes.apparatusPaddons,icon:{ ios:'shippingbox' as const,android:'inventory_2' as const } },
  ].filter(item => !!page.shell.destination(item.route,Platform.OS)).map(item => ({ ...item,onPress:() => open(item.route) }));
  return { page,actions,items:[{ id:'home',label:localizedGetter('homeNavTitle',page.locale),icon:'home' as const,route:appRoutes.apparatusQueue },{ id:'profile',label:localizedGetter('profileTitle',page.locale),icon:'person' as const,route:appRoutes.profile }],open };
}
