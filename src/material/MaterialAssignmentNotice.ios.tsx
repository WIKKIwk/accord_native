import { Host, HStack, Image, Text } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

/** @v2 showAdminTopNotice: the unanchored assignment notice is a five-second top banner. */
export function MaterialAssignmentNotice({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  if (!message) return null;
  const color = PlatformColor(tone === 'success' ? 'systemGreen' : 'systemRed');
  return <Host matchContents={{ vertical: true }} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
    <HStack spacing={12} modifiers={[padding({ all: 16 }), background(PlatformColor('secondarySystemGroupedBackground')),
      frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Image systemName={tone === 'success' ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'} size={24} color={color} />
      <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), foregroundStyle(PlatformColor('label'))]}>{message}</Text>
    </HStack>
  </Host>;
}
