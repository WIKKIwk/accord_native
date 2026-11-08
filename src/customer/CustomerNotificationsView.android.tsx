import { Button, Host } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { DispatchRecord } from '../shared/notificationApi';
import { useCustomerText } from './CustomerContext';
import { customerNotificationRecord } from './customerPresentation';
import { useCustomerNotifications } from './useCustomerScreens';

type Props = { onOpenDetail: (id: string) => void; onClearActionChanged?: (action: (() => void) | null) => void };

// @v2 CustomerNotificationsScreen
export function CustomerNotificationsScreen({ onOpenDetail, onClearActionChanged }: Props) {
  const state = useCustomerNotifications(), colors = useMaterialColors(), { text } = useCustomerText(), [confirm, setConfirm] = useState(false);
  const mounted = useRef(false);
  const openClear = useCallback(() => setConfirm(true), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onClearActionChanged?.(openClear); return () => { onClearActionChanged?.(null); }; }, [onClearActionChanged, openClear]);
  const open = async (id: string) => { await state.markSeen(id); if (mounted.current) onOpenDetail(id); };
  const showLoading = !state.loaded && state.records.length === 0 && (state.loading || !state.error);
  const showRetry = !state.loaded && state.records.length === 0 && !state.loading && !!state.error;
  return <>
    <FlatList data={state.records} keyExtractor={item => item.id} contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
      ListHeaderComponent={state.records.length ? <Text style={{ color: colors.onSurface, fontSize: 20, marginHorizontal: 24, marginVertical: 12 }}>{text('shipmentsFlowTitle')}</Text> : undefined}
      ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {showLoading ? <ActivityIndicator /> : showRetry ? <><Text style={{ color: colors.onSurfaceVariant }}>{text('serverDisconnectedRetry')}</Text>
          <Host matchContents><Button label={text('retry')} onPress={() => { void state.refresh(); }} /></Host></>
          : <Text style={{ color: colors.onSurface }}>{text('noRecordsYet')}</Text>}
      </View>}
      renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
        const row = customerNotificationRecord(item), highlighted = state.highlightedIds.has(item.id);
        return <WorkerQueueCard backgroundColor={highlighted ? colors.secondaryContainer : colors.surfaceContainerLow}
          first={index === 0} last={index === state.records.length - 1} onPress={() => { void open(item.id); }}>
          <SymbolView name={{ android: row.icon }} size={20} tintColor={highlighted ? colors.onSecondaryContainer : colors.onSurfaceVariant} />
          <View style={{ flex: 1, gap: 4, marginHorizontal: 12 }}>
            <Text style={{ color: colors.onSurface, fontSize: 16 }}>{row.name}</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.code}</Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.body}</Text>
          </View><Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.created}</Text>
        </WorkerQueueCard>;
      }} />
    <WorkerAlert alert={confirm ? { title: text('clearTitle'), message: text('clearAllNotificationsPrompt'),
      cancelLabel: text('no'), confirmLabel: text('yes'), onConfirm: () => { void state.clearAll(); } } : null} onDismiss={() => setConfirm(false)} />
  </>;
}
