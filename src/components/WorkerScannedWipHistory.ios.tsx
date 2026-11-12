import { Button, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonBorderShape, buttonStyle, contentShape, controlSize, disabled,
  fixedSize, font, foregroundStyle, frame, labelStyle, lineLimit, listStyle, multilineTextAlignment, onLongPressGesture, shapes } from '@expo/ui/swift-ui/modifiers';
import { useContext } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { useWorkerScannedWips, type WorkerScannedWipsProps } from './useWorkerScannedWips';
import { WorkerSheetCloseContext } from './workerSheetContext';

function CloseHistory({ onClose, writing, label }: { onClose: () => void; writing: boolean; label: string }) {
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  return <Button label={label} systemImage="xmark" onPress={close}
    modifiers={[buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('large'), labelStyle('iconOnly'),
      frame({ width: 44, height: 44 }), accessibilityLabel(label), accessibilityIdentifier('scanned-wip-history-close'), disabled(writing)]} />;
}

// @v2 _ScannedWipHistorySheet
export function WorkerScannedWipHistory(props: WorkerScannedWipsProps) {
  const { state, controller, rows, alert, p, t, presentation } = useWorkerScannedWips(props);
  return <WorkerOrderSheet onClose={props.onClose} dismissible={!state.writing} preventDismiss={state.writing}
    compact={presentation.fitContent} fitContent={presentation.fitContent} measureContent={presentation.fitContent} heightFraction={0.76}>
    <View testID="scanned-wip-history-content" style={[styles.content, !presentation.fitContent && styles.expanded]}>
      <View style={styles.inset}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), lineLimit(2), fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: 'leading' })]}>{p('worker.scanned_wip.title')}</Text>
            <Button label={t('Qayta urinish')} systemImage="arrow.clockwise" onPress={() => { void controller.load(); }}
              modifiers={[buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('large'), labelStyle('iconOnly'),
                frame({ width: 44, height: 44 }), accessibilityLabel(t('Qayta urinish')), accessibilityIdentifier('scanned-wip-history-refresh'), disabled(!presentation.canReload)]} />
            <CloseHistory label={p('worker.action.close')} onClose={props.onClose} writing={state.writing} />
          </HStack>
        </BaseHost>
      </View>
      {!!state.notice && <View style={styles.inset}><BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Text modifiers={[font({ textStyle: 'subheadline' }), fixedSize({ horizontal: false, vertical: true })]}>{p(state.notice)}</Text>
      </BaseHost></View>}
      {state.writing && <BaseHost matchContents={{ vertical: true }} style={styles.host}><ProgressView /></BaseHost>}
      {presentation.fitContent ? <View style={styles.inset}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <VStack spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 104 })]}>
            {presentation.loading ? <ProgressView /> : presentation.failed ? <>
              <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('systemRed')),
                multilineTextAlignment('center'), fixedSize({ horizontal: false, vertical: true })]}>{p('worker.scanned_wip.error')}</Text>
              <Button label={t('Qayta urinish')} onPress={() => { void controller.load(); }}
                modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 44 }), disabled(!presentation.canRetry)]} />
            </> : presentation.empty ? <>
              <Image systemName="qrcode" size={32} color={PlatformColor('secondaryLabel')} />
              <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), multilineTextAlignment('center'),
                fixedSize({ horizontal: false, vertical: true })]}>{p('worker.scanned_wip.empty')}</Text>
            </> : null}
          </VStack>
        </BaseHost>
      </View> : <BaseHost style={styles.expanded}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{p('worker.scanned_wip.hint')}</Text></Section>
          {rows.map(row => <Section key={row.key}>
            <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()),
              ...(row.canReturn ? [onLongPressGesture(() => controller.requestReturn(row.item), 0.5)] : [])]}>
              <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold', design: 'monospaced' }), lineLimit(2)]}>{row.title}</Text>
                {row.details.map((line, i) => <Text key={i} modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'),
                  fixedSize({ horizontal: false, vertical: true })]}>{line}</Text>)}
              </VStack>
              {row.canReturn && <Image systemName="arrow.uturn.backward" size={20} />}
            </HStack>
          </Section>)}
        </List>
      </BaseHost>}
    </View>
    <View><WorkerAlert alert={alert} onDismiss={controller.cancelReturn} /></View>
  </WorkerOrderSheet>;
}
const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 }, expanded: { flex: 1 }, inset: { paddingHorizontal: 20 }, host: { width: '100%' },
});
