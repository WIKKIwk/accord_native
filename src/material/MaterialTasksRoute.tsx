import { router, type Href } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { isSessionWitnessCurrent, subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { subscribeMaterialTaskLive } from './materialTaskLive';
import { materialTasksWarmStore } from './materialTasksRuntime';
import { useMaterialContext } from './MaterialContext';
import { MaterialTasks } from './MaterialTasks';
import { isMaterialTestSession } from './materialTestSession';
import { useMaterialTaskDetail } from './useMaterialTaskDetail';
import { useMaterialTaskReceipt } from './useMaterialTaskReceipt';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { PreparationNotice } from '../preparation/PreparationNotice';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
const emptySubscribe = () => () => {};

/** A mounted task screen owns one controller across its native detail/receipt surfaces. */
export function MaterialTasksRoute() {
  const { session, witness } = useMaterialContext(), drawer = useRoleDrawer();
  const currentLocale = useSyncExternalStore(subscribe, locale, locale);
  const [owner, setOwner] = useState<{ session: typeof session; controller: SupplyTasksController } | null>(null);
  const window = useSyncExternalStore(owner?.controller.subscribe ?? emptySubscribe,
    () => owner?.controller.getSnapshot().window ?? null, () => null);
  const openDetail = useMaterialTaskDetail(session, witness, appRoutes.materialTasks, window?.apparatus ?? []);
  const notice = usePreparationNotice(), receive = useMaterialTaskReceipt(notice.show);
  const allowed = !isMaterialTestSession(session) && isSessionWitnessCurrent(witness) && session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialTasks);
  useEffect(() => {
    if (!allowed) return;
    let focused = true;
    const current = () => focused && !isMaterialTestSession(session) && isSessionWitnessCurrent(witness), warm = materialTasksWarmStore(session);
    const controller = new SupplyTasksController({ session, kind: 'material', isCurrent: current,
      loadSelection: () => adminSequenceApparatusStore.loadSavedApparatusId(),
      saveSelection: (id, window) => { const apparatus = window.apparatus.find(row => row.id === id); if (apparatus) void adminSequenceApparatusStore.saveApparatus(apparatus); },
      loadWindow: (query, isCurrent, fresh) => warm.read(query, isCurrent, fresh), remember: window => warm.remember(window), withdraw: () => warm.invalidate(),
      events: (baseline, handlers) => subscribeMaterialTaskLive(session, baseline, current, handlers) });
    const unsubscribe = subscribeSessionWitness(() => { if (!isSessionWitnessCurrent(witness)) controller.invalidate(); });
    if (!isSessionWitnessCurrent(witness)) { controller.invalidate(); unsubscribe(); return; }
    void Promise.resolve().then(() => { if (current()) setOwner({ session, controller }); });
    const lifecycle = AppState.addEventListener('change', state => controller.setForeground(state === 'active'));
    controller.setForeground(AppState.currentState === 'active');
    void controller.activate();
    return () => { focused = false; lifecycle.remove(); unsubscribe(); controller.dispose(); };
  }, [session, witness, allowed]);
  if (!allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', currentLocale)}</Text></View>;
  if (!owner || owner.session !== session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <><MaterialTasks controller={owner.controller} session={session} locale={currentLocale} handlers={{ openDetail, receive }}
    onMenu={drawer.open} onProfile={() => router.navigate(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/profile` as Href)} />
    <PreparationNotice message={notice.message} /></>;
}
