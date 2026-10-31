import { ListItem, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, clip, padding, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import type { Session } from '../auth';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, first = false, last = false, fontFamily, headlineFontFamily }: Props) {
  const colors = useMaterialColors();
  return <ListItem colors={{ containerColor: colors.surface }} modifiers={[
    padding(16, first ? 0 : 1, 16, last ? 12 : 1),
    clip(Shapes.RoundedCorner({
      topStart: first ? 16 : 4, topEnd: first ? 16 : 4,
      bottomStart: last ? 16 : 4, bottomEnd: last ? 16 : 4,
    })),
    clickable(onPress),
  ]}>
    <ListItem.LeadingContent>
      <RNHostView matchContents><WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} backgroundColor={colors.surfaceContainerHighest} iconColor={colors.onSurfaceVariant} /></RNHostView>
    </ListItem.LeadingContent>
    <ListItem.HeadlineContent>
      <Text style={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }}>{headline}</Text>
    </ListItem.HeadlineContent>
    {supportingText ? <ListItem.SupportingContent>
      <Text style={fontFamily ? { fontFamily } : undefined}>{supportingText}</Text>
    </ListItem.SupportingContent> : null}
  </ListItem>;
}
