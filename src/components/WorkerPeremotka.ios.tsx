import { BottomSheet, Button, Group, Image, List, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, font, foregroundStyle, frame, listStyle, padding, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';
import { BaseHost } from './BaseHost';
import type { useWorkerPeremotka } from './useWorkerPeremotka';
type Props = ReturnType<typeof useWorkerPeremotka>;

export function WorkerPeremotkaButton({ title, controller, disabled: inactive, onOpen }: Props & { disabled?: boolean; onOpen?: () => void }) {
  return <Button onPress={onOpen ?? (() => { void controller.open(); })} modifiers={[accessibilityLabel(title), disabled(!!inactive)]}><Image systemName="arrow.counterclockwise" size={22} /></Button>;
}

export function WorkerPeremotkaSheet({ state, controller, rows, title, error, empty }: Props) {
  const { width } = useWindowDimensions();
  return <BaseHost style={{ position: 'absolute', width }}>
    <BottomSheet isPresented={state.phase !== 'closed'} onIsPresentedChange={shown => { if (!shown) controller.close(); }}>
      <Group modifiers={[presentationDetents([{ fraction: 0.56 }]), presentationDragIndicator('visible')]}>
        <VStack spacing={12} modifiers={[padding({ top: 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{title}</Text>
          {state.phase === 'loading' ? <><Spacer /><ProgressView /><Spacer /></>
            : state.phase === 'error' || !rows.length ? <><Spacer /><Text modifiers={[padding({ horizontal: 16 })]}>{state.phase === 'error' ? error : empty}</Text><Spacer /></>
              : <List modifiers={[listStyle('plain')]}>{rows.map(row => <VStack key={row.id} alignment="leading" spacing={4}>
                <Text>{row.title}</Text><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{row.subtitle}</Text>
              </VStack>)}</List>}
        </VStack>
      </Group>
    </BottomSheet>
  </BaseHost>;
}
