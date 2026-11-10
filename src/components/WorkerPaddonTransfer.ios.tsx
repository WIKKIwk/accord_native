import { useRef, type ComponentRef } from 'react';
import { Button, Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack, usePreventRemove } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BaseHost } from './BaseHost';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { WorkerPaddonWipCard } from './WorkerPaddonWip';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPaddonDrag, WorkerPaddonDraggable } from './useWorkerPaddonDrag';
import { useWorkerPaddonTransfer, type WorkerPaddonTransferProps } from './useWorkerPaddonTransfer';

// @v2 AparatchiPaddonTransferScreen
export function WorkerPaddonTransfer(props: WorkerPaddonTransferProps) {
  const h = useWorkerPaddonTransfer(props), { state, p } = h, colors = useWorkerColors(), root = useRef<ComponentRef<typeof View>>(null), drag = useWorkerPaddonDrag(h, root);
  usePreventRemove(state.busy || h.confirmationOpen, () => {});
  if (!h.current()) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><View ref={root} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: h.title, headerRight: state.phase === 'ready' ? () => <BaseHost matchContents><Button systemImage="arrow.clockwise" label={p('worker.paddon.transfer.refresh')}
      onPress={() => { void h.controller.load(); }} modifiers={[disabled(h.blocked)]} /></BaseHost> : undefined }} />
    {state.phase === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : state.phase === 'error' ? <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <BaseHost matchContents><Text>{h.loadFailed}</Text></BaseHost><WorkerOrderButton label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
    </View> : <>
      <BaseHost matchContents={{ vertical: true }} style={{ width: '100%', padding: 12 }}><Text>{p('worker.paddon.transfer.hint')}</Text></BaseHost>
      {state.selected.length ? <View style={{ padding: 12 }}><WorkerOrderButton label={p('worker.paddon.transfer.move', { count: state.selected.length })} variant="filled" disabled={!h.canMove} onPress={() => { void h.move(); }} /></View> : null}
      {h.sides.map(side => <View key={side.side} style={{ flex: 1, padding: 10, gap: 8 }}>
        <WorkerOrderButton label={side.title} disabled={h.blocked} onPress={() => { void h.pick(side.side); }} />
        <View ref={view => drag.zone(side.code, view)} collapsable={false} style={{ flex: 1, borderRadius: 20, backgroundColor: colors.surface }}>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={false} enabled={!h.blocked} onRefresh={() => { void h.controller.load(); }} />}>
            {side.rows.length ? side.rows.map(row => <WorkerPaddonDraggable key={row.batch.batch_id} drag={drag} source={side.code} batch={row.batch} enabled={row.selectable}
              onPress={() => h.controller.toggle(side.code, row.batch.batch_id)}><WorkerPaddonWipCard content={row} selected={row.selected} selectable={row.selectable} /></WorkerPaddonDraggable>)
              : <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{side.empty}</Text></BaseHost>}
          </ScrollView>
        </View>
      </View>)}
    </>}
    {state.busy ? <ActivityIndicator style={{ position: 'absolute', top: 12, alignSelf: 'center' }} /> : null}
    {drag.drag ? <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(12, drag.drag.point.x - drag.origin.x - 80), top: drag.drag.point.y - drag.origin.y - 30, padding: 14, borderRadius: 20, backgroundColor: colors.background }}>
      <BaseHost matchContents><Text>{p('worker.paddon.transfer.move', { count: drag.drag.ids.length })}</Text></BaseHost></View> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
    <WorkerPaddonFeedback message={h.presentation.notice} />
  </View></GestureHandlerRootView>;
}
