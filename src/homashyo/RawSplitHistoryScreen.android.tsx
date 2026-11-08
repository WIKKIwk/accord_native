import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitFrame } from './RawSplitFrame.android';
import { RawSplitHistory } from './RawSplitHistory';
import { useRawSplitHistoryActions } from './useRawSplitHistoryActions';
export function RawSplitHistoryScreen() {
  const flow = useRawSplitHistoryActions(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  return <RawSplitFrame title={t('Rezka tarixi')} page="history" busy={state.busy} onPrinter={() => { void flow.controller.selectPrinter().catch(error => Alert.alert('Xatolik', String(error))); }}>
    <RawSplitHistory {...flow} />
  </RawSplitFrame>;
}
