import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import type { DispatchRecord } from '../shared/notificationApi';
import { useCustomerText } from './CustomerContext';
import { CustomerEmptyFeedState, CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { customerLayoutDirection, customerNotificationRecord } from './customerPresentation';
import { useCustomerNotifications } from './useCustomerScreens';

type Props = { onOpenDetail: (id: string) => void; onClearActionChanged?: (action: (() => void) | null) => void };

// @v2 CustomerNotificationsScreen
export function CustomerNotificationsScreen({ onOpenDetail, onClearActionChanged }: Props) {
  const state = useCustomerNotifications(), colors = useMaterialColors(), { locale, text } = useCustomerText(), [confirm, setConfirm] = useState(false);
  const mounted = useRef(false);
  const openClear = useCallback(() => setConfirm(true), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onClearActionChanged?.(openClear); return () => { onClearActionChanged?.(null); }; }, [onClearActionChanged, openClear]);
  const open = async (id: string) => { await state.markSeen(id); if (mounted.current) onOpenDetail(id); };
  const showLoading = !state.loaded && state.records.length === 0 && (state.loading || state.error == null);
  const showRetry = !state.loaded && state.records.length === 0 && !state.loading && state.error != null;
  const direction = customerLayoutDirection(locale) === 'rightToLeft' ? 'rtl' : 'ltr';
  return <>
    {showLoading ? <CustomerLoadingState /> : <FlatList data={state.records} keyExtractor={item => item.id} contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
      ListHeaderComponent={state.records.length ? <View testID="customer-feed-heading" style={{ marginHorizontal: 8, paddingTop: 16, direction,
        backgroundColor: colors.surfaceContainerLow, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: '700', marginHorizontal: 16, marginBottom: 14 }}>{text('shipmentsFlowTitle')}</Text>
      </View> : undefined}
      ListEmptyComponent={<View style={{ flexGrow: 1 }}>{showRetry ? <CustomerRetryState retry={state.refresh} /> : <CustomerEmptyFeedState />}</View>}
      renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
        const row = customerNotificationRecord(item), highlighted = state.highlightedIds.has(item.id);
        const first = index === 0, last = index === state.records.length - 1;
        return <View testID="customer-feed-card" style={{ marginHorizontal: 8, backgroundColor: colors.surfaceContainerLow, direction,
          borderBottomLeftRadius: last ? 28 : 0, borderBottomRightRadius: last ? 28 : 0, overflow: 'hidden' }}>
          <View testID="customer-feed-fill" style={{ backgroundColor: colors.surfaceContainer, overflow: 'hidden',
            borderTopLeftRadius: first ? 24 : 0, borderTopRightRadius: first ? 24 : 0,
            borderBottomLeftRadius: last ? 24 : 0, borderBottomRightRadius: last ? 24 : 0 }}>
            <Pressable accessibilityRole="button" android_ripple={{}} onPress={() => { void open(item.id); }}
              style={{ paddingHorizontal: 16, paddingVertical: 16, backgroundColor: highlighted ? colors.secondaryContainer : 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: highlighted ? colors.secondaryContainer : colors.surfaceContainerHighest }}>
                  <SymbolView name={{ android: row.icon }} size={20} tintColor={highlighted ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                    accessible={false} importantForAccessibility="no-hide-descendants" />
                </View>
                <View style={{ flex: 1, marginStart: 14, marginEnd: 12 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: '500' }}>{row.name}</Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>{row.code}</Text>
                  <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 8 }}>{row.body}</Text>
                </View><Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.created}</Text>
              </View>
            </Pressable>
            {!last ? <View testID="customer-feed-divider" style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.outlineVariant, opacity: 0.55 }} /> : null}
          </View>
        </View>;
      }} />}
    <WorkerAlert alert={confirm ? { title: text('clearTitle'), message: text('clearAllNotificationsPrompt'),
      cancelLabel: text('no'), confirmLabel: text('yes'), onConfirm: () => { void state.clearAll(); } } : null} onDismiss={() => setConfirm(false)} />
  </>;
}
