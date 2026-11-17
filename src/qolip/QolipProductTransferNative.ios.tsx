import { Button, Host, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, labelStyle, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, Pressable, View } from 'react-native';
import type { QolipTransferControlsProps, QolipTransferRowProps } from './qolipProductTransferNativeTypes';
export function QolipProductTransferControls(props: QolipTransferControlsProps) {
  return <Host matchContents={{ vertical: true }}><HStack spacing={8}><Text modifiers={[font({ textStyle: 'caption' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{props.hint}</Text>
    <Button label={props.scanLabel} systemImage="qrcode.viewfinder" onPress={props.scan} modifiers={[buttonStyle('bordered'), labelStyle('iconOnly'), disabled(props.disabled), frame({ minHeight: 44 })]} />
    <Button label={props.refreshLabel} systemImage="arrow.clockwise" onPress={props.refresh} modifiers={[buttonStyle('bordered'), labelStyle('iconOnly'), disabled(props.disabled), frame({ minHeight: 44 })]} />
  </HStack></Host>;
}
export function QolipProductTransferRow(props: QolipTransferRowProps) {
  return <Pressable disabled={props.disabled} onPress={props.onToggle} accessibilityRole="button" accessibilityState={{ selected: props.selected, disabled: props.disabled }}
    style={{ minHeight: 68, marginBottom: props.last ? 12 : 2, borderRadius: props.first || props.last ? 16 : 5, backgroundColor: PlatformColor('secondarySystemBackground'), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, opacity: props.disabled ? 0.48 : 1 }}>
    <Host style={{ width: 36 }} matchContents={{ vertical: true }}><Text modifiers={[font({ textStyle: 'body', weight: 'bold' })]}>{props.selected ? '✓' : String(props.index + 1)}</Text></Host>
    <Host style={{ flex: 1 }} matchContents={{ vertical: true }}><VStack alignment="leading" spacing={4}>
      <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{`${props.item.qolip_code} • ${props.item.name}`}</Text>
      {!!props.subtitle && <Text modifiers={[font({ textStyle: 'caption' }), lineLimit(1)]}>{props.subtitle}</Text>}
    </VStack></Host><View>{props.trailing}</View>
  </Pressable>;
}
