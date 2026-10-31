import { ListItem, Text } from '@expo/ui';
import { background, foregroundStyle, listRowBackground } from '@expo/ui/swift-ui/modifiers';
import { useColorScheme } from 'react-native';
import type { Session } from '../auth';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const appearance = orderCardAppearance(cardTone, dark ? '#101410' : '#FFFFFF', dark);
  const modifiers = appearance.gradientColors ? [background({ type: 'linearGradient', colors: appearance.gradientColors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })] : appearance.color ? [listRowBackground(appearance.color)] : [];
  const textStyle = fontFamily ? { fontFamily } : undefined;
  return <ListItem onPress={onPress} modifiers={modifiers} leading={<WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.field} iconColor={colors.muted} />} supportingText={supportingText ?
    <Text textStyle={textStyle} modifiers={[foregroundStyle({ type: 'color', color: appearance.secondary ?? 'secondaryLabel' })]}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }} modifiers={appearance.text ? [foregroundStyle(appearance.text)] : undefined}>{headline}</Text>
  </ListItem>;
}
