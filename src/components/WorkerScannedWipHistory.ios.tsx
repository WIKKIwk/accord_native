import { Button, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, controlSize, disabled,
  fixedSize, font, foregroundStyle, frame, lineLimit, listRowInsets, listRowSpacing, listSectionSpacing, listStyle, multilineTextAlignment, onLongPressGesture, shapes } from '@expo/ui/swift-ui/modifiers';
import { useContext } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { useWorkerScannedWips, type WorkerScannedWipsProps } from './useWorkerScannedWips';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerHistoryButton } from './WorkerHistoryButton';

function CloseHistory({ onClose, writing, label }: { onClose: () => void; writing: boolean; label: string }) {
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  return <WorkerHistoryButton icon="close" label={label} onPress={close} disabled={writing} testID="scanned-wip-history-close" />;
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
            <WorkerHistoryButton icon="reload" label={t('Qayta urinish')} onPress={() => { void controller.load(); }}
              disabled={!presentation.canReload} testID="scanned-wip-history-refresh" />
            <CloseHistory label={p('worker.action.close')} onClose={props.onClose} writing={state.writing} />
          </HStack>
        </BaseHost>
      </View>
      {!!state.notice && <View style={styles.inset}><BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Text modifiers={[font({ textStyle: 'subheadline' }), fixedSize({ horizontal: false, vertical: true })]}>{p(state.notice)}</Text>
      </BaseHost></View>}
      {state.writing && <BaseHost matchContents={{ vertical: true }} style={styles.host}><ProgressView /></BaseHost>}
      {!presentation.fitContent && <View style={styles.inset}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'),
            fixedSize({ horizontal: false, vertical: true })]}>{p('worker.scanned_wip.hint')}</Text>
        </BaseHost>
      </View>}
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
        <List modifiers={[listStyle('insetGrouped'), listRowSpacing(0), listSectionSpacing('compact')]}>
          <Section>
            {rows.map(row => <HStack key={row.key} alignment="top" spacing={12}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), listRowInsets({ top: 12, leading: 16, bottom: 12, trailing: 16 }),
                contentShape(shapes.rectangle()), ...(row.canReturn ? [onLongPressGesture(() => controller.requestReturn(row.item), 0.5)] : [])]}>
              <Image systemName="qrcode" size={22} color={PlatformColor('secondaryLabel')} />
              <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold', design: 'monospaced' }), lineLimit(2)]}>{row.title}</Text>
                {row.details.map((line, i) => <Text key={i} modifiers={[font({ textStyle: i === 0 ? 'subheadline' : 'caption' }), foregroundStyle('secondary'),
                  fixedSize({ horizontal: false, vertical: true })]}>{line}</Text>)}
              </VStack>
              {row.canReturn && <Image systemName="arrow.uturn.backward" size={20} />}
            </HStack>)}
          </Section>
        </List>
      </BaseHost>}
    </View>
    <View><WorkerAlert alert={alert} onDismiss={controller.cancelReturn} /></View>
  </WorkerOrderSheet>;
}
const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 }, expanded: { flex: 1 }, inset: { paddingHorizontal: 20 }, host: { width: '100%' },
});
