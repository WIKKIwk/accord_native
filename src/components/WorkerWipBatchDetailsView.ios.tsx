import { Button, Divider, HStack, Image, RNHostView, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, disabled, fixedSize, font, foregroundStyle, frame, labelStyle, multilineTextAlignment, padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Image as QrImage } from 'expo-image';
import { Platform, PlatformColor } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import type { WorkerWipBatchDetailsViewProps } from './workerWipBatchDetailsTypes';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function WorkerWipBatchDetailsView(props: WorkerWipBatchDetailsViewProps) {
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  const iconModifiers = [buttonStyle(glass ? 'glass' : 'bordered'), buttonBorderShape('circle'), controlSize('large'),
    frame({ width: 44, height: 44 }), labelStyle('iconOnly'), disabled(props.busy)];
  return <Host style={{ flex: 1 }}>
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
      <HStack spacing={10} modifiers={[padding({ horizontal: 16, top: 4, bottom: 12 })]}>
        <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{props.title}</Text>
        {props.onEdit ? <Button label={props.editLabel} systemImage="pencil" onPress={props.onEdit}
          modifiers={[...iconModifiers, accessibilityLabel(props.editLabel), accessibilityIdentifier('worker-wip-qr-edit')]} /> : null}
        <Button {...(glass ? { role: 'close' as const } : { label: props.closeLabel, systemImage: 'xmark' as const })} onPress={props.onClose}
          modifiers={[...iconModifiers, accessibilityLabel(props.closeLabel), accessibilityIdentifier('worker-wip-qr-close')]} />
      </HStack>
      <ScrollView>
        <VStack spacing={16} modifiers={[padding({ horizontal: 16, top: 8, bottom: 28 }), frame({ maxWidth: Infinity })]}>
          {props.qrImage ? <RNHostView matchContents>
            <QrImage source={{ uri: props.qrImage }} style={{ width: 240, height: 240, backgroundColor: '#fff', borderRadius: 16 }}
              contentFit="contain" cachePolicy="none" accessibilityLabel="WIP QR kodi" />
          </RNHostView> : null}
          <VStack spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
            <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' }), multilineTextAlignment('center'), fixedSize({ horizontal: false, vertical: true })]}>{props.itemName}</Text>
            <Text modifiers={[font({ textStyle: 'footnote', design: 'monospaced' }), secondary, multilineTextAlignment('center'), fixedSize({ horizontal: false, vertical: true }), textSelection(true)]}>{props.payload}</Text>
          </VStack>
          <Divider />
          <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier('worker-wip-qr-details')]}>
            {props.rows.map(([label, value]) => <HStack key={label} alignment="top" spacing={12}>
              <Text modifiers={[font({ textStyle: 'footnote' }), secondary, frame({ width: 88, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{label}</Text>
              <Text modifiers={[font({ textStyle: 'subheadline' }), frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{value}</Text>
            </HStack>)}
          </VStack>
          {props.canReprint ? <Button onPress={props.onReprint} modifiers={[buttonStyle(glass ? 'glassProminent' : 'borderedProminent'),
            buttonBorderShape('capsule'), controlSize('large'), disabled(props.busy), frame({ maxWidth: Infinity, minHeight: 48 }), accessibilityIdentifier('worker-wip-qr-reprint')]}>
            <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
              <Image systemName="printer" size={18} /><Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{props.reprintLabel}</Text>
            </HStack>
          </Button> : null}
          {props.message ? <Text modifiers={[foregroundStyle(PlatformColor('systemRed')), fixedSize({ horizontal: false, vertical: true })]}>{props.message}</Text> : null}
        </VStack>
      </ScrollView>
    </VStack>
  </Host>;
}
