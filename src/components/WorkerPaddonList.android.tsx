import { Column, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { WorkerQueueCard } from './WorkerQueueCard.android';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { useWorkerPaddonList, type WorkerPaddonListProps } from './useWorkerPaddonList';

// @v2 AparatchiPaddonsScreen
export function WorkerPaddonList(props: WorkerPaddonListProps) {
  const { onBack } = props;
  const h = useWorkerPaddonList(props), { state, p } = h, colors = useMaterialColors();
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!h.presentation.isOpen()) onBack(); return true; }); return () => sub.remove(); }, [onBack, h.presentation]);
  if (!h.current()) return null;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <RoleHeader title={h.title} subtitle={p('worker.paddon.subtitle')} navigation={{ icon: 'back', label: h.t('Orqaga'), onPress: props.onBack }} />
    {state.phase === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : state.phase === 'error' ? <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <Host matchContents><Text>{p('worker.paddon.load_failed')}</Text></Host><WorkerOrderButton label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
    </View> : <FlatList data={state.rows} keyExtractor={row => row.code} contentContainerStyle={{ padding: 12, gap: 3, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void h.controller.load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={!state.apparatus ? <View style={{ gap: 8 }}>{state.options.map(option => <WorkerOrderButton key={option.id}
        label={p('worker.paddon.apparatus', { apparatus: option.name })} onPress={() => { void h.controller.select(option.id); }} />)}</View>
        : <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 10 }}>
          <Text style={{ typography: 'titleMedium' }}>{p('worker.paddon.location.title')}</Text><Text color={colors.onSurfaceVariant}>{p('worker.paddon.location.subtitle')}</Text>
          <Text>{`${p('worker.paddons')}: ${state.rows.length}   ${p('worker.daily.wip')}: ${state.rows.reduce((sum, row) => sum + row.item_count, 0)}`}</Text>
        </Column></Host></WorkerQueueCard>}
      ListEmptyComponent={state.apparatus ? <Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 24 }}><Column verticalArrangement={{ spacedBy: 8 }}>
        <Text style={{ typography: 'titleMedium' }}>{p('worker.paddon.empty.title')}</Text><Text>{p('worker.paddon.empty.body')}</Text></Column></Host> : undefined}
      renderItem={({ item: row, index }) => <Pressable disabled={!h.enabled} onPress={() => h.open(row)} onLongPress={h.canDelete ? () => { void h.remove(row); } : undefined}>
        <WorkerQueueCard first={index === 0} last={index === state.rows.length - 1} backgroundColor={colors.surfaceContainerLowest}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 4 }}>
            <Text style={{ typography: 'titleMedium' }}>{row.code}</Text>
            {row.contains_peremotka ? <Text color={colors.error}>{p('worker.rezka.print.peremotka')}</Text> : null}
            <Text color={colors.onSurfaceVariant}>{p('worker.paddon.wip_count', { count: row.item_count })}</Text>
          </Column></Host>
        </WorkerQueueCard>
      </Pressable>} />}
    {state.apparatus ? <View style={{ padding: 12, gap: 8 }}>
      {h.canTransfer ? <WorkerOrderButton label={p('worker.paddon.transfer.title')} onPress={h.transfer} /> : null}
      <WorkerOrderButton label={p('worker.paddon.create')} disabled={!h.canCreate} variant="filled" onPress={() => { void h.create(); }} />
    </View> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
  </View>;
}
