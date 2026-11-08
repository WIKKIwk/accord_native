import { useSyncExternalStore } from 'react';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitFrame } from './RawSplitFrame.android';
import { RawSplitHome } from './RawSplitHome';
import { RawSplitScanner } from './RawSplitScanner';
import { useRawSplitHomeScreen } from './useRawSplitHomeScreen';
import { useRawSplitHeaderPrinter } from './useRawSplitHeaderPrinter';
export function RawSplitHomeScreen() {
  const flow = useRawSplitHomeScreen(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  const selectPrinter = useRawSplitHeaderPrinter(flow.controller);
  return <RawSplitFrame title={t('Rezka')} page="home" busy={state.busy} onPrinter={selectPrinter}>
    <RawSplitHome controller={flow.controller} onScan={flow.scan} issueRevision={flow.issueRevision} />
    <RawSplitScanner visible={flow.visible} active={flow.cameraActive} isCurrent={flow.isScannerCurrent} onClose={flow.close} onComplete={flow.complete} />
  </RawSplitFrame>;
}
