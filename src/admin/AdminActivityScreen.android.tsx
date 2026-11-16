import { Column, Host, IconButton, RNHostView, Text as ComposeText, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest}
    containerStyle={{ paddingHorizontal: 4, paddingTop: first ? 0 : 2, paddingBottom: 0 }}
    style={{ minHeight: 0, paddingHorizontal: 0, paddingVertical: 0,
      borderTopLeftRadius: first ? 18 : 6, borderTopRightRadius: first ? 18 : 6,
      borderBottomLeftRadius: !first && last ? 18 : 6, borderBottomRightRadius: !first && last ? 18 : 6 }}>
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
  const retryWidth = Math.min(360, Math.max(280, useWindowDimensions().width * 0.88));
  const { view, rows } = adminActivityScreenModel(snapshot, hiddenIds, locale);
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <View style={styles.header}><View style={styles.headerTitle}><RoleHeader title={localizedGetter('adminActivityTitle', locale)} navigation={navigation ?? undefined} /></View>
      <Host matchContents style={styles.clear}><IconButton onClick={onRequestClear}
        modifiers={[size(48, 48), semantics({ contentDescription: localizedGetter('clearTitle', locale) })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'clear_all' }} size={24} tintColor={colors.onSurface} importantForAccessibility="no" /></RNHostView>
      </IconButton></Host></View>
    {view === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> :
      view === 'error' ? <View style={styles.error}><Host matchContents={{ vertical: true }} style={{ width: retryWidth }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}>
          <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{localizedGetter('serverDisconnectedRetry', locale)}</ComposeText>
          <TextButton onClick={() => { void onRefresh(); }} colors={{ contentColor: colors.primary }}
            contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}>
            <ComposeText style={{ typography: 'bodyMedium', fontWeight: '600' }}>{localizedGetter('retry', locale)}</ComposeText>
          </TextButton>
        </Column>
      </Host></View> :
        view === 'empty' ? <View style={styles.center}><Text style={{ color: colors.onSurface }}>{localizedGetter('adminNoActivity', locale)}</Text></View> :
          <FlatList data={rows} keyExtractor={(item, index) => `${item.id}:${index}`} style={styles.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 120 }}
            refreshControl={<RefreshControl refreshing={snapshot.loadingActivity} onRefresh={() => { void onRefresh(); }} />}
            renderItem={({ item, index }) => <ActivityRow row={item} first={index === 0} last={index === rows.length - 1} />} />}
    {footer}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 }, clear: { width: 48, height: 48, marginEnd: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingStart: 16, paddingEnd: 12 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, description: { flex: 1, gap: 4, marginStart: 14 },
  title: { fontSize: 14.5, lineHeight: 16.675, fontWeight: '600' }, subtitle: { fontSize: 12, lineHeight: 14.4, fontWeight: '500' },
  value: { fontSize: 11.5, fontWeight: '500', flexShrink: 1, maxWidth: 140, marginStart: 16 } });
