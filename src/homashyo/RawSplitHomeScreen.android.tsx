import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitFrame } from './RawSplitFrame.android';
import { RawSplitHome } from './RawSplitHome';
import { RawSplitScanner } from './RawSplitScanner';
import { useRawSplitHomeScreen } from './useRawSplitHomeScreen';
export function RawSplitHomeScreen() {
  const flow = useRawSplitHomeScreen(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  return <RawSplitFrame title={t('Rezka')} page="home" busy={state.busy} onPrinter={() => { void flow.controller.selectPrinter().catch(error => Alert.alert('Xatolik', String(error))); }}>
    <RawSplitHome controller={flow.controller} onScan={flow.scan} />
    <RawSplitScanner visible={flow.visible} active={flow.cameraActive} isCurrent={flow.isScannerCurrent} onClose={flow.close} onComplete={flow.complete} />
  </RawSplitFrame>;
}
