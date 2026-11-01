import { ListItem, Text } from '@expo/ui';
import { VStack } from '@expo/ui/swift-ui';
import { alignmentGuide, background, font, foregroundStyle, listRowBackground, listRowInsets, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; statusText?: string; statusDetail?: string; onPress: () => void; onLongPress?: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

const darkStatusColors: Partial<Record<OrderCardTone, string>> = {
  print_preflight: '#BF5AF2', print_preflight_passed: '#30D158', in_progress: '#30D158',
  waiting_next_stage: '#0A84FF', paused: '#FFD60A', frozen: '#FF453A', issue: '#FF453A', completed: '#30D158',
};

const lightStatusColors: Partial<Record<OrderCardTone, string>> = {
  print_preflight: '#8A249D', print_preflight_passed: '#247A36', in_progress: '#247A36',
  waiting_next_stage: '#005DBA', paused: '#945A00', frozen: '#BF2720', issue: '#BF2720', completed: '#247A36',
};

export function WorkerOrderListItem({ headline, supportingText, statusText, statusDetail, onPress, onLongPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const statusColors = dark ? darkStatusColors : lightStatusColors;
  const queueStatus = statusText !== undefined;
  const status = cardTone === 'history_completed' ? { label: 'Tugallangan', color: statusColors.completed! }
    : cardTone === 'history_partial' ? { label: 'Qisman', color: statusColors.paused! }
    : queueStatus && statusText ? { label: statusText, color: statusColors[cardTone] ?? (dark ? '#8E8E93' : '#67676B') } : null;
  const appearance = orderCardAppearance(status || queueStatus ? 'neutral' : cardTone, dark ? '#101410' : '#FFFFFF', dark);
  const modifiers = [alignmentGuide('listRowSeparatorLeading', 56), listRowInsets({ top: 8, bottom: 8, leading: 16, trailing: 16 }), ...(appearance.gradientColors ? [background({ type: 'linearGradient', colors: appearance.gradientColors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })] : appearance.color ? [listRowBackground(appearance.color)] : []), ...(onLongPress ? [onLongPressGesture(onLongPress)] : [])];
  const detailsText = queueStatus ? statusDetail ?? '' : supportingText;
  const details = detailsText ? <Text modifiers={[font({ textStyle: 'subheadline', ...(fontFamily ? { family: fontFamily } : {}) }), foregroundStyle({ type: 'color', color: appearance.secondary ?? 'secondaryLabel' })]}>{detailsText}</Text> : null;
  return <ListItem onPress={onPress} modifiers={modifiers} leading={<View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
    <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} size={44} backgroundColor={colors.field} iconColor={colors.muted} />
  </View>} supportingText={status ? <VStack alignment="leading" spacing={2}>
    {details}
    <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(status.color)]}>{`● ${status.label}`}</Text>
  </VStack> : details ?? undefined}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'medium', ...(headlineFontFamily ? { family: headlineFontFamily } : {}) }), ...(appearance.text ? [foregroundStyle(appearance.text)] : [])]}>{headline}</Text>
  </ListItem>;
}
