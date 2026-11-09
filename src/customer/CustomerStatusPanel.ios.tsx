import { Button, HStack, Image, Overlay, RoundedRectangle, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityHidden, background, buttonStyle, contentShape, fixedSize, font, foregroundStyle, frame, lineLimit,
  listRowBackground, listRowInsets, opacity, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerStatusRows, type CustomerStatusPanelProps } from './customerPresentation';

function countLabel(count: string, sizingOnly: boolean) {
  return <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), padding({ horizontal: 14 }),
    frame({ minWidth: 44, minHeight: 40 }), fixedSize({ horizontal: true, vertical: true }),
    ...(sizingOnly ? [opacity(0), accessibilityHidden()] : [foregroundStyle(PlatformColor('label')),
      background(PlatformColor('secondarySystemFill'), shapes.roundedRectangle({ cornerRadius: 14 }))])]}>{count}</Text>;
}

export function CustomerStatusPanel({ summary, onOpenStatus }: CustomerStatusPanelProps) {
  const { text } = useCustomerText();
  return <Section>{customerStatusRows(summary).map(row => {
    const highlighted = row.kind === 'pending', count = String(row.count), open = () => onOpenStatus(row.kind);
    return <Overlay key={row.kind} alignment="trailing" modifiers={[listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
      ...(highlighted ? [listRowBackground(PlatformColor('secondarySystemFill'))] : [])]}>
      <Button testID={`customer-status-row-${row.kind}`} onPress={open} modifiers={[buttonStyle('plain')]}>
        <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 20, vertical: 20 }),
          foregroundStyle(PlatformColor('label')), contentShape(shapes.rectangle())]}>
          <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            {highlighted ? <RoundedRectangle cornerRadius={999} modifiers={[frame({ width: 4, height: 24 }),
              foregroundStyle(PlatformColor('systemBlue')), accessibilityHidden()]} /> : null}
            <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{text(row.titleKey)}</Text>
          </HStack>
          {/* Real count text reserves the overlay's exact width without adding an accessibility element or another control. */}
          {countLabel(count, true)}
          <Image systemName="chevron.forward" size={22} modifiers={[frame({ width: 22, height: 22 }), padding({ leading: 6 }),
            foregroundStyle(PlatformColor('secondaryLabel')), accessibilityHidden()]} />
        </HStack>
      </Button>
      <Overlay.Content><HStack spacing={0}>
        <Button testID={`customer-status-count-${row.kind}`} onPress={open} modifiers={[buttonStyle('plain')]}>{countLabel(count, false)}</Button>
        <Spacer modifiers={[frame({ width: 48 })]} />
      </HStack></Overlay.Content>
    </Overlay>;
  })}</Section>;
}
