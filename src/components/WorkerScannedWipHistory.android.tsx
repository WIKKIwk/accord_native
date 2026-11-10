import { Column, Host, Row, Text, TextButton } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { useWorkerScannedWips, type WorkerScannedWipsProps } from './useWorkerScannedWips';

// @v2 _ScannedWipHistorySheet
export function WorkerScannedWipHistory(props: WorkerScannedWipsProps) {
  const { state, controller, rows, alert, p, t } = useWorkerScannedWips(props);
  return <WorkerOrderSheet onClose={props.onClose} dismissible={!state.writing} preventDismiss={state.writing} heightFraction={0.76}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row modifiers={[fillMaxWidth(), padding(16, 8, 12, 8)]}>
      <Text modifiers={[weight(1)]} style={{ typography: 'titleLarge' }}>{p('worker.scanned_wip.title')}</Text>
      <TextButton enabled={state.phase !== 'loading' && state.phase !== 'invalid' && !state.writing} onClick={() => { void controller.load(); }}><Text>{t('Qayta urinish')}</Text></TextButton>
      <TextButton enabled={!state.writing} onClick={props.onClose}><Text>{p('worker.action.close')}</Text></TextButton>
    </Row></Host>
    {!!state.notice && <Host matchContents style={{ width: '100%', paddingHorizontal: 20 }}><Text>{p(state.notice)}</Text></Host>}
    {(state.writing || state.phase === 'loading') && <ActivityIndicator />}
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
        {state.phase === 'error' || state.phase === 'invalid' ? <Column><Text>{p('worker.scanned_wip.error')}</Text>
          <TextButton enabled={state.phase !== 'invalid'} onClick={() => { void controller.load(); }}><Text>{t('Qayta urinish')}</Text></TextButton></Column>
          : state.phase === 'ready' && !rows.length ? <Text>{p('worker.scanned_wip.empty')}</Text>
          : <><Text>{p('worker.scanned_wip.hint')}</Text>{rows.map(row => <Column key={row.key} verticalArrangement={{ spacedBy: 5 }}
            modifiers={[fillMaxWidth(), padding(12, 14, 12, 14), combinedClickable({ onLongClick: () => controller.requestReturn(row.item) })]}>
            <Text style={{ typography: 'titleMedium' }}>{row.title}</Text>{row.details.map((line, i) => <Text key={i} style={{ typography: 'bodySmall' }}>{line}</Text>)}
          </Column>)}</>}
      </Column></Host>
    </ScrollView><View><WorkerAlert alert={alert} onDismiss={controller.cancelReturn} /></View>
  </WorkerOrderSheet>;
}
