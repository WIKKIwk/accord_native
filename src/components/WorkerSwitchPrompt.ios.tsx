import { BottomSheet, Button, Group, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, font, frame, padding, presentationDragIndicator, presentationSizing } from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { BaseHost } from './BaseHost';
import { useWorkerOrderText } from './useWorkerOrderText';
import type { WorkerSwitchChoice, WorkerSwitchPromptProps } from './workerSwitchPromptProps';

/** @v2 _WorkerTemporaryPauseSwitchSheet */
export function WorkerSwitchPrompt({ apparatus, order, canComplete, onChoose }: WorkerSwitchPromptProps) {
  const { p } = useWorkerOrderText(), { width } = useWindowDimensions();
  const [presented, setPresented] = useState(true), choice = useRef<WorkerSwitchChoice>(null), closing = useRef(false), delivered = useRef(false);
  function choose(value: WorkerSwitchChoice) {
    if (closing.current) return;
    closing.current = true; choice.current = value; setPresented(false);
  }
  return <BaseHost style={{ position: 'absolute', width }}>
    <BottomSheet isPresented={presented} onIsPresentedChange={setPresented} onDismiss={() => { if (!delivered.current) { delivered.current = true; onChoose(choice.current); } }} fitToContents>
      <Group modifiers={[presentationSizing('automatic', { fitted: { horizontal: false, vertical: true } }), presentationDragIndicator('visible')]}>
        <VStack alignment="leading" spacing={16} modifiers={[padding({ horizontal: 20, top: 24, bottom: 24 }), frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{p('worker.order.switch.title')}</Text>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{p('worker.order.switch.current_order', { apparatus, order })}</Text>
          <Text>{p('worker.temporary_pause.switch_description')}</Text>
          <Button onPress={() => choose('temporary_pause')} modifiers={[buttonStyle('borderedProminent'), controlSize('large')]}>
            <HStack spacing={8}><Image systemName="pause.circle" /><Text>{p('worker.temporary_pause.action')}</Text></HStack>
          </Button>
          {canComplete ? <Button label={p('worker.temporary_pause.switch_complete')} onPress={() => choose('complete')} modifiers={[buttonStyle('bordered'), controlSize('large')]} /> : null}
        </VStack>
      </Group>
    </BottomSheet>
  </BaseHost>;
}
