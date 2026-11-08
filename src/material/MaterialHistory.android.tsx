import { Column, Host, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerSessionResetHook, sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { OrdersList } from '../shared/orders/OrdersList';
import type { AdminApparatus } from '../apparatusApi';
import type { AdminRawMaterialEvent } from './materialHistoryApi';
import { materialHistoryDetails, materialHistorySubtitle, materialHistoryTime, materialHistoryTitle } from './materialHistoryPresentation';
import { materialHistorySymbol } from './materialHistorySymbols';
import { useMaterialContext } from './MaterialContext';
import { useMaterialHistory } from './useMaterialHistory';
import { materialHistoryCurrent } from './materialHistoryAccess';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

// @v2 _MaterialHistoryDetailsSheet
function MaterialHistoryDetails({ event, catalog, session, witness }: { event: AdminRawMaterialEvent; catalog: AdminApparatus[]; session: Session; witness: SessionWitness }) {
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const details = materialHistoryDetails(event, catalog), colors = useMaterialColors();
  if (!materialHistoryCurrent(session, witness)) return null;
  return <View style={{ minHeight: 300, padding: 20 }}><Host matchContents={{ vertical: true }}>
    <Column verticalArrangement={{ spacedBy: 8 }}><ComposeText color={colors.onSurface} style={{ typography: 'titleLarge' }}>
      {materialHistoryTitle(event)}</ComposeText><ComposeText color={colors.onSurfaceVariant}>{materialHistorySubtitle(event, catalog)}</ComposeText>
      {details.map((detail, index) => <Column key={`${detail.label}:${index}`}>
        <ComposeText color={colors.onSurfaceVariant}>{detail.label}</ComposeText><ComposeText color={colors.onSurface}>{detail.value}</ComposeText>
      </Column>)}
    </Column></Host></View>;
}

// @v2 MaterialTaminotchiHistoryScreen
export function MaterialHistory() {
  const { session, witness } = useMaterialContext(), history = useMaterialHistory(session, witness), sheet = useNativeSheet();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => {
    const check = () => { if (!materialHistoryCurrent(session, witness)) sheet.close(); };
    const unsubscribe = subscribeSessionWitness(check), unregister = registerSessionResetHook(async () => { sheet.close(); });
    check(); return () => { unregister(); unsubscribe(); sheet.close(); };
  }, [session, witness, sheet]);
  if (!history.allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', localeController.locale)}</Text></View>;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title="Harakatlar tarixi" navigation={{ icon: 'back', label: 'Orqaga', onPress: () => {
      if (router.canGoBack()) router.back(); else router.navigate('/android-material' as Href);
    } }} />
    <OrdersList onRefresh={history.refresh} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      {history.loading ? <ActivityIndicator /> : history.error ? <WorkerQueueCard backgroundColor={colors.surface} first last onPress={history.reload}>
        <View style={{ padding: 12 }}><Text style={{ color: colors.onSurface }}>Tarix yuklanmadi</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{history.error}</Text></View>
      </WorkerQueueCard> : !history.events.length ? <WorkerQueueCard backgroundColor={colors.surface} first last>
        <Text style={{ color: colors.onSurface, padding: 12 }}>Harakatlar hali yo‘q</Text></WorkerQueueCard> :
        history.events.slice(0, 100).map((event, index, events) => <WorkerQueueCard key={`${event.event_id}:${index}`}
          backgroundColor={colors.surface} first={index === 0} last={index === events.length - 1}
          onPress={() => { if (materialHistoryCurrent(session, witness)) sheet.open(<MaterialHistoryDetails event={event} catalog={history.apparatus} session={session} witness={witness} />, { dismissible: true, compact: true, fitContent: true }); }}>
          <SymbolView name={materialHistorySymbol(event.event_type)} size={22} tintColor={colors.primary} />
          <View style={{ flex: 1, padding: 8 }}><Text style={{ color: colors.onSurface, fontWeight: '700' }} numberOfLines={1}>{materialHistoryTitle(event)}</Text>
            <Text style={{ color: colors.onSurfaceVariant }} numberOfLines={2}>{materialHistorySubtitle(event, history.apparatus)}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={{ color: colors.onSurfaceVariant }}>{materialHistoryTime(event.occurred_at_unix)}</Text>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={20} tintColor={colors.onSurfaceVariant} /></View>
        </WorkerQueueCard>)}
    </OrdersList>
  </View>;
}
