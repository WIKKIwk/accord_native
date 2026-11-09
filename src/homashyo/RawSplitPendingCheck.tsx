import { useSyncExternalStore } from 'react';
import { Text, useColorScheme, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { usePreparationText } from '../preparation/PreparationUI';
import type { RawSplitController } from './rawSplitController';
import { useRawSplitWriteHoldText } from './useRawSplitWriteHoldText';

/** A status retry only reads the pending keys; known commands are handled on Home. */
export function RawSplitPendingCheck({ controller, onOpenHome }: { controller: RawSplitController; onOpenHome(): void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  const color = useColorScheme() === 'dark' ? '#f2b8b5' : '#b3261e', holdText = useRawSplitWriteHoldText();
  const pending = state.pendingCheck === 'ready' && (state.pending !== null || state.pendingIssue !== null);
  if (!controller.writesHeld && state.pendingCheck === 'ready' && !pending) return null;
  return <View style={{ padding: 16, gap: 8 }}>
    {controller.writesHeld && <Text style={{ color }}>{holdText}</Text>}
    {(state.pendingCheck === 'unread' || state.pendingCheck === 'checking') && <Text style={{ color }}>{t('Tekshirilmoqda...')}</Text>}
    {state.pendingCheck === 'failed' && <><Text style={{ color }}>{t('Xatolik yuz berdi')}</Text>
      <Text style={{ color }}>{t('Oldingi saqlash natijasini tekshiring.')}</Text>
      <Text style={{ color }}>{t('Oldingi muammo qaydi natijasini tekshiring.')}</Text>
      {state.pendingCheckError !== null && <Text style={{ color }}>{state.pendingCheckError}</Text>}
      <WorkerSheetButton label={t('Qayta urinish')} onPress={() => { void controller.recheckPending(); }} /></>}
    {pending && <>{state.pending !== null && <Text style={{ color }}>{t('Oldingi saqlash natijasini tekshiring.')}</Text>}
      {state.pendingIssue !== null && <Text style={{ color }}>{t('Oldingi muammo qaydi natijasini tekshiring.')}</Text>}
      <WorkerSheetButton label={t('Bosh sahifa')} onPress={onOpenHome} /></>}
  </View>;
}
