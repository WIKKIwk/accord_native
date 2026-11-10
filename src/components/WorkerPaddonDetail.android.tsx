import { Column, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { WorkerQueueCard } from './WorkerQueueCard.android';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonCamera } from './WorkerPaddonCamera';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonWipCard } from './WorkerPaddonWip';
import { useWorkerPaddonDetail, type WorkerPaddonDetailProps } from './useWorkerPaddonDetail';

// @v2 AparatchiPaddonDetailScreen
export function WorkerPaddonDetail(props: WorkerPaddonDetailProps) {
  const h = useWorkerPaddonDetail(props), { state, p, header } = h, colors = useMaterialColors();
  const list = useRef<FlatList>(null), scannerTop = useRef(0);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { void h.requestBack(props.onBack); return true; }); return () => sub.remove(); }, [h, props.onBack]);
  if (!h.current()) return null;
  const content = <>{header ? <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 10 }}><Text style={{ typography: 'headlineSmall', fontWeight: 'bold' }}>{header.code}</Text>
      {header.peremotka ? <Text color={colors.error}>{header.peremotka}</Text> : null}{header.location ? <Text>{header.location}</Text> : null}
      <Text color={colors.onSurfaceVariant}>{header.creatorLabel}</Text><Text>{header.creator}</Text><Text>{header.gross}</Text><Text>{header.net}</Text><Text>{header.wip}</Text>
    </Column>
  </Host><View style={{ marginTop: 12, gap: 8 }}><WorkerOrderButton label={p('worker.paddon.print.short')} disabled={!h.canPrint} variant="filled" onPress={() => { void h.print(); }} />
    {header.locked ? <WorkerOrderButton label={header.locked} disabled={!h.canUnlock} onPress={() => { void h.unlock(); }} /> : null}
    {state.scanning ? <WorkerOrderButton label={p('worker.paddon.scan.pending', { count: state.scanned.length })} disabled={!h.canReview} onPress={() => { void h.review(); }} /> : null}
    {header.bobinaTitle ? <><Host matchContents><Text>{header.bobinaTitle}</Text></Host><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{header.bobina.map(group => <View key={group.units} style={{ minWidth: 110 }}>
      <WorkerOrderButton label={`${group.label} · ${group.countText}`} disabled={h.blocked} variant={state.bobina === group.units ? 'filled' : 'outlined'} onPress={() => h.controller.filter(group.units)} />
    </View>)}</View></> : null}{header.note ? <Host matchContents><Text>{header.note}</Text></Host> : null}
  </View></WorkerQueueCard> : null}
    {state.scanning ? <View onLayout={event => { scannerTop.current = event.nativeEvent.layout.y; list.current?.scrollToOffset({ offset: scannerTop.current, animated: true }); }} style={{ marginTop: 12, gap: 10 }}>
      <WorkerPaddonCamera enabled={h.canManage && !state.review} current={h.current} accept={qr => { void h.controller.stage(qr); }} />
      <Host matchContents><Text>{h.feedback}</Text></Host>{state.pending || state.busy ? <ActivityIndicator /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><WorkerOrderButton label={p('worker.paddon.scan.close')} disabled={h.blocked} onPress={() => { void h.cancelScan(); }} /></View>
        <View style={{ flex: 1 }}><WorkerOrderButton label={p('worker.paddon.scan.confirm', { count: state.scanned.length })} disabled={!h.canConfirmScan} variant="filled" onPress={() => { void h.controller.confirmScan(); }} /></View></View>
      {h.scanned.length ? <><Host matchContents><Text>{p('worker.paddon.scan.list.title')}</Text></Host>{h.scanned.map(row => <WorkerQueueCard key={row.batch.batch_id} first last backgroundColor={colors.surfaceContainerLowest}>
        <WorkerPaddonWipCard content={row} /></WorkerQueueCard>)}</> : null}
    </View> : null}
    {h.freeMovementHint ? <Host matchContents style={{ marginTop: 16 }}><Text>{h.freeMovementHint}</Text></Host> : null}
    <Host matchContents style={{ marginVertical: 16 }}><Text style={{ typography: 'titleMedium' }}>{`${h.itemsTitle} · ${h.count}`}</Text></Host>
  </>;
  const reviewData = h.presentation.data?.kind === 'review' ? { ...h.presentation.data, title: p('worker.paddon.scan.pending', { count: state.scanned.length }),
    confirmLabel: p('worker.paddon.scan.confirm', { count: state.scanned.length }), confirmDisabled: !h.canConfirmScan } : h.presentation.data;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <RoleHeader title={props.code} subtitle={p('worker.paddon.detail.subtitle')} navigation={{ icon: 'back', label: h.t('Orqaga'), onPress: () => { void h.requestBack(props.onBack); } }} />
    {state.phase === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : state.phase === 'error' ? <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <Host matchContents><Text>{p('worker.paddon.load_failed')}</Text></Host><WorkerOrderButton label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
    </View> : <FlatList ref={list} data={h.rows} keyExtractor={row => row.batch.batch_id} ListHeaderComponent={content} contentContainerStyle={{ padding: 12, gap: 3, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void h.controller.load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
      ListEmptyComponent={<Host matchContents><Text>{h.itemsEmpty}</Text></Host>}
      renderItem={({ item: row, index }) => {
        const card = <Pressable onPress={row.selectable ? () => h.controller.toggle(row.batch.batch_id) : undefined} onLongPress={() => h.openWip(row.batch)}>
          <WorkerQueueCard first={index === 0} last={index === h.rows.length - 1} backgroundColor={colors.surfaceContainerLowest}><WorkerPaddonWipCard content={row}
            selected={row.selected} selectable={row.selectable} selectionIcon={state.mode === 'remove' ? 'remove' : 'add'} /></WorkerQueueCard>
        </Pressable>;
        return row.removable ? <ReanimatedSwipeable overshootRight={false} renderRightActions={() => <View style={{ width: 125, justifyContent: 'center', padding: 8 }}>
          <WorkerOrderButton label={p('worker.paddon.remove')} onPress={() => { void h.remove(row.batch); }} /></View>}>{card}</ReanimatedSwipeable> : card;
      }} />}
    {header ? <View style={{ padding: 12, gap: 8 }}>{state.scanning ? <>
      <WorkerOrderButton label={p('worker.paddon.scan.confirm', { count: state.scanned.length })} disabled={!h.canConfirmScan} variant="filled" onPress={() => { void h.controller.confirmScan(); }} />
      <WorkerOrderButton label={p('worker.paddon.scan.close')} disabled={h.blocked} onPress={() => { void h.cancelScan(); }} />
    </> : <>
      {!state.selected.length ? <WorkerOrderButton label={p('worker.paddon.add_wip')} disabled={!h.canManage} onPress={() => h.controller.startScan()} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['add', 'remove'] as const).map(mode => <View key={mode} style={{ flex: 1 }}><WorkerOrderButton
        label={`${p(`worker.paddon.${mode}`)}${state.mode === mode && state.selected.length ? ` (${state.selected.length})` : ''}`}
        disabled={!h.canManage || !!state.selected.length && state.mode !== mode} variant={state.mode === mode ? 'filled' : 'outlined'} onPress={() => { void h.edit(mode); }} /></View>)}</View>
      {state.selected.length ? <WorkerOrderButton label={p('worker.action.cancel')} disabled={h.blocked} variant="text" onPress={() => { void h.cancelSelection(); }} /> : null}
    </>}</View> : null}
    <WorkerPaddonDialog data={reviewData} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed}>
      {h.presentation.data?.kind === 'review' ? <ScrollView contentContainerStyle={{ gap: 10 }}>{h.scanned.map(row => <Pressable key={row.batch.batch_id} onPress={() => h.controller.unstage(row.batch.batch_id)}>
        <WorkerPaddonWipCard content={row} selectable selectionIcon="close" /></Pressable>)}</ScrollView> : null}
    </WorkerPaddonDialog>{h.printerDialogs}
  </View>;
}
