import { ListItem, Text } from '@expo/ui';
import type { Session } from '../auth';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, imageActive, fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  return <ListItem onPress={onPress} leading={<WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.field} iconColor={colors.muted} />} supportingText={supportingText ?
    <Text textStyle={{ fontFamily, fontSize: 13, color: '#6b7280' }}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }}>{headline}</Text>
  </ListItem>;
}
