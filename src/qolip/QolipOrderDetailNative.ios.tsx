import { Button, Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { PlatformColor, Pressable, View } from 'react-native';
import type { QolipOrderMoldRow as Mold, QolipOrderStageRow as Stage } from './useQolipSequenceOrderDetail';
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
/** @v2 _ScannedItemsExpansionHeader / _AttachedQolipTile / _SequenceStepTile */
export function QolipOrderSection({ title, subtitle, count, expanded, enabled, onPress, children }: { title: string; subtitle?: string; count?: string; expanded: boolean; enabled: boolean; onPress(): void; children?: ReactNode }) {
  return <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: PlatformColor('secondarySystemGroupedBackground') }}><Host matchContents={{ vertical: true }}><Button onPress={onPress} modifiers={[buttonStyle('plain'), disabled(!enabled)]}>
    <HStack spacing={10} modifiers={[padding({ all: 16 }), frame({ minHeight: 56, maxWidth: Infinity })]}><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{title}</Text>{!!subtitle && <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{subtitle}</Text>}
    </VStack>{!!count && <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), secondary]}>{count}</Text>}{enabled && <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={13} modifiers={[secondary]} />}</HStack>
  </Button></Host>{expanded && <View style={{ padding: 12, gap: 8 }}>{children}</View>}</View>;
}
export function QolipOrderMoldRow({ row, onLongPress }: { row: Mold; onLongPress(): void }) {
  return <Pressable accessibilityRole="button" onLongPress={onLongPress}><Host matchContents={{ vertical: true }}><HStack spacing={12} modifiers={[padding({ all: 12 }), frame({ minHeight: 60, maxWidth: Infinity }), background(PlatformColor('tertiarySystemGroupedBackground')), cornerRadius(12)]}>
    <Image systemName="qrcode" size={22} modifiers={[secondary]} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' })]}>{row.title}</Text><HStack spacing={6}>{row.color && <Text modifiers={[foregroundStyle(row.color)]}>●</Text>}<Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{row.subtitle}</Text></HStack>
      {!!row.rework && <HStack spacing={6}><Image systemName="wrench" size={14} modifiers={[foregroundStyle(PlatformColor('systemRed'))]} /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(PlatformColor('systemRed'))]}>{row.rework}</Text></HStack>}
    </VStack></HStack></Host></Pressable>;
}
const iconFor = (row: Stage) => row.done ? 'checkmark.circle.fill' : row.type === 'start' ? 'play.circle' : row.type === 'end' ? 'flag.circle' : row.type === 'apparatus'
  ? row.operation === 'laminate' || row.operation === 'glue' ? 'square.3.layers.3d' : row.operation === 'cut' ? 'scissors' : 'printer' : 'point.3.connected.trianglepath.dotted';
export function QolipOrderStageRow({ row, onPress }: { row: Stage; onPress(): void }) {
  const content = <HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 8, horizontal: 10 }), frame({ minHeight: 56, maxWidth: Infinity, alignment: 'leading' })]}>
    <VStack spacing={5}><Image systemName={iconFor(row)} size={28} modifiers={[foregroundStyle(row.done ? '#2E7D32' : PlatformColor('secondaryLabel'))]} />
      {!row.last && <Text modifiers={[font({ size: 22 }), secondary]}>│</Text>}</VStack>
    <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' })]}>{row.title}</Text><Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{row.kind}</Text>
      {!!row.status && <Text modifiers={[font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle(row.statusColor), padding({ all: 5 }), background(`${row.statusColor}1F`), cornerRadius(7)]}>{row.status}</Text>}
      {!!row.produced && <Text modifiers={[font({ textStyle: 'caption' })]}>{row.produced}</Text>}{!!row.input && <Text modifiers={[font({ textStyle: 'caption' })]}>{row.input}</Text>}
    </VStack><Spacer />
  </HStack>;
  return <Host matchContents={{ vertical: true }}>{row.enabled ? <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>{content}</Button> : content}</Host>;
}
