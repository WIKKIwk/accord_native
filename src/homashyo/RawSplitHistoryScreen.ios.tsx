import { Stack } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Alert, View } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RawSplitHistory } from './RawSplitHistory';
import { useRawSplitHistoryActions } from './useRawSplitHistoryActions';
export function RawSplitHistoryScreen() {
  const flow = useRawSplitHistoryActions(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Rezka tarixi') }} />
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="printer" accessibilityLabel={t('Printer tanlash')} disabled={state.busy}
      onPress={() => { void flow.controller.selectPrinter().catch(error => Alert.alert('Xatolik', String(error))); }} /></Stack.Toolbar>
    <RawSplitHistory {...flow} />
  </View>;
}
