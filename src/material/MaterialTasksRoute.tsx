import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { isSessionWitnessCurrent, subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import { readSupplyTaskWindow } from '../shared/supplyTasks/supplyTaskApi';
import { useMaterialContext } from './MaterialContext';
import { MaterialTasks } from './MaterialTasks';
import { isMaterialTestSession } from './materialTestSession';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;

/** A focused task screen owns one controller and the real guarded window reader. */
export function MaterialTasksRoute() {
  const { session, witness } = useMaterialContext(), drawer = useRoleDrawer();
  const currentLocale = useSyncExternalStore(subscribe, locale, locale);
  const [owner, setOwner] = useState<{ session: typeof session; controller: SupplyTasksController } | null>(null);
  const allowed = !isMaterialTestSession(session) && isSessionWitnessCurrent(witness) && session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialTasks);
  useFocusEffect(useCallback(() => {
    if (!allowed) return;
    let focused = true;
    const controller = new SupplyTasksController({ session, kind: 'material', isCurrent: () => focused && !isMaterialTestSession(session) && isSessionWitnessCurrent(witness),
      loadWindow: (query, isCurrent) => readSupplyTaskWindow(session, query, isCurrent) });
    const unsubscribe = subscribeSessionWitness(() => { if (!isSessionWitnessCurrent(witness)) controller.invalidate(); });
    if (!isSessionWitnessCurrent(witness)) { controller.invalidate(); unsubscribe(); return; }
    setOwner({ session, controller });
    void controller.activate();
    return () => { focused = false; unsubscribe(); controller.dispose(); };
  }, [session, witness, allowed]));
  if (!allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', currentLocale)}</Text></View>;
  if (!owner || owner.session !== session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <MaterialTasks controller={owner.controller} session={session} locale={currentLocale}
    onMenu={drawer.open} onProfile={() => router.navigate(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/profile` as Href)} />;
}
