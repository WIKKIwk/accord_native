import { Picker, Row, Spacer, Text } from '@expo/ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { QUEUE_LIMITS, isQueueLimit } from '../workerQueueLimit';
import type { WorkerQueueFilterProps } from './workerQueueFilterProps';

export function WorkerQueueFilter({ value, enabled, loading, onChange, machinePicker }: WorkerQueueFilterProps) {
  return <Row alignment="center" spacing={4} style={{ paddingVertical: 4 }} modifiers={[buttonStyle('borderless')]}>
    <Text numberOfLines={1}>{loading ? 'Yangilanmoqda…' : 'Ko‘rsatish'}</Text>
    <Spacer flexible />
    {machinePicker}
    <Picker selectedValue={value} enabled={enabled} onValueChange={next => { if (isQueueLimit(next)) onChange(next); }}>
      {QUEUE_LIMITS.map(count => <Picker.Item key={count} value={count} label={count === 0 ? 'Barchasi' : `${count} ta`} />)}
    </Picker>
  </Row>;
}
