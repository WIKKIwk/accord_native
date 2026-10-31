import { ListItem, Text } from '@expo/ui';
import { useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const appearance = orderCardAppearance(cardTone, dark ? '#101410' : colors.surface, dark);
  return <View style={{ backgroundColor: appearance.color, backgroundImage: appearance.gradient }}><ListItem onPress={onPress} leading={<WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.field} iconColor={colors.muted} />} supportingText={supportingText ?
    <Text textStyle={{ fontFamily, fontSize: 13, color: appearance.secondary ?? '#6b7280' }}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily, color: appearance.text } : { fontWeight: '500', color: appearance.text }}>{headline}</Text>
  </ListItem></View>;
}
