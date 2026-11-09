import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { adminActivityScreenModel, type AdminActivityRow } from './adminActivityScreenModel';
import type { AdminActivityScreenProps } from './adminActivityScreenTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function ActivityRow({ row, first, last }: { row: AdminActivityRow; first: boolean; last: boolean }) {
  const colors = useMaterialColors();
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest}>
    <View style={[styles.row, { backgroundColor: colors.surfaceContainerLowest }]}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceContainerHighest }]}>
        <SymbolView name={row.icon} size={18} tintColor={colors.onSurface} importantForAccessibility="no" />
      </View>
      <View style={styles.description}><Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{row.title}</Text>
        <Text numberOfLines={2} style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{row.subtitle}</Text></View>
      {row.value != null ? <Text numberOfLines={1} style={[styles.value, { color: colors.onSurfaceVariant }]}>{row.value}</Text> : null}
    </View>
  </WorkerQueueCard>;
}
/** Unconnected content; the owning shell supplies scoped state and the real confirmation. */
export function AdminActivityScreen({ snapshot, hiddenIds, navigation, footer, onRefresh, onRequestClear }: AdminActivityScreenProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const { view, rows } = adminActivityScreenModel(snapshot, hiddenIds, locale);
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <View style={styles.header}><View style={styles.headerTitle}><RoleHeader title={localizedGetter('adminActivityTitle', locale)} navigation={navigation ?? undefined} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={localizedGetter('clearTitle', locale)} onPress={onRequestClear} hitSlop={8} style={styles.clear}>
        <SymbolView name={{ android: 'clear_all' }} size={24} tintColor={colors.onSurface} />
      </Pressable></View>
    {view === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> :
      view === 'error' ? <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Text accessibilityRole="button" onPress={() => { void onRefresh(); }} style={[styles.retry, { color: colors.primary }]}>{localizedGetter('retry', locale)}</Text></View> :
        view === 'empty' ? <View style={styles.center}><Text style={{ color: colors.onSurface }}>{localizedGetter('adminNoActivity', locale)}</Text></View> :
          <FlatList data={rows} keyExtractor={(item, index) => `${item.id}:${index}`} style={styles.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 120 }}
            refreshControl={<RefreshControl refreshing={snapshot.loadingActivity} onRefresh={() => { void onRefresh(); }} />}
            renderItem={({ item, index }) => <ActivityRow row={item} first={index === 0} last={index === rows.length - 1} />} />}
    {footer}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 }, clear: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  retry: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600' }, row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingStart: 8, paddingEnd: 4, gap: 14 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, description: { flex: 1, gap: 4 },
  title: { fontSize: 14.5, fontWeight: '600' }, subtitle: { fontSize: 12, fontWeight: '500' }, value: { fontSize: 11.5, fontWeight: '500', flexShrink: 1 } });
