import { ListItem, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, clip, padding, Shapes } from '@expo/ui/jetpack-compose/modifiers';

type Props = { headline: string; supportingText: string; onPress: () => void; first?: boolean; last?: boolean; fontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, first = false, last = false, fontFamily }: Props) {
  const colors = useMaterialColors();
  return <ListItem colors={{ containerColor: colors.surface }} modifiers={[
    padding(16, first ? 0 : 1, 16, last ? 12 : 1),
    clip(Shapes.RoundedCorner({
      topStart: first ? 16 : 4, topEnd: first ? 16 : 4,
      bottomStart: last ? 16 : 4, bottomEnd: last ? 16 : 4,
    })),
    clickable(onPress),
  ]}>
    <ListItem.HeadlineContent>
      <Text style={fontFamily ? { fontFamily } : undefined}>{headline}</Text>
    </ListItem.HeadlineContent>
    {supportingText ? <ListItem.SupportingContent>
      <Text style={fontFamily ? { fontFamily } : undefined}>{supportingText}</Text>
    </ListItem.SupportingContent> : null}
  </ListItem>;
}
