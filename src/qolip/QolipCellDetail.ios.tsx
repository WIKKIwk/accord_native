import { Button, Host, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, contentShape, disabled, font, frame, labelStyle,
  lineLimit, onLongPressGesture, onTapGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View, useWindowDimensions } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { qolipCellDetailRowLabel } from './qolipCellDetailState';
import type { QolipCellDetailProps } from './qolipCellDetailProps';
import { useQolipCellDetail } from './useQolipCellDetail';
import { useQolipText } from './useQolipText';

// Content only. No opener, destination or mutation dispatch is provided.
export function QolipCellDetail(props: QolipCellDetailProps) {
  const state = useQolipCellDetail(props), { text, locale } = useQolipText(), { height } = useWindowDimensions();
  if (state.invalid) return null;
  const title = state.header.kind === 'selection' ? localizedMethod('qolipCount', locale, { count: state.header.count })
    : text('home.cell', { cell: state.header.label });
  return <View style={{ maxHeight: height * 0.82, paddingHorizontal: 16, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><HStack spacing={8}>
      <Text modifiers={[font({ size: 22, weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{title}</Text>
      {state.selectionMode && <Button label={text('home.move')} systemImage="arrow.right" onPress={state.moveSelected}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(text('home.move')), accessibilityIdentifier('qolip-bulk-move-button')]} />}
    </HStack></Host>
    <View style={{ height: 12 }} />
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 4 }}>
      {state.rows.map(({ item, selected, showActions, actionsEnabled }, index) => {
        const label = qolipCellDetailRowLabel(item, localizedMethod('qolipCount', locale, { count: item.quantity }));
        return <Host key={`${item.id}:${index}`} matchContents={{ vertical: true }}><HStack spacing={10} modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 12, vertical: 10 }),
          background(PlatformColor(selected ? 'secondarySystemFill' : 'tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 12 })),
          contentShape(shapes.rectangle()), accessibilityIdentifier(`qolip-cell-detail-row-${index}`),
          ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
          onTapGesture(() => state.controller.tap(item)), onLongPressGesture(() => state.controller.toggle(item)),
        ]}><Image systemName="square.stack.3d.up.fill" size={20} /><VStack alignment="leading" spacing={2}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ weight: 'bold' }), lineLimit(1)]}>{label.title}</Text><Text modifiers={[lineLimit(1)]}>{label.subtitle}</Text>
        </VStack>{selected ? <Image systemName="checkmark.circle.fill" /> : showActions && <>
          <Button label={text('home.move')} onPress={() => state.moveOut(item)} modifiers={[buttonStyle('bordered'), disabled(!actionsEnabled)]} />
          <Button label={text('home.take')} onPress={() => state.take(item)} modifiers={[buttonStyle('bordered'), disabled(!actionsEnabled)]} />
        </>}</HStack></Host>;
      })}
    </ScrollView>
    <View style={{ height: 10 }} />
    <Host matchContents={{ vertical: true }}><VStack spacing={8}>
      {state.unplacedCount > 0 && <Button label={text('home.unplaced_molds', { count: state.unplacedCount })} systemImage="exclamationmark.triangle"
        onPress={state.placeUnplaced} modifiers={[buttonStyle('bordered'), disabled(!state.footerEnabled), frame({ maxWidth: Infinity })]} />}
      {state.movableInCount > 0 && <Button label={text('home.move_from_other', { count: state.movableInCount })} systemImage="arrow.down.square"
        onPress={state.moveIn} modifiers={[buttonStyle('bordered'), disabled(!state.footerEnabled), frame({ maxWidth: Infinity })]} />}
      <Button label={text('home.add_here')} systemImage="plus.square" onPress={state.add}
        modifiers={[buttonStyle('borderedProminent'), disabled(!state.footerEnabled), frame({ maxWidth: Infinity })]} />
    </VStack></Host>
  </View>;
}
