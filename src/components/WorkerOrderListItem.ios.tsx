import { ListItem, Text } from '@expo/ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import type { Session } from '../auth';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const textStyle = fontFamily ? { fontFamily } : undefined;
  return <ListItem onPress={onPress} leading={<WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} backgroundColor={colors.field} iconColor={colors.muted} />} supportingText={supportingText ?
    <Text textStyle={textStyle} modifiers={[foregroundStyle({ type: 'color', color: 'secondaryLabel' })]}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }}>{headline}</Text>
  </ListItem>;
}
