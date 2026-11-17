import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAdminDrawerRegistration, type AdminDrawerPresentation } from '../admin/AdminDrawerPresentationContext';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { useBrigaderFeature } from './BrigaderFeatureContext';

/** @v2 AparatchiNavigationDrawer: Brigader is not an assigned apparatus operator. */
export function useBrigaderApparatusDrawer(route: string) {
  const page = useBrigaderFeature(route), register = useAdminDrawerRegistration();
  const current = page.current;
  const presentation = useMemo<AdminDrawerPresentation>(() => {
    const destinations = [
      { routeName: appRoutes.apparatusQueue, label: localizedGetter('monitoringNavTitle', page.locale), materialIcon: 'view_list_outlined', selectedMaterialIcon: 'view_list_rounded', push: false },
      { routeName: appRoutes.apparatusWorkInstructions, label: productionText('worker.instructions', page.locale), materialIcon: 'menu_book_outlined', selectedMaterialIcon: 'menu_book_rounded', push: false },
      { routeName: appRoutes.inventoryMovements, label: productionText('worker.transfer', page.locale), materialIcon: 'swap_horiz_outlined', selectedMaterialIcon: 'swap_horiz_rounded', push: true },
      { routeName: appRoutes.profile, label: localizedGetter('profileTitle', page.locale), materialIcon: 'person_outline_rounded', selectedMaterialIcon: 'person_rounded', push: false },
    ].filter(item => canOpenRoute(page.shell.session, item.routeName) && !!page.shell.destination(item.routeName, Platform.OS));
    return {
      title: 'Bo‘limlar', active: route, width: 272, destinations,
      items: destinations.map(item => ({ id: item.routeName, label: item.label,
        symbol: item.routeName === appRoutes.apparatusQueue ? { ios: 'list.bullet.rectangle' as const, android: 'view_list' as const }
          : item.routeName === appRoutes.apparatusWorkInstructions ? { ios: 'book' as const, android: 'menu_book' as const }
          : item.routeName === appRoutes.inventoryMovements ? { ios: 'arrow.left.arrow.right' as const, android: 'swap_horiz' as const }
          : { ios: 'person' as const, android: 'person' as const } })),
    };
  }, [page.locale, page.shell, route]);
  useFocusEffect(useCallback(() => {
    if (current()) return register?.(presentation);
  }, [current, presentation, register]));
}
