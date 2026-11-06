import { Button, Host, Icon, Row, Spacer, Text } from '@expo/ui';
import { accessibilityValue, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useWorkerColors } from './useWorkerColors';

type Props = { title: string; count: string; expanded: boolean; onPress: () => void };

export function WorkerExpansion({ title, count, expanded, onPress }: Props) {
  const colors = useWorkerColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button variant="text" onPress={onPress} style={{ width: '100%' }}
      modifiers={[accessibilityValue(expanded ? 'Ochiq' : 'Yopiq')]}>
      <Row alignment="center" spacing={8} style={{ width: '100%' }}>
        <Text textStyle={{ fontSize: 16, fontWeight: '500' }} modifiers={[foregroundStyle(colors.text)]}>{title}</Text>
        <Spacer flexible />
        {!!count && <Text modifiers={[foregroundStyle(colors.muted)]}>{count}</Text>}
        <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={16} color={colors.icon} />
      </Row>
    </Button>
  </Host>;
}
