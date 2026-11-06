import { ListItem, Text } from '@expo/ui';
import { HStack, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, alignmentGuide, background, font, foregroundStyle, listRowBackground, listRowInsets, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, useColorScheme, View, type ColorValue } from 'react-native';
import type { Session } from '../../auth';
import { orderCardAppearance, type OrderCardTone } from '../../workerOrderAppearance';
import { useWorkerColors } from '../../components/useWorkerColors';
import { WorkerOrderThumbnail } from '../../components/WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; statusText?: string; statusDetail?: string; onPress: () => void; onLongPress?: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

const statusColors: Partial<Record<OrderCardTone, ColorValue>> = {
  print_preflight: PlatformColor('systemPurple'), print_preflight_passed: PlatformColor('systemGreen'),
  in_progress: PlatformColor('systemGreen'), waiting_next_stage: PlatformColor('systemBlue'),
  paused: PlatformColor('systemOrange'), frozen: PlatformColor('systemRed'), issue: PlatformColor('systemRed'),
  completed: PlatformColor('systemGreen'),
};

export function OrderListItem({ headline, supportingText, statusText, statusDetail, onPress, onLongPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const queueStatus = statusText !== undefined;
  const status = cardTone === 'history_completed' ? { label: 'Tugallangan', color: statusColors.completed! }
    : cardTone === 'history_partial' ? { label: 'Qisman', color: statusColors.paused! }
    : queueStatus && statusText ? { label: statusText, color: statusColors[cardTone] ?? PlatformColor('secondaryLabel') } : null;
  const appearance = orderCardAppearance(status || queueStatus ? 'neutral' : cardTone, dark ? '#101410' : '#FFFFFF', dark);
  const modifiers = [alignmentGuide('listRowSeparatorLeading', 56), listRowInsets({ top: 8, bottom: 8, leading: 16, trailing: 16 }), ...(appearance.gradientColors ? [background({ type: 'linearGradient', colors: appearance.gradientColors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })] : appearance.color ? [listRowBackground(appearance.color)] : []), ...(onLongPress ? [onLongPressGesture(onLongPress)] : [])];
  const detailsText = queueStatus ? statusDetail ?? '' : supportingText;
  const details = detailsText ? <Text modifiers={[font({ textStyle: 'subheadline', ...(fontFamily ? { family: fontFamily } : {}) }), foregroundStyle(appearance.secondary ?? PlatformColor('secondaryLabel'))]}>{detailsText}</Text> : null;
  return <ListItem onPress={onPress} modifiers={modifiers} leading={<View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
    <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} size={44} backgroundColor={colors.field} iconColor={colors.muted} />
  </View>} supportingText={status ? <VStack alignment="leading" spacing={2}>
    {details}
    <HStack spacing={4}>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(status.color), accessibilityHidden(true)]}>●</Text>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{status.label}</Text>
    </HStack>
  </VStack> : details ?? undefined}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'medium', ...(headlineFontFamily ? { family: headlineFontFamily } : {}) }), ...(appearance.text ? [foregroundStyle(appearance.text)] : [])]}>{headline}</Text>
  </ListItem>;
}
