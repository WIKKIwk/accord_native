import { Button, HStack, List, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle, frame, listStyle, onLongPressGesture, onTapGesture, padding, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPaddonList, type WorkerPaddonListProps } from './useWorkerPaddonList';

// @v2 AparatchiPaddonsScreen
export function WorkerPaddonList(props: WorkerPaddonListProps) {
  const h = useWorkerPaddonList(props), { state, p } = h, colors = useWorkerColors();
  if (!h.current()) return null;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: h.title }} />
    <BaseHost style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(() => h.controller.load())]}>
      <Section><Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.subtitle')}</Text></Section>
      {state.phase === 'loading' ? <ProgressView /> : state.phase === 'error' ? <Section>
        <Text>{p('worker.paddon.load_failed')}</Text><Button label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
      </Section> : !state.apparatus ? <Section>{state.options.map(option => <Button key={option.id} label={p('worker.paddon.apparatus', { apparatus: option.name })}
        onPress={() => { void h.controller.select(option.id); }} />)}</Section> : <>
        <Section><VStack alignment="leading" spacing={9}>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{p('worker.paddon.location.title')}</Text>
          <Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.location.subtitle')}</Text>
          <HStack spacing={16}><Text>{`${p('worker.paddons')}: ${state.rows.length}`}</Text><Text>{`${p('worker.daily.wip')}: ${state.rows.reduce((sum, row) => sum + row.item_count, 0)}`}</Text></HStack>
        </VStack></Section>
        <Section title={h.title}>{state.rows.length ? state.rows.map(row => <VStack key={row.code} alignment="leading" spacing={5}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 6 }), onTapGesture(() => h.open(row)),
            onLongPressGesture(() => { if (h.canDelete) void h.remove(row); }), disabled(!h.enabled)]}>
          <HStack><Text modifiers={[font({ textStyle: 'headline' })]}>{row.code}</Text><Spacer /><Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.wip_count', { count: row.item_count })}</Text></HStack>
          {row.contains_peremotka ? <Text modifiers={[font({ textStyle: 'subheadline' })]}>{p('worker.rezka.print.peremotka')}</Text> : null}
        </VStack>) : <VStack spacing={8}><Text modifiers={[font({ textStyle: 'headline' })]}>{p('worker.paddon.empty.title')}</Text>
          <Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.empty.body')}</Text></VStack>}</Section>
      </>}
    </List></BaseHost>
    {state.apparatus ? <View style={{ padding: 12, gap: 8 }}>
      {h.canTransfer ? <WorkerOrderButton label={p('worker.paddon.transfer.title')} onPress={h.transfer} /> : null}
      <WorkerOrderButton label={p('worker.paddon.create')} disabled={!h.canCreate} variant="filled" onPress={() => { void h.create(); }} />
    </View> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
    <WorkerPaddonFeedback message={h.presentation.notice} />
  </View>;
}
