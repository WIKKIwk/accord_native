import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import { readSupplyTaskWindow } from '../shared/supplyTasks/supplyTaskApi';
import { useMaterialContext } from './MaterialContext';
import { MaterialTasks } from './MaterialTasks';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;

/** A focused task screen owns one controller and the real guarded window reader. */
export function MaterialTasksRoute() {
  const { session } = useMaterialContext(), drawer = useRoleDrawer();
  const currentLocale = useSyncExternalStore(subscribe, locale, locale);
  const [owner, setOwner] = useState<{ session: typeof session; controller: SupplyTasksController } | null>(null);
  const allowed = session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialTasks);
  useFocusEffect(useCallback(() => {
    if (!allowed) return;
    let focused = true;
    const controller = new SupplyTasksController({ session, kind: 'material', isCurrent: () => focused,
      loadWindow: (query, isCurrent) => readSupplyTaskWindow(session, query, isCurrent) });
    setOwner({ session, controller });
    void controller.activate();
    return () => { focused = false; controller.dispose(); };
  }, [session, allowed]));
  if (!allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', currentLocale)}</Text></View>;
  if (!owner || owner.session !== session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <MaterialTasks controller={owner.controller} session={session} locale={currentLocale}
    onMenu={drawer.open} onProfile={() => router.navigate(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/profile` as Href)} />;
}
