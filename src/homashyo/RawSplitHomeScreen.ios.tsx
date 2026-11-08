import { router, Stack, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Alert, View } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RawSplitHome } from './RawSplitHome';
import { RawSplitScanner } from './RawSplitScanner';
import { useRawSplitHomeScreen } from './useRawSplitHomeScreen';

export function RawSplitHomeScreen() {
  const flow = useRawSplitHomeScreen(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Rezka') }} />
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="clock.arrow.circlepath" accessibilityLabel={t('Rezka tarixi')} disabled={state.busy}
      onPress={() => router.push('/ios-homashyo/history' as Href)} />
      <Stack.Toolbar.Button icon="printer" accessibilityLabel={t('Printer tanlash')} disabled={state.busy}
        onPress={() => { void flow.controller.selectPrinter().catch(error => Alert.alert('Xatolik', String(error))); }} /></Stack.Toolbar>
    <RawSplitHome controller={flow.controller} onScan={flow.scan} />
    <RawSplitScanner visible={flow.visible} active={flow.cameraActive} isCurrent={flow.isScannerCurrent} onClose={flow.close} onComplete={flow.complete} />
  </View>;
}
