import { BottomSheet, Button, Group, HStack, Image, List, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, contentShape, disabled, font, foregroundStyle, frame, labelStyle, listRowInsets, listStyle, padding, presentationDetents, presentationDragIndicator, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, useWindowDimensions } from 'react-native';
import { BaseHost } from './BaseHost';
import type { WorkerActivePaddonProps } from './workerActivePaddonProps';
import { useWorkerOrderText } from './useWorkerOrderText';

/** Native SwiftUI content, hosted by the worker queue's toolbar. */
export function WorkerActivePaddonButton({ state, controller, label, onOpen }: WorkerActivePaddonProps) {
  return <Button onPress={onOpen ?? (() => { void controller.open(); })} modifiers={[labelStyle('iconOnly'), accessibilityLabel(label), disabled(state.busy)]}>
    <ZStack alignment="topTrailing">
      <Image systemName="shippingbox" size={22} />
      {state.selection === 'error' ? <Image systemName="exclamationmark.circle.fill" size={12} color={PlatformColor('systemRed')} />
        : state.code !== null ? <Image systemName="circle.fill" size={7} /> : null}
    </ZStack>
  </Button>;
}

export function WorkerActivePaddonPicker({ state, controller }: WorkerActivePaddonProps) {
  const { p } = useWorkerOrderText(), { width } = useWindowDimensions();
  const ready = state.selection === 'ready' && (state.picker === 'ready' || state.picker === 'closed');
  const error = state.selection === 'error' || state.picker === 'error';
  const choice = (code: string | null, title: string, count?: number) => <Button key={code ?? 'none'} onPress={() => { void controller.choose(code); }} modifiers={[
    buttonStyle('plain'), ...(code === null ? [] : [listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 })]),
  ]}>
    <HStack spacing={14} modifiers={[padding({ vertical: 8, horizontal: code === null ? 0 : 16 }), frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle())]}>
      <Image systemName={code === null ? 'link' : 'shippingbox'} size={22} />
      <VStack alignment="leading" spacing={3}><Text>{title}</Text>
        {count != null ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{p('worker.paddon.active.rolls', { count })}</Text> : null}
      </VStack><Spacer />{state.code === code ? <Image systemName="checkmark" size={18} /> : null}
    </HStack>
  </Button>;
  return <BaseHost style={{ position: 'absolute', width }}>
    <BottomSheet isPresented={state.picker !== 'closed'} onIsPresentedChange={shown => { if (!shown) controller.close(); }}>
      <Group modifiers={[presentationDetents([{ fraction: 0.65 }]), presentationDragIndicator('visible')]}>
        <VStack spacing={12} modifiers={[padding({ top: 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{p('worker.paddon.active.choose')}</Text>
          {error ? <><Spacer /><Text modifiers={[padding({ horizontal: 16 })]}>{p('worker.paddon.active.load_failed')}</Text><Spacer /></>
            : !ready ? <><Spacer /><ProgressView /><Spacer /></> : <>
              <VStack modifiers={[padding({ horizontal: 16 })]}>{choice(null, p('worker.paddon.active.none'))}</VStack>
              {state.paddons.length ? <List modifiers={[listStyle('plain')]}>{state.paddons.map(row => choice(row.code, row.code, row.item_count))}</List>
                : <><Spacer /><Text modifiers={[padding({ horizontal: 16 })]}>{p('worker.paddon.active.empty')}</Text><Spacer /></>}
            </>}
        </VStack>
      </Group>
    </BottomSheet>
  </BaseHost>;
}
