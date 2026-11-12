import { Column, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';
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
  const list = useRef<FlatList>(null), scannerTop = useRef(0), requestBack = useRef(h.requestBack);
  useLayoutEffect(() => { requestBack.current = h.requestBack; }, [h.requestBack]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { void requestBack.current(props.onBack); return true; }); return () => sub.remove(); }, [props.onBack]);
  if (!h.current()) return null;
  const actions: RoleFabAction[] = state.scanning ? [
    { id: 'confirm', label: p('worker.paddon.scan.confirm', { count: state.scanned.length }), icon: 'check', width: 300, disabled: !h.canConfirmScan || state.review },
    { id: 'close', label: p('worker.paddon.scan.close'), icon: 'close', width: 210, disabled: h.blocked || state.review },
  ] : [
    ...(!state.selected.length ? [{ id: 'scan', label: p('worker.paddon.add_wip'), icon: 'qr_code_scanner' as const, width: 330, disabled: !h.canManage }] : []),
    ...(['add', 'remove'] as const).map(mode => ({ id: mode,
      label: `${p(`worker.paddon.${mode}`)}${state.mode === mode && state.selected.length ? ` (${state.selected.length})` : ''}`,
      icon: mode === 'add' ? 'playlist_add' as const : 'playlist_remove' as const, width: 220,
      disabled: !h.canManage || !!state.selected.length && state.mode !== mode })),
    ...(state.selected.length ? [{ id: 'cancel', label: p('worker.action.cancel'), icon: 'close' as const, width: 200, disabled: !h.canManage }] : []),
  ];
  const content = <>{header ? <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><View style={{ width: '100%', paddingVertical: 6, gap: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Host matchContents={{ vertical: true }} style={{ flexGrow: 1, flexShrink: 1, minWidth: 100 }}>
        <Column verticalArrangement={{ spacedBy: 4 }}><Text style={{ typography: 'headlineSmall', fontWeight: 'bold' }}>{header.code}</Text>
          {header.peremotka ? <Text color={colors.error}>{header.peremotka}</Text> : null}{header.location ? <Text>{header.location}</Text> : null}
        </Column>
      </Host>
      <View style={{ flexBasis: 150, flexShrink: 1, maxWidth: '100%' }}><WorkerOrderButton label={p('worker.paddon.print.short')}
        icon={{ android: 'qr_code_2' }} disabled={!h.canPrint} variant="filled" onPress={() => { void h.print(); }} /></View>
    </View>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 8 }}>
      <Text color={colors.onSurfaceVariant}>{header.creatorLabel}</Text><Text>{header.creator}</Text>
      <Text>{header.gross}</Text><Text>{header.net}</Text><Text>{header.wip}</Text>
    </Column></Host>
    {header.locked ? <WorkerOrderButton label={header.locked} disabled={!h.canUnlock} onPress={() => { void h.unlock(); }} /> : null}
    {state.scanning ? <WorkerOrderButton label={p('worker.paddon.scan.pending', { count: state.scanned.length })} disabled={!h.canReview} onPress={() => { void h.review(); }} /> : null}
    {header.bobinaTitle ? <><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{header.bobinaTitle}</Text></Host>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{header.bobina.map(group => <View key={group.units} style={{ flexBasis: '45%', flexGrow: 1, minWidth: 110, maxWidth: '100%' }}>
        <WorkerOrderButton label={`${group.label} · ${group.countText}`} disabled={h.blocked} variant={state.bobina === group.units ? 'filled' : 'outlined'} onPress={() => h.controller.filter(group.units)} />
      </View>)}</View></> : null}{header.note ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{header.note}</Text></Host> : null}
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
    </View> : <FlatList ref={list} data={h.rows} keyExtractor={row => row.batch.batch_id} ListHeaderComponent={content} contentContainerStyle={{ padding: 12, gap: 3, paddingBottom: 112 }}
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
    {header ? <RoleFab actions={actions} bottomOffset={16} testIDPrefix="worker-paddon-detail-fab"
      openLabel={h.t('Amallarni ochish')} closeLabel={h.t('Amallarni yopish')} resetKey={`${state.scanning}:${state.mode ?? ''}`}
      onSelect={id => {
        const action = actions.find(item => item.id === id);
        if (!action || action.disabled || !h.current() || h.presentation.isOpen()) return;
        if (id === 'scan') h.controller.startScan();
        else if (id === 'add' || id === 'remove') void h.edit(id);
        else if (id === 'cancel') void h.cancelSelection();
        else if (id === 'confirm') void h.controller.confirmScan();
        else if (id === 'close') void h.cancelScan();
      }} /> : null}
    <WorkerPaddonDialog data={reviewData} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed}>
      {h.presentation.data?.kind === 'review' ? <ScrollView contentContainerStyle={{ gap: 10 }}>{h.scanned.map(row => <Pressable key={row.batch.batch_id} onPress={() => h.controller.unstage(row.batch.batch_id)}>
        <WorkerPaddonWipCard content={row} selectable selectionIcon="close" /></Pressable>)}</ScrollView> : null}
    </WorkerPaddonDialog>{h.printerDialogs}
  </View>;
}
