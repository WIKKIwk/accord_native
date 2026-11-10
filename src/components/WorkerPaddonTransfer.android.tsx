import { useRef, type ComponentRef } from 'react';
import { Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { WorkerQueueCard } from './WorkerQueueCard.android';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonWipCard } from './WorkerPaddonWip';
import { useWorkerPaddonDrag, WorkerPaddonDraggable } from './useWorkerPaddonDrag';
import { useWorkerPaddonTransfer, type WorkerPaddonTransferProps } from './useWorkerPaddonTransfer';

// @v2 AparatchiPaddonTransferScreen
export function WorkerPaddonTransfer(props: WorkerPaddonTransferProps) {
  const { onBack } = props;
  const h = useWorkerPaddonTransfer(props), { state, p } = h, colors = useMaterialColors(), root = useRef<ComponentRef<typeof View>>(null), drag = useWorkerPaddonDrag(h, root);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!h.blocked && !h.presentation.isOpen()) onBack(); return true; }); return () => sub.remove(); }, [h, onBack]);
  if (!h.current()) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><View ref={root} style={{ flex: 1, backgroundColor: colors.background }}>
    <RoleHeader title={h.title} navigation={{ icon: 'back', label: h.t('Orqaga'), onPress: () => { if (!h.blocked && !h.presentation.isOpen()) onBack(); } }} />
    {state.phase === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : state.phase === 'error' ? <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <Host matchContents><Text>{h.loadFailed}</Text></Host><WorkerOrderButton label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
    </View> : <>
      <View style={{ paddingHorizontal: 12, gap: 8 }}><Host matchContents><Text>{p('worker.paddon.transfer.hint')}</Text></Host><WorkerOrderButton label={p('worker.paddon.transfer.refresh')} disabled={h.blocked} variant="text" onPress={() => { void h.controller.load(); }} /></View>
      {state.selected.length ? <View style={{ padding: 12 }}><WorkerOrderButton label={p('worker.paddon.transfer.move', { count: state.selected.length })} variant="filled" disabled={!h.canMove} onPress={() => { void h.move(); }} /></View> : null}
      {h.sides.map(side => <View key={side.side} style={{ flex: 1, padding: 10, gap: 8 }}>
        <WorkerOrderButton label={side.title} disabled={h.blocked} onPress={() => { void h.pick(side.side); }} />
        <View ref={view => drag.zone(side.code, view)} collapsable={false} style={{ flex: 1, borderRadius: 20, backgroundColor: colors.surfaceContainerLow }}>
          <ScrollView contentContainerStyle={{ padding: 10, gap: 3, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={false} enabled={!h.blocked} onRefresh={() => { void h.controller.load(); }} colors={[colors.primary]} />}>
            {side.rows.length ? side.rows.map((row, index) => <WorkerPaddonDraggable key={row.batch.batch_id} drag={drag} source={side.code} batch={row.batch} enabled={row.selectable}
              onPress={() => h.controller.toggle(side.code, row.batch.batch_id)}><WorkerQueueCard first={index === 0} last={index === side.rows.length - 1} backgroundColor={colors.surfaceContainerLowest}>
                <WorkerPaddonWipCard content={row} selected={row.selected} selectable={row.selectable} /></WorkerQueueCard></WorkerPaddonDraggable>)
              : <Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 16 }}><Text>{side.empty}</Text></Host>}
          </ScrollView>
        </View>
      </View>)}
    </>}
    {state.busy ? <ActivityIndicator style={{ position: 'absolute', top: 12, alignSelf: 'center' }} /> : null}
    {drag.drag ? <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(12, drag.drag.point.x - drag.origin.x - 80), top: drag.drag.point.y - drag.origin.y - 30, padding: 14, borderRadius: 20, backgroundColor: colors.primaryContainer }}>
      <Host matchContents><Text color={colors.onPrimaryContainer}>{p('worker.paddon.transfer.move', { count: drag.drag.ids.length })}</Text></Host></View> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
  </View></GestureHandlerRootView>;
}
