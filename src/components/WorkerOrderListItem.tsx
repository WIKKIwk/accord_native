import { ListItem, Text } from '@expo/ui';

type Props = { headline: string; supportingText: string; onPress: () => void; first?: boolean; last?: boolean; fontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, fontFamily }: Props) {
  return <ListItem onPress={onPress} supportingText={supportingText ?
    <Text textStyle={{ fontFamily, fontSize: 13, color: '#6b7280' }}>{supportingText}</Text> : undefined}>
    <Text textStyle={fontFamily ? { fontFamily } : undefined}>{headline}</Text>
  </ListItem>;
}
