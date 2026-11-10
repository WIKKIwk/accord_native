import { Button, Column, ModalBottomSheet, OutlinedButton, Text, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import { useWorkerOrderText } from './useWorkerOrderText';
import type { WorkerSwitchChoice, WorkerSwitchPromptProps } from './workerSwitchPromptProps';

/** @v2 _WorkerTemporaryPauseSwitchSheet */
export function WorkerSwitchPrompt({ apparatus, order, canComplete, onChoose }: WorkerSwitchPromptProps) {
  const { p } = useWorkerOrderText(), { width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const sheet = useRef<ModalBottomSheetRef>(null), closing = useRef(false);
  async function choose(choice: WorkerSwitchChoice) {
    if (closing.current) return;
    closing.current = true;
    await sheet.current?.hide();
    onChoose(choice);
  }
  return <BaseHost style={{ position: 'absolute', top: 0, bottom: 0, width }}>
    <ModalBottomSheet ref={sheet} onDismissRequest={() => { if (!closing.current) { closing.current = true; onChoose(null); } }} skipPartiallyExpanded showDragHandle>
      <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(20, 8, 20, insets.bottom + 20)]}>
        <Text style={{ typography: 'titleLarge' }}>{p('worker.order.switch.title')}</Text>
        <Text style={{ typography: 'titleMedium' }}>{p('worker.order.switch.current_order', { apparatus, order })}</Text>
        <Text>{p('worker.temporary_pause.switch_description')}</Text>
        <Button onClick={() => { void choose('temporary_pause'); }} modifiers={[fillMaxWidth()]}><Text>{p('worker.temporary_pause.action')}</Text></Button>
        {canComplete ? <OutlinedButton onClick={() => { void choose('complete'); }} modifiers={[fillMaxWidth()]}><Text>{p('worker.temporary_pause.switch_complete')}</Text></OutlinedButton> : null}
      </Column>
    </ModalBottomSheet>
  </BaseHost>;
}
