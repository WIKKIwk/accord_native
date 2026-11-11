import { Button, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { contentShape, disabled, font, foregroundStyle, frame, labelStyle, listStyle, onLongPressGesture, shapes } from '@expo/ui/swift-ui/modifiers';
import { useContext } from 'react';
import { View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { useWorkerScannedWips, type WorkerScannedWipsProps } from './useWorkerScannedWips';
import { WorkerSheetCloseContext } from './workerSheetContext';

function CloseHistory({ onClose, writing, label }: { onClose: () => void; writing: boolean; label: string }) {
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  return <Button label={label} systemImage="xmark" onPress={close} modifiers={[labelStyle('iconOnly'), disabled(writing)]} />;
}

// @v2 _ScannedWipHistorySheet
export function WorkerScannedWipHistory(props: WorkerScannedWipsProps) {
  const { state, controller, rows, alert, p, t } = useWorkerScannedWips(props);
  return <WorkerOrderSheet onClose={props.onClose} dismissible={!state.writing} preventDismiss={state.writing} heightFraction={0.76}>
    <BaseHost style={{ flex: 1 }}><VStack spacing={10} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
      <HStack spacing={12}>
        <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{p('worker.scanned_wip.title')}</Text>
        <Button label={t('Qayta urinish')} systemImage="arrow.clockwise" onPress={() => { void controller.load(); }} modifiers={[labelStyle('iconOnly'), disabled(state.phase === 'loading' || state.phase === 'invalid' || state.writing)]} />
        <CloseHistory label={p('worker.action.close')} onClose={props.onClose} writing={state.writing} />
      </HStack>
      {!!state.notice && <Text>{p(state.notice)}</Text>}
      {(state.writing || state.phase === 'loading') && <ProgressView />}
      {state.phase === 'error' || state.phase === 'invalid' ? <VStack spacing={8}><Text>{p('worker.scanned_wip.error')}</Text>
        <Button label={t('Qayta urinish')} onPress={() => { void controller.load(); }} modifiers={[disabled(state.phase === 'invalid')]} /></VStack>
        : state.phase === 'ready' && !rows.length ? <Text>{p('worker.scanned_wip.empty')}</Text>
        : <List modifiers={[listStyle('insetGrouped')]}><Section><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{p('worker.scanned_wip.hint')}</Text></Section>
          {rows.map(row => <Section key={row.key}><HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()), onLongPressGesture(() => controller.requestReturn(row.item), 0.5)]}>
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{row.title}</Text>
              {row.details.map((line, i) => <Text key={i} modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{line}</Text>)}
            </VStack>{row.canReturn && <Image systemName="arrow.uturn.backward" size={20} />}
          </HStack></Section>)}
        </List>}
    </VStack></BaseHost>
    <View><WorkerAlert alert={alert} onDismiss={controller.cancelReturn} /></View>
  </WorkerOrderSheet>;
}
