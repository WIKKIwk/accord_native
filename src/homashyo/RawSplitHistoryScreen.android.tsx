import { useSyncExternalStore } from 'react';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitFrame } from './RawSplitFrame.android';
import { RawSplitHistory } from './RawSplitHistory';
import { useRawSplitHistoryActions } from './useRawSplitHistoryActions';
import { useRawSplitHeaderPrinter } from './useRawSplitHeaderPrinter';
export function RawSplitHistoryScreen() {
  const flow = useRawSplitHistoryActions(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  const selectPrinter = useRawSplitHeaderPrinter(flow.controller);
  return <RawSplitFrame title={t('Rezka tarixi')} page="history" busy={state.busy} onPrinter={selectPrinter}>
    <RawSplitHistory {...flow} />
  </RawSplitFrame>;
}
