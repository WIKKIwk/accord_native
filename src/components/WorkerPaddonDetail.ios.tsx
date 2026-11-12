import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { Button, HStack, Image, List, ProgressView, RNHostView, Section, Spacer, SwipeActions, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, contentShape, disabled, font, foregroundStyle, frame, id, listStyle, onLongPressGesture, onTapGesture, padding, refreshable, shapes, tint } from '@expo/ui/swift-ui/modifiers';
import { Stack, useNavigation, usePreventRemove } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { PlatformColor, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { BaseHost } from './BaseHost';
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
  const { width, fontScale } = useWindowDimensions();
  usePreventRemove(h.blockBack, ({ data }) => { void h.requestBack(() => navigation.dispatch(data.action)); });
  if (!h.current()) return null;
  const columns = width >= 340 && fontScale <= 1.3 ? 2 : 1;
  const actions: MenuAction[] = state.scanning ? [
    { id: 'confirm', title: p('worker.paddon.scan.confirm', { count: state.scanned.length }), image: 'checkmark', attributes: { disabled: !h.canConfirmScan } },
    { id: 'close', title: p('worker.paddon.scan.close'), image: 'xmark', attributes: { disabled: h.blocked } },
  ] : [
    ...(!state.selected.length ? [{ id: 'scan', title: p('worker.paddon.add_wip'), image: 'qrcode.viewfinder' as const, attributes: { disabled: !h.canManage } }] : []),
    ...(['add', 'remove'] as const).map(mode => ({ id: mode,
      title: `${p(`worker.paddon.${mode}`)}${state.mode === mode && state.selected.length ? ` (${state.selected.length})` : ''}`,
      image: mode === 'add' ? 'plus' as const : 'minus' as const,
      attributes: { disabled: !h.canManage || !!state.selected.length && state.mode !== mode } })),
    ...(state.selected.length ? [{ id: 'cancel', title: p('worker.action.cancel'), image: 'xmark' as const, attributes: { disabled: h.blocked } }] : []),
  ];
  const metric = (value: string) => <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }),
    padding({ horizontal: 10, vertical: 6 }), background(PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 10 }))]}>{value}</Text>;
  const weight = (value: string) => <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }),
    frame({ maxWidth: Infinity, alignment: 'leading' })]}>{value}</Text>;
  const reviewData = h.presentation.data?.kind === 'review' ? { ...h.presentation.data,
    title: p('worker.paddon.scan.pending', { count: state.scanned.length }), confirmLabel: p('worker.paddon.scan.confirm', { count: state.scanned.length }), confirmDisabled: !h.canConfirmScan } : h.presentation.data;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: props.code, headerBackButtonDisplayMode: 'minimal' }} />
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 20, paddingTop: 8 }}>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{p('worker.paddon.detail.subtitle')}</Text>
    </BaseHost>
    <BaseHost style={{ flex: 1 }}><AccordListScrollReader targetID={state.scanning ? cameraRowID : ''}><List modifiers={[listStyle('insetGrouped'), refreshable(() => h.controller.load())]}>
      {state.phase === 'loading' ? <ProgressView /> : state.phase === 'error' || !header ? <Section><Text>{p('worker.paddon.load_failed')}</Text>
        <Button label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} /></Section> : <>
        <Section><VStack alignment="leading" spacing={12}>
          <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{header.code}</Text><Spacer />
            <Button label={p('worker.paddon.print.short')} systemImage="qrcode" onPress={() => { void h.print(); }} modifiers={[buttonStyle('borderedProminent'), disabled(!h.canPrint)]} /></HStack>
          {header.peremotka ? <Text>{header.peremotka}</Text> : null}{header.location ? <Text>{header.location}</Text> : null}
          <HStack alignment="top" spacing={8}><Image systemName="person" size={20} /><VStack alignment="leading" spacing={3}>
            <Text modifiers={[foregroundStyle('secondary'), font({ textStyle: 'caption' })]}>{header.creatorLabel}</Text><Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{header.creator}</Text>
          </VStack></HStack>
          {columns === 2 ? <HStack alignment="top" spacing={8}>{weight(header.gross)}{weight(header.net)}</HStack> : <VStack alignment="leading" spacing={8}>{weight(header.gross)}{weight(header.net)}</VStack>}
          <HStack spacing={12}>{header.locked ? <Button label={header.locked} systemImage="lock" onPress={() => { void h.unlock(); }} modifiers={[disabled(!h.canUnlock)]} /> : null}{metric(header.wip)}</HStack>
          {state.scanning ? <Button label={p('worker.paddon.scan.pending', { count: state.scanned.length })} onPress={() => { void h.review(); }} modifiers={[disabled(!h.canReview)]} /> : null}
          {header.bobinaTitle ? <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>{header.bobinaTitle}</Text>
            {header.bobina.filter((_group, index) => index % columns === 0).map((first, rowIndex) => <HStack key={first.units} spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
              {header.bobina.slice(rowIndex * columns, rowIndex * columns + columns).map(group => <Button key={group.units}
                onPress={() => h.controller.filter(group.units)} modifiers={[buttonStyle(state.bobina === group.units ? 'borderedProminent' : 'bordered'),
                  tint(PlatformColor(state.bobina === group.units ? 'systemBlue' : 'label')), frame({ maxWidth: Infinity }), disabled(h.blocked)]}>
                <HStack spacing={6} modifiers={[frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
                  <Text>{group.label}</Text><Spacer /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{group.countText}</Text>
                  {state.bobina === group.units ? <Image systemName="checkmark" size={12} /> : null}
                </HStack>
              </Button>)}
              {columns === 2 && rowIndex * columns + 1 >= header.bobina.length ? <Spacer /> : null}
            </HStack>)}
          </VStack> : null}
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
    {header ? <MenuView actions={actions} style={{ position: 'absolute', right: 16, bottom: 88, width: 56, height: 56 }} onPressAction={event => {
      const action = actions.find(item => item.id === event.nativeEvent.event);
      if (!action || action.attributes?.disabled) return;
      if (action.id === 'scan') h.controller.startScan();
      else if (action.id === 'add' || action.id === 'remove') void h.edit(action.id);
      else if (action.id === 'cancel') void h.cancelSelection();
      else if (action.id === 'confirm') void h.controller.confirmScan();
      else if (action.id === 'close') void h.cancelScan();
    }}>
      <View accessibilityRole="button" accessibilityLabel={h.t('Amallar')} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name="plus.circle.fill" size={44} tintColor={PlatformColor('systemBlue')} />
      </View>
    </MenuView> : null}
    <WorkerPaddonDialog data={reviewData} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed}>
      {h.presentation.data?.kind === 'review' ? <ScrollView contentContainerStyle={{ gap: 10 }}>{h.scanned.map(row => <Pressable key={row.batch.batch_id} onPress={() => h.controller.unstage(row.batch.batch_id)}>
        <WorkerPaddonWipCard content={row} selectable selectionIcon="close" /></Pressable>)}</ScrollView> : null}
    </WorkerPaddonDialog>
    {h.printerDialogs}<WorkerPaddonFeedback message={h.presentation.notice} />
  </View>;
}
