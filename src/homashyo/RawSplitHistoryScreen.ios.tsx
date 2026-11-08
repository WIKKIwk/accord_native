import { router, Stack, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RawSplitBusy } from './RawSplitBusy';
import { RawSplitHistory } from './RawSplitHistory';
import { useRawSplitHistoryActions } from './useRawSplitHistoryActions';
import { useRawSplitHeaderPrinter } from './useRawSplitHeaderPrinter';
export function RawSplitHistoryScreen() {
  const flow = useRawSplitHistoryActions(), state = useSyncExternalStore(flow.controller.subscribe, flow.controller.getSnapshot, flow.controller.getSnapshot), t = usePreparationText();
  const selectPrinter = useRawSplitHeaderPrinter(flow.controller);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/ios-homashyo' as Href); };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Rezka tarixi'), headerBackVisible: false,
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={back}><SymbolView name="chevron.left" size={20} /></Pressable> }} />
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="printer" accessibilityLabel={t('Printer tanlash')} disabled={state.busy}
      onPress={selectPrinter} /></Stack.Toolbar>
    {state.busy && <RawSplitBusy />}
    <RawSplitHistory {...flow} />
  </View>;
}
