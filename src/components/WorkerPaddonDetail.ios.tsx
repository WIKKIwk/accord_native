import { Button, HStack, List, ProgressView, RNHostView, Section, SwipeActions, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, id, listStyle, onLongPressGesture, onTapGesture, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack, useNavigation, usePreventRemove } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonCamera } from './WorkerPaddonCamera';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { WorkerPaddonWipCard, WorkerPaddonWipContent } from './WorkerPaddonWip';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPaddonDetail, type WorkerPaddonDetailProps } from './useWorkerPaddonDetail';
import { AccordListScrollReader } from '../../modules/accord-list-scroll/src/AccordListScrollReader';

const cameraRowID = 'accord-paddon-inline-camera';

// @v2 AparatchiPaddonDetailScreen
export function WorkerPaddonDetail(props: WorkerPaddonDetailProps) {
  const h = useWorkerPaddonDetail(props), { state, p, header } = h, colors = useWorkerColors(), navigation = useNavigation();
  usePreventRemove(h.blockBack, ({ data }) => { void h.requestBack(() => navigation.dispatch(data.action)); });
  if (!h.current()) return null;
  const reviewData = h.presentation.data?.kind === 'review' ? { ...h.presentation.data,
    title: p('worker.paddon.scan.pending', { count: state.scanned.length }), confirmLabel: p('worker.paddon.scan.confirm', { count: state.scanned.length }), confirmDisabled: !h.canConfirmScan } : h.presentation.data;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: props.code }} />
    <BaseHost style={{ flex: 1 }}><AccordListScrollReader targetID={state.scanning ? cameraRowID : ''}><List modifiers={[listStyle('insetGrouped'), refreshable(() => h.controller.load())]}>
      <Section><Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.detail.subtitle')}</Text></Section>
      {state.phase === 'loading' ? <ProgressView /> : state.phase === 'error' || !header ? <Section><Text>{p('worker.paddon.load_failed')}</Text>
        <Button label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} /></Section> : <>
        <Section><VStack alignment="leading" spacing={12}>
          <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{header.code}</Text>
            <Button label={p('worker.paddon.print.short')} systemImage="qrcode" onPress={() => { void h.print(); }} modifiers={[buttonStyle('borderedProminent'), disabled(!h.canPrint)]} /></HStack>
          {header.peremotka ? <Text>{header.peremotka}</Text> : null}{header.location ? <Text>{header.location}</Text> : null}
          <VStack alignment="leading" spacing={3}><Text modifiers={[foregroundStyle('secondary'), font({ textStyle: 'caption' })]}>{header.creatorLabel}</Text><Text>{header.creator}</Text></VStack>
          <Text>{header.gross}</Text><Text>{header.net}</Text>
          <HStack spacing={12}>{header.locked ? <Button label={header.locked} systemImage="lock" onPress={() => { void h.unlock(); }} modifiers={[disabled(!h.canUnlock)]} /> : null}<Text>{header.wip}</Text></HStack>
          {state.scanning ? <Button label={p('worker.paddon.scan.pending', { count: state.scanned.length })} onPress={() => { void h.review(); }} modifiers={[disabled(!h.canReview)]} /> : null}
          {header.bobinaTitle ? <VStack alignment="leading" spacing={8}><Text modifiers={[font({ textStyle: 'headline' })]}>{header.bobinaTitle}</Text>
            {header.bobina.map(group => <Button key={group.units} label={`${group.label} · ${group.countText}${state.bobina === group.units ? ' ✓' : ''}`}
              onPress={() => h.controller.filter(group.units)} modifiers={[buttonStyle(state.bobina === group.units ? 'borderedProminent' : 'bordered'), disabled(h.blocked)]} />)}</VStack> : null}
          {header.note ? <Text>{header.note}</Text> : null}
        </VStack></Section>
        {state.scanning ? <>
          <Section><VStack modifiers={[id(cameraRowID)]}><RNHostView matchContents={{ vertical: true }}><WorkerPaddonCamera enabled={h.canManage && !state.review} current={h.current} accept={qr => { void h.controller.stage(qr); }} /></RNHostView></VStack>
            <Text>{h.feedback}</Text>{state.pending || state.busy ? <ProgressView /> : null}
            <Button label={p('worker.paddon.scan.close')} onPress={() => { void h.cancelScan(); }} modifiers={[disabled(h.blocked)]} />
            <Button label={p('worker.paddon.scan.confirm', { count: state.scanned.length })} onPress={() => { void h.controller.confirmScan(); }} modifiers={[disabled(!h.canConfirmScan)]} />
          </Section>
          {h.scanned.length ? <Section title={p('worker.paddon.scan.list.title')}>{h.scanned.map(row => <WorkerPaddonWipContent key={row.batch.batch_id} content={row} />)}</Section> : null}
        </> : null}
        {h.freeMovementHint ? <Section><Text>{h.freeMovementHint}</Text></Section> : null}
        <Section title={`${h.itemsTitle} · ${h.count}`}>{h.rows.length ? h.rows.map(row => <SwipeActions key={row.batch.batch_id}>
          <VStack modifiers={[onTapGesture(() => { if (row.selectable) h.controller.toggle(row.batch.batch_id); }), onLongPressGesture(() => h.openWip(row.batch))]}>
            <WorkerPaddonWipContent content={row} selected={row.selected} selectable={row.selectable} selectionIcon={state.mode === 'remove' ? 'remove' : 'add'} />
          </VStack>
          {row.removable ? <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}><Button label={p('worker.paddon.remove')} systemImage="trash" role="destructive" onPress={() => { void h.remove(row.batch); }} /></SwipeActions.Actions> : null}
        </SwipeActions>) : <Text>{h.itemsEmpty}</Text>}</Section>
      </>}
    </List></AccordListScrollReader></BaseHost>
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
    </WorkerPaddonDialog>
    {h.printerDialogs}<WorkerPaddonFeedback message={h.presentation.notice} />
  </View>;
}
