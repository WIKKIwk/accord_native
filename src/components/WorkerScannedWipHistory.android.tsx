import { Button, CircularProgressIndicator, Column, FilledTonalIconButton, LinearProgressIndicator, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxWidth, padding, semantics, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from './BaseHost';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { useWorkerScannedWips, type WorkerScannedWipsProps } from './useWorkerScannedWips';

// @v2 _ScannedWipHistorySheet
export function WorkerScannedWipHistory(props: WorkerScannedWipsProps) {
  const { state, controller, rows, alert, p, t, presentation } = useWorkerScannedWips(props);
  const colors = useMaterialColors();
  return <WorkerOrderSheet onClose={props.onClose} dismissible={!state.writing} preventDismiss={state.writing}
    compact={presentation.fitContent} fitContent={presentation.fitContent} measureContent={presentation.fitContent} heightFraction={0.76}>
    <View testID="scanned-wip-history-content" style={[styles.content, !presentation.fitContent && styles.expanded]}>
      <BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(20, 0, 12, 0)]}>
          <Text color={colors.onSurface} maxLines={2} overflow="ellipsis" modifiers={[weight(1)]}
            style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }}>{p('worker.scanned_wip.title')}</Text>
          <FilledTonalIconButton enabled={presentation.canReload} onClick={() => { void controller.load(); }}
            modifiers={[size(48, 48), semantics({ contentDescription: t('Qayta urinish') })]}>
            <RNHostView matchContents><SymbolView name={{ android: 'refresh' }} size={24} tintColor={colors.onSecondaryContainer} /></RNHostView>
          </FilledTonalIconButton>
          <FilledTonalIconButton enabled={!state.writing} onClick={props.onClose}
            modifiers={[size(48, 48), semantics({ contentDescription: p('worker.action.close') })]}>
            <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSecondaryContainer} /></RNHostView>
          </FilledTonalIconButton>
        </Row>
      </BaseHost>
      {!!state.notice && <View style={styles.inset}><BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Text color={colors.onSurface} style={{ typography: 'bodyMedium' }}>{p(state.notice)}</Text>
      </BaseHost></View>}
      {state.writing && <BaseHost matchContents={{ vertical: true }} style={styles.host}><LinearProgressIndicator modifiers={[fillMaxWidth()]} /></BaseHost>}
      {presentation.fitContent ? <View style={[styles.inset, styles.status]}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
            {presentation.loading ? <CircularProgressIndicator modifiers={[size(28, 28)]} /> : presentation.failed ? <>
              <Text color={colors.error} style={{ typography: 'bodyMedium', textAlign: 'center' }}>{p('worker.scanned_wip.error')}</Text>
              <Button enabled={presentation.canRetry} onClick={() => { void controller.load(); }}><Text>{t('Qayta urinish')}</Text></Button>
            </> : presentation.empty ? <>
              <RNHostView matchContents><SymbolView name={{ android: 'qr_code' }} size={32} tintColor={colors.onSurfaceVariant} /></RNHostView>
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium', textAlign: 'center' }}>{p('worker.scanned_wip.empty')}</Text>
            </> : null}
          </Column>
        </BaseHost>
      </View> : <ScrollView style={styles.expanded} contentContainerStyle={styles.list}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{p('worker.scanned_wip.hint')}</Text>
        </BaseHost>
        {rows.map(row => <View key={row.key} style={[styles.card, { backgroundColor: colors.surface }]}>
          <BaseHost matchContents={{ vertical: true }} style={styles.host}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(14, 14, 14, 14),
              ...(row.canReturn ? [combinedClickable({ onLongClick: () => controller.requestReturn(row.item) })] : [])]}>
              <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[weight(1)]}>
                <Text color={colors.onSurface} maxLines={2} overflow="ellipsis" style={{ typography: 'bodyMedium', fontFamily: 'monospace', fontWeight: '700' }}>{row.title}</Text>
                {row.details.map((line, i) => <Text key={i} color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{line}</Text>)}
              </Column>
              {row.canReturn && <RNHostView matchContents><SymbolView name={{ android: 'undo' }} size={22} tintColor={colors.primary} /></RNHostView>}
            </Row>
          </BaseHost>
        </View>)}
      </ScrollView>}
    </View>
    <View><WorkerAlert alert={alert} onDismiss={controller.cancelReturn} /></View>
  </WorkerOrderSheet>;
}
const styles = StyleSheet.create({
  host: { width: '100%' }, content: { gap: 12, paddingBottom: 16 }, expanded: { flex: 1 }, inset: { paddingHorizontal: 20 },
  status: { minHeight: 112, paddingVertical: 12, justifyContent: 'center' }, list: { padding: 16, gap: 12 }, card: { borderRadius: 14, overflow: 'hidden' },
});
