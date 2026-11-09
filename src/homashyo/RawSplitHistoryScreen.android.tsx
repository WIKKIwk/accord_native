import { router, type Href } from 'expo-router';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitFrame } from './RawSplitFrame.android';
import { RawSplitHistory } from './RawSplitHistory';
import { RawSplitPendingCheck } from './RawSplitPendingCheck';
import { useRawSplitHistoryActions } from './useRawSplitHistoryActions';
import { useRawSplitHeaderPrinter } from './useRawSplitHeaderPrinter';
export function RawSplitHistoryScreen() {
  const flow = useRawSplitHistoryActions(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  useSyncExternalStore(flow.pendingController.subscribe, flow.pendingController.getSnapshot, flow.pendingController.getSnapshot);
  // A deep-linked History must check the same original-session keys even if Home never mounted.
  useLayoutEffect(() => { if (flow.pendingController.getSnapshot().pendingCheck === 'unread') void flow.pendingController.reload(); }, [flow.pendingController]);
  const selectPrinter = useRawSplitHeaderPrinter(flow.controller), printerDisabled = !flow.controller.capturePrinterLease();
  return <RawSplitFrame title={t('Rezka tarixi')} page="history" busy={state.busy} printerDisabled={printerDisabled} onPrinter={selectPrinter}>
    <RawSplitPendingCheck controller={flow.pendingController} onOpenHome={() => { if (flow.isCurrent()) router.replace('/android-homashyo' as Href); }} /><RawSplitHistory {...flow} />
  </RawSplitFrame>;
}
