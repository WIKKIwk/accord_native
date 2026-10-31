import { ListItem, Text } from '@expo/ui';

type Props = { headline: string; supportingText: string; onPress: () => void; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, fontFamily, headlineFontFamily }: Props) {
  return <ListItem onPress={onPress} supportingText={supportingText ?
    <Text textStyle={{ fontFamily, fontSize: 13, color: '#6b7280' }}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }}>{headline}</Text>
  </ListItem>;
}
