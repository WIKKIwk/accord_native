import { router, Stack, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RawSplitBusy } from './RawSplitBusy';
import { RawSplitHome } from './RawSplitHome';
import { RawSplitScanner } from './RawSplitScanner';
import { useRawSplitHomeScreen } from './useRawSplitHomeScreen';
import { useRawSplitHeaderPrinter } from './useRawSplitHeaderPrinter';

export function RawSplitHomeScreen() {
  const flow = useRawSplitHomeScreen(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  const selectPrinter = useRawSplitHeaderPrinter(flow.controller);
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Rezka') }} />
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="clock.arrow.circlepath" accessibilityLabel={t('Rezka tarixi')} disabled={state.busy}
      onPress={() => router.push('/ios-homashyo/history' as Href)} />
      <Stack.Toolbar.Button icon="printer" accessibilityLabel={t('Printer tanlash')} disabled={state.busy}
        onPress={selectPrinter} /></Stack.Toolbar>
    {state.busy && <RawSplitBusy />}
    <RawSplitHome controller={flow.controller} onScan={flow.scan} issueRevision={flow.issueRevision} />
    <RawSplitScanner visible={flow.visible} active={flow.cameraActive} isCurrent={flow.isScannerCurrent} onClose={flow.close} onComplete={flow.complete} />
  </View>;
}
