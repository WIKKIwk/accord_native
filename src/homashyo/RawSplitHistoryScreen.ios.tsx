import { router, Stack, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { usePreparationText } from '../preparation/PreparationUI';
import { RawSplitBusy } from './RawSplitBusy';
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
  const home = () => { if (flow.isCurrent()) router.replace('/ios-homashyo' as Href); };
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/ios-homashyo' as Href); };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Rezka tarixi'), headerBackVisible: false,
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={back}><SymbolView name="chevron.left" size={20} /></Pressable> }} />
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="printer" accessibilityLabel={t('Printer tanlash')} disabled={state.busy || printerDisabled}
      onPress={selectPrinter} /></Stack.Toolbar>
    {state.busy && <RawSplitBusy />}
    <RawSplitPendingCheck controller={flow.pendingController} onOpenHome={home} /><RawSplitHistory {...flow} />
  </View>;
}
