import { ListItem, Text } from '@expo/ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';

type Props = { headline: string; supportingText: string; onPress: () => void; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, fontFamily, headlineFontFamily }: Props) {
  const textStyle = fontFamily ? { fontFamily } : undefined;
  return <ListItem onPress={onPress} supportingText={supportingText ?
    <Text textStyle={textStyle} modifiers={[foregroundStyle({ type: 'color', color: 'secondaryLabel' })]}>{supportingText}</Text> : undefined}>
    <Text textStyle={headlineFontFamily ? { fontFamily: headlineFontFamily } : { fontWeight: '500' }}>{headline}</Text>
  </ListItem>;
}
