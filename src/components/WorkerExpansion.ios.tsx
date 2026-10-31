import { Button, Host, Icon, Row, Spacer, Text } from '@expo/ui';
import { accessibilityValue } from '@expo/ui/swift-ui/modifiers';
import { useWorkerColors } from './useWorkerColors';

type Props = { title: string; count: string; expanded: boolean; onPress: () => void };

export function WorkerExpansion({ title, count, expanded, onPress }: Props) {
  const colors = useWorkerColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button variant="text" onPress={onPress} style={{ width: '100%' }}
      modifiers={[accessibilityValue(expanded ? 'Ochiq' : 'Yopiq')]}>
      <Row alignment="center" spacing={8} style={{ width: '100%' }}>
        <Text textStyle={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{title}</Text>
        <Spacer flexible />
        {!!count && <Text textStyle={{ color: colors.muted }}>{count}</Text>}
        <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={16} color={colors.icon} />
      </Row>
    </Button>
  </Host>;
}
