import { Button, HStack, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, fixedSize, font, foregroundStyle, frame, labelStyle, layoutPriority, lineLimit, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import type { WorkerOrderHeader } from './WorkerOrderHeader';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';
import { WORKER_ORDER_LAYOUT as layout } from './workerOrderLayout';
import { WorkerHistoryButton } from './WorkerHistoryButton';

export function WorkerOrderIdentity({ session, orderId, imageId, code, title, onOpenImage, onClose, onScannedWips }: ComponentProps<typeof WorkerOrderHeader>) {
  const colors = useWorkerColors();
  const { p } = useWorkerOrderText();
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <HStack spacing={layout.sectionGap} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>
      <Button onPress={onOpenImage} modifiers={[buttonStyle('plain'), frame({ width: layout.thumbnailSize, height: layout.thumbnailSize }), accessibilityLabel('Buyurtma rasmini ochish'), accessibilityIdentifier('worker-order-image')]}>
        <RNHostView matchContents><WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active size={layout.thumbnailSize}
          backgroundColor={colors.surface} iconColor={colors.icon} /></RNHostView>
      </Button>
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), layoutPriority(1)]}>
        <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>Buyurtma raqami</Text>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>{code}</Text>
        {title ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(2)]}>{title}</Text> : null}
      </VStack>
      {onScannedWips && <WorkerHistoryButton icon="qr" label={p('worker.scanned_wip.title')} onPress={onScannedWips} testID="worker-order-scanned-wips" />}
      <Button {...(glass ? { role: 'close' as const } : { label: 'Yopish', systemImage: 'xmark' as const })} onPress={onClose}
        modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), buttonBorderShape('circle'), controlSize('large'), frame({ width: layout.iconSize, height: layout.iconSize }), labelStyle('iconOnly'),
          accessibilityLabel('Yopish'), accessibilityIdentifier('worker-order-close')]} />
    </HStack>
  </Host>;
}
