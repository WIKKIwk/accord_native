import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { adminHomeActions, adminHomeShortcuts, adminHomeShowsActionIcons, adminHomeTitle, adminHomeViewState } from './adminHomeModel';
import { adminHomeSymbol } from './adminHomeSymbols';
import type { AdminHomeScreenProps } from './adminHomeTypes';
import { useAdminHome } from './useAdminHome';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminHomeScreen(props: AdminHomeScreenProps) {
  const { session, navigation, footer } = props, { state, controller } = useAdminHome(props);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), view = adminHomeViewState(session, state);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), [refreshing, setRefreshing] = useState(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => {
    setRefreshing(true);
    try { await controller.reload(); } finally { if (mounted.current) setRefreshing(false); }
  };
  const rows = view === 'actions' ? adminHomeActions(session, locale) : view === 'shortcuts' ? adminHomeShortcuts(session, locale) : [];
  const showIcons = view === 'actions' && adminHomeShowsActionIcons(session);
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <RoleHeader title={adminHomeTitle(session, locale)} navigation={navigation ?? undefined} />
    {view === 'loading' ? <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading" /></View> :
      view === 'error' ? <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Text accessibilityRole="button" onPress={() => { void controller.reload(); }} style={[styles.retry, { color: colors.primary }]}>{localizedGetter('retry', locale)}</Text></View> :
        <ScrollView style={styles.content} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 136 }]}
          alwaysBounceVertical overScrollMode="always" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} />}>
          {rows.map((row, index) => <WorkerQueueCard key={row.routeName} first={index === 0} last={index === rows.length - 1}
            backgroundColor={colors.surfaceContainerLowest} onPress={() => { void controller.openAndReload(row.routeName, props.openRoute); }}>
            {showIcons && 'materialIcon' in row && typeof row.materialIcon === 'string' ? <SymbolView name={adminHomeSymbol(row.materialIcon)} size={23}
              tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /> : null}
            <Text numberOfLines={2} style={[styles.rowText, { color: colors.onSurface, fontSize: view === 'shortcuts' ? 18.5 : 16, fontWeight: view === 'shortcuts' ? '700' : '500' }]}>{row.title}</Text>
            <SymbolView name={{ android: 'chevron_right' }} size={22} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" />
          </WorkerQueueCard>)}
        </ScrollView>}
    {footer}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, list: { flexGrow: 1, paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  retry: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600' }, rowText: { flex: 1, fontSize: 16, marginHorizontal: 14 } });
