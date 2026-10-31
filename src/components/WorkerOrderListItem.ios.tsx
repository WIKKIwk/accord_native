import { ListItem, Text } from '@expo/ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';

type Props = { headline: string; supportingText: string; onPress: () => void; first?: boolean; last?: boolean; fontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, fontFamily }: Props) {
  const textStyle = fontFamily ? { fontFamily } : undefined;
  return <ListItem onPress={onPress} supportingText={supportingText ?
    <Text textStyle={textStyle} modifiers={[foregroundStyle({ type: 'color', color: 'secondaryLabel' })]}>{supportingText}</Text> : undefined}>
    <Text textStyle={textStyle}>{headline}</Text>
  </ListItem>;
}
