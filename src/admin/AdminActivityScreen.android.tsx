import { useBaseTheme } from '../components/useBaseTheme';
import { BaseHost } from '../components/BaseHost.android';
import { Column, IconButton, RNHostView, Text as ComposeText, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminScreenHeader } from './AdminTopBar.android';
import { adminActivityScreenModel, type AdminActivityRow } from './adminActivityScreenModel';
import type { AdminActivityScreenProps } from './adminActivityScreenTypes';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function ActivityRow({ row, first, last }: { row: AdminActivityRow; first: boolean; last: boolean }) {
  const colors = useBaseTheme().colors;
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
export function AdminActivityScreen({ snapshot, hiddenIds, navigation, footer, profileAction, onRefresh, onRequestClear }: AdminActivityScreenProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), colors = useBaseTheme().colors, insets = useSafeAreaInsets();
  const retryWidth = Math.min(360, Math.max(280, useWindowDimensions().width * 0.88));
  const { view, rows } = adminActivityScreenModel(snapshot, hiddenIds, locale);
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <AdminScreenHeader title={localizedGetter('adminActivityTitle', locale)} navigation={navigation} profileAction={profileAction}
      actions={<IconButton onClick={onRequestClear}
        modifiers={[size(48, 48), semantics({ contentDescription: localizedGetter('clearTitle', locale) })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'clear_all' }} size={24} tintColor={colors.onSurface} importantForAccessibility="no" /></RNHostView>
      </IconButton>} />
    <AdminShellBodyFrame hasFooter={footer != null} testID="admin-activity-body-frame">
    {view === 'loading' ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> :
      view === 'error' ? <View style={styles.error}><BaseHost matchContents={{ vertical: true }} style={{ width: retryWidth }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}>
          <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{localizedGetter('serverDisconnectedRetry', locale)}</ComposeText>
          <TextButton onClick={() => { void onRefresh(); }} colors={{ contentColor: colors.primary }}
            contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}>
            <ComposeText style={{ typography: 'bodyMedium', fontWeight: '600' }}>{localizedGetter('retry', locale)}</ComposeText>
          </TextButton>
        </Column>
      </BaseHost></View> :
        view === 'empty' ? <View style={styles.center}><Text style={[styles.empty, { color: colors.onSurface }]}>{localizedGetter('adminNoActivity', locale)}</Text></View> :
          <FlatList data={rows} keyExtractor={(item, index) => `${item.id}:${index}`} style={styles.content}
            contentContainerStyle={{ paddingTop: 4 }}
            refreshControl={<RefreshControl refreshing={snapshot.loadingActivity} onRefresh={() => { void onRefresh(); }} />}
            renderItem={({ item, index }) => <ActivityRow row={item} first={index === 0} last={index === rows.length - 1} />} />}
    </AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, empty: { fontSize: 16, fontWeight: '500', lineHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingStart: 16, paddingEnd: 12 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, description: { flex: 1, gap: 4, marginStart: 14 },
  title: { fontSize: 14.5, lineHeight: 16.675, fontWeight: '600' }, subtitle: { fontSize: 12, lineHeight: 14.4, fontWeight: '500' },
  value: { fontSize: 11.5, fontWeight: '500', flexShrink: 1, maxWidth: 140, marginStart: 16 } });
