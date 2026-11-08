import { Button, Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, fixedSize, font, foregroundStyle, frame, lineLimit, multilineTextAlignment, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, useWindowDimensions, View } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerLayoutDirection, customerRetryContentWidth } from './customerPresentation';

export function CustomerLoadingState() {
  return <Host style={{ flex: 1 }} alignment="center"><ProgressView
    modifiers={[frame({ width: 64, height: 64 }), accessibilityLabel('Loading')]} /></Host>;
}

export function CustomerRetryState({ retry }: { retry: () => Promise<void> }) {
  const { text } = useCustomerText(), { width } = useWindowDimensions();
  return <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%', maxWidth: customerRetryContentWidth(width) }}>
      <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(PlatformColor('secondaryLabel')),
          multilineTextAlignment('center'), lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{text('serverDisconnectedRetry')}</Text>
        <Button label={text('retry')} onPress={() => { void retry(); }} modifiers={[buttonStyle('borderless')]} />
      </VStack>
    </Host>
  </View>;
}

export function CustomerEmptyStatusState() {
  const { text } = useCustomerText();
  return <Host style={{ flex: 1 }} alignment="center"><VStack modifiers={[padding({ all: 18 }),
    background(PlatformColor('secondarySystemGroupedBackground'), shapes.roundedRectangle({ cornerRadius: 12 }))]}>
    <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{text('noRecordsYet')}</Text>
  </VStack></Host>;
}

/** V2 _NotificationPanel empty feed. */
export function CustomerEmptyFeedState() {
  const { locale, text } = useCustomerText();
  return <View style={{ marginHorizontal: 8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={customerLayoutDirection(locale)}>
    <VStack alignment="leading" modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' }),
      background(PlatformColor('secondarySystemGroupedBackground'), shapes.roundedRectangle({ cornerRadius: 28 }))]}>
      <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(PlatformColor('label')), lineLimit(),
        fixedSize({ horizontal: false, vertical: true })]}>{text('noRecordsYet')}</Text>
    </VStack>
  </Host></View>;
}
