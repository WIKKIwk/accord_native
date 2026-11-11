import { ListItem, Text } from '@expo/ui';
import { Background, HStack, Rectangle, RNHostView, Spacer, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityElement, accessibilityHidden, alignmentGuide, contentShape, font, foregroundStyle, listRowInsets, onLongPressGesture, onTapGesture, opacity, shapes, type ShapeStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, View, type ColorValue } from 'react-native';
import type { Session } from '../../auth';
import type { OrderCardTone } from '../../workerOrderAppearance';
import { useWorkerColors } from '../../components/useWorkerColors';
import { WorkerOrderThumbnail } from '../../components/WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; statusText?: string; statusDetail?: string; onPress: () => void; onLongPress?: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

const statusColors: Partial<Record<OrderCardTone, ColorValue>> = {
  print_preflight: PlatformColor('systemPurple'), print_preflight_passed: PlatformColor('systemGreen'),
  in_progress: PlatformColor('systemGreen'), waiting_next_stage: PlatformColor('systemBlue'),
  paused: PlatformColor('systemOrange'), frozen: PlatformColor('systemRed'), issue: PlatformColor('systemRed'),
  completed: PlatformColor('systemGreen'),
};

const fallbackBackgrounds: Partial<Record<OrderCardTone, ShapeStyle>> = {
  ...statusColors,
  print_preflight: { type: 'linearGradient', colors: [PlatformColor('systemIndigo'), PlatformColor('systemPink'), PlatformColor('systemGray5')],
    startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
  print_preflight_passed: { type: 'linearGradient', colors: [PlatformColor('systemGreen'), PlatformColor('systemMint'), PlatformColor('systemBackground')],
    startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
};

export function OrderListItem({ headline, supportingText, statusText, statusDetail, onPress, onLongPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const queueStatus = statusText !== undefined;
  const status = cardTone === 'history_completed' ? { label: 'Tugallangan', color: statusColors.completed! }
    : cardTone === 'history_partial' ? { label: 'Qisman', color: statusColors.paused! }
    : queueStatus && statusText ? { label: statusText, color: statusColors[cardTone] ?? PlatformColor('secondaryLabel') } : null;
  const fallbackBackground = !status && !queueStatus ? fallbackBackgrounds[cardTone] : undefined;
  const rowModifiers = [alignmentGuide('listRowSeparatorLeading', 56), listRowInsets({ top: 8, bottom: 8, leading: 16, trailing: 16 })];
  const modifiers = fallbackBackground ? [] : rowModifiers;
  const detailsText = queueStatus ? statusDetail ?? '' : supportingText;
  const details = detailsText ? <Text modifiers={[font({ textStyle: 'subheadline', ...(fontFamily ? { family: fontFamily } : {}) }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{detailsText}</Text> : null;
  const thumbnail = <View pointerEvents="none" style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
    <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} size={44} backgroundColor={colors.field} iconColor={colors.muted} />
  </View>;
  const supporting = status ? <VStack alignment="leading" spacing={2}>
    {details}
    <HStack spacing={4}>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(status.color), accessibilityHidden(true)]}>●</Text>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{status.label}</Text>
    </HStack>
  </VStack> : details;
  const heading = <Text modifiers={[font({ textStyle: 'body', weight: 'medium', ...(headlineFontFamily ? { family: headlineFontFamily } : {}) })]}>{headline}</Text>;
  // A SwiftUI Button competes with its attached long-press recognizer inside List.
  // Own both gestures on the same non-button row, including the thumbnail and gaps.
  const row = onLongPress ? <HStack spacing={12} modifiers={[
    ...modifiers, contentShape(shapes.rectangle()), onTapGesture(onPress), onLongPressGesture(onLongPress),
    accessibilityElement('combine'), accessibilityAddTraits(['isButton']),
  ]}>
    <RNHostView matchContents>{thumbnail}</RNHostView>
    <VStack alignment="leading" spacing={2}>{heading}{supporting}</VStack>
    <Spacer />
  </HStack> : <ListItem onPress={onPress} modifiers={modifiers} leading={thumbnail} supportingText={supporting ?? undefined}>
    {heading}
  </ListItem>;
  if (!fallbackBackground) return row;
  return <Background modifiers={rowModifiers}>{row}<Background.Content>
    <Rectangle modifiers={[foregroundStyle(fallbackBackground), opacity(0.16), accessibilityHidden(true)]} />
  </Background.Content></Background>;
}
