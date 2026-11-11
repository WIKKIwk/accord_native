import { Button, HStack, Image, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled, fixedSize, font, frame, multilineTextAlignment, tint } from '@expo/ui/swift-ui/modifiers';
import { Children, type ComponentProps, type ReactNode } from 'react';
import { Platform, PlatformColor, Text as ParagraphText, View } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import type { WorkerSheetButton } from './WorkerSheetButton';
import { useBaseTheme } from './useBaseTheme';
import { WORKER_ORDER_LAYOUT as layout } from './workerOrderLayout';
import { useWorkerOrderText } from './useWorkerOrderText';
import { hyphenateWorkerNotice } from '../workerNoticeHyphenation';

export function WorkerOrderBlockingNotice({ message }: { message: string }) {
  const { colors } = useBaseTheme();
  const { locale } = useWorkerOrderText();
  const displayMessage = hyphenateWorkerNotice(message, locale);
  // The native iOS paragraph supports justified text, which SwiftUI Text does not expose.
  return <ParagraphText accessibilityLabel={message} style={{
    alignSelf: 'stretch', width: '100%', textAlign: 'justify', fontStyle: 'italic', fontSize: 16, lineHeight: 23,
    paddingVertical: layout.sectionGap, color: colors.onSurfaceVariant ?? colors.onSurface,
  }}>{`“${displayMessage}”`}</ParagraphText>;
}

const actionColors = { complete: 'systemRed', pause: 'systemOrange', resume: 'systemBlue', start: 'systemGreen', report: 'systemBlue' } as const;

export function WorkerOrderButton({ label, onPress, disabled: inactive = false, variant = 'outlined', icon, largeLabel, orderAction }: ComponentProps<typeof WorkerSheetButton>) {
  const symbol = typeof icon === 'string' ? icon : icon?.ios;
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button onPress={onPress} modifiers={[buttonStyle(variant === 'filled' ? (glass ? 'glassProminent' : 'borderedProminent') : variant === 'text' ? 'plain' : (glass ? 'glass' : 'bordered')),
      buttonBorderShape('capsule'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: layout.controlMinHeight }),
      fixedSize({ horizontal: false, vertical: true }), ...(orderAction ? [tint(PlatformColor(actionColors[orderAction]))] : []), disabled(inactive)]}>
      <HStack spacing={layout.rowGap} modifiers={[frame({ maxWidth: Infinity })]}>
        {symbol ? <Image systemName={symbol} size={18} /> : null}
        <Text modifiers={[font({ textStyle: largeLabel ? 'title3' : 'headline', weight: 'semibold' }), multilineTextAlignment('center'), fixedSize({ horizontal: false, vertical: true })]}>{label}</Text>
      </HStack>
    </Button>
  </Host>;
}

export function WorkerOrderActionGroup({ children }: { children: ReactNode }) {
  return <View style={{ gap: layout.rowGap }}>{Children.toArray(children).reverse()}</View>;
}
