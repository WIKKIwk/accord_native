import { HStack, Image, Text } from '@expo/ui/swift-ui';
import { accessibilityElement, accessibilityHidden, accessibilityLabel, background, cornerRadius, fixedSize, font, foregroundStyle, frame, padding, shadow, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { AccessibilityInfo, PlatformColor, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { BaseHost } from './BaseHost';

/** The caller owns the four-second lifetime; the window overlay escapes lists, sheets and tab bars. */
export function WorkerPaddonFeedback({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  }, [message]);
  if (!message) return null;
  return <FullWindowOverlay>
    <View pointerEvents="none" testID="worker-feedback-banner" style={{ position: 'absolute', top: insets.top + 12,
      left: insets.left + 16, right: insets.right + 16, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 560 }}>
        <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <HStack spacing={12} modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }),
            background({ type: 'material', material: 'regular' }), cornerRadius(20),
            strokeBorder({ color: PlatformColor('separator'), shape: 'roundedRectangle', cornerRadius: 20, style: { lineWidth: 0.5 } }),
            shadow({ radius: 16, y: 6, color: '#0004' }), accessibilityElement('combine'), accessibilityLabel(message)]}>
            <Image systemName="info.circle.fill" size={24} color={PlatformColor('systemBlue')} modifiers={[accessibilityHidden()]} />
            <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), foregroundStyle(PlatformColor('label')),
              frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{message}</Text>
          </HStack>
        </BaseHost>
      </View>
    </View>
  </FullWindowOverlay>;
}
